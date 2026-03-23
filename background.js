let actions = [];
let currentStep = 0;
let recording = undefined;
let playingTabId = undefined;
let lastActionTime = Date.now();
let currentSessionId;
let currentLoopRun = 1;
let numberRuns = 1;

async function playActions(tabId, sessionId) {
//   console.log("Playing actions:", actions, "Current step:", currentStep, "Playing:", playing);

  if (currentStep >= actions.length || playingTabId !== tabId) return;

  while (currentStep < actions.length) {
    const action = actions[currentStep]?.data;
    // 🔥 store current step
    chrome.storage.local.set({ currentStep });
    
    console.log('preparing execute action for current step ', currentStep, 'current loop', currentLoopRun);
    if (action.time) {
        await new Promise(r => setTimeout(r, action.time * 1000));
    }
    
    if (playingTabId != tabId || sessionId != currentSessionId) break;
    chrome.tabs.sendMessage(tabId, {
        type: "execute-action",
        action: action
    });
    
    currentStep++;
    
    if (action.type === "redirect") {
        break;
    }
  }

  if (currentStep >= actions.length) {
    currentStep = 0;
    if (numberRuns > currentLoopRun) {
        // wait 5 secs before continuing
        await new Promise(r => setTimeout(r, 5000));
        currentLoopRun++;
        chrome.storage.local.set({ currentRun: currentLoopRun });
        playActions(tabId, sessionId);
    }
    else {
        playingTabId = undefined;
        chrome.storage.local.set({ isPlaying: false });
    }
  }

}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "toggle-recording") {
        recording = message.value;
        chrome.storage.local.set({ recording });
        sendResponse({ recording });

        if (recording) {
            chrome.tabs.query({active:true,currentWindow:true}, tabs => {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: "start-recording"
                });
            });  
        } 
    }

    if (message.type === "get-recording-state") {
        sendResponse({ recording });
    }

    if (message.type === "get-last-action") {
        sendResponse({ lastAction: actions[actions.length - 1] });
    }

    if (message.type === "actions") {
        actions = message.actions;

        // console.log("Recorded actions:", actions);

        chrome.storage.local.set({ actions: actions });
    }

    if (recording !== undefined && recording && message.type === "action") {
        actions.push(message);

        // console.log("Recorded action:", message);
        // console.log("All actions:", actions);

        chrome.storage.local.set({ actions: actions });
    }
    
    // console.log("Received message:", message.type);
    if (message.type === "toggle-play-recording") {
        if (playingTabId !== undefined) {
            playingTabId = undefined;
            chrome.storage.local.set({ isPlaying: false });
        } else {
            actions = message.actions;
            numberRuns = message.tries || messageRuns;
            chrome.tabs.query({active:true,currentWindow:true}, tabs => {
                playingTabId = tabs[0].id;
                currentSessionId = Date.now();
                chrome.storage.local.set({ isPlaying: true, currentRun: currentLoopRun });
                playActions(tabs[0].id, currentSessionId);
            });  
        }
    }
    if (message.type === "restart-play-recording") {
        currentStep = 0;
        currentLoopRun = 1;
        playing = false;
        chrome.storage.local.set({ isPlaying: playing });
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
//   console.log("Tab updated:", tabId, changeInfo);
    if (changeInfo.status === "loading" && tabId === playingTabId)
        currentSessionId = Date.now();

    if (changeInfo.status === "complete") {
        if (recording) {
            chrome.tabs.sendMessage(tabId, {
                type: "navigation"
            });
        } 
        else if (tabId === playingTabId) {  
            playActions(tabId, currentSessionId);
        }
    }
});

chrome.action.onClicked.addListener(async (tab) => {

  await chrome.sidePanel.open({
    windowId: tab.windowId
  });

});