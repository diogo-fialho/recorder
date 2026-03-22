let actions = [];
let currentStep = 0;
let recording = undefined;
let playing = false;
let lastActionTime = Date.now();

async function playActions(tabId) {
//   console.log("Playing actions:", actions, "Current step:", currentStep, "Playing:", playing);

  if (currentStep >= actions.length) return;

  while (playing && currentStep < actions.length) {
    const action = actions[currentStep]?.data;
    // 🔥 store current step
    chrome.storage.local.set({ currentStep });
    
    if (action.time) {
        await new Promise(r => setTimeout(r, action.time * 1000));
    }
    
    if (!playing) break;
     
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
    playing = false;
    chrome.storage.local.set({ isPlaying: playing });
    currentStep = 0;
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
        if (playing) {
            playing = false;
            chrome.storage.local.set({ isPlaying: playing });
        } else {
            playing = true;
            chrome.storage.local.set({ isPlaying: playing });
            actions = message.actions;

            chrome.tabs.query({active:true,currentWindow:true}, tabs => {
                playActions(tabs[0].id);
            });  
        }
    }
    if (message.type === "restart-play-recording") {
        currentStep = 0;
        playing = false;
        chrome.storage.local.set({ isPlaying: playing });
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
//   console.log("Tab updated:", tabId, changeInfo);
  if (changeInfo.status === "complete") {
    if (recording) {
        chrome.tabs.sendMessage(tabId, {
            type: "navigation"
        });
    } 
    else {  
        playActions(tabId);
    }
  }

});

chrome.action.onClicked.addListener(async (tab) => {

  await chrome.sidePanel.open({
    windowId: tab.windowId
  });

});
