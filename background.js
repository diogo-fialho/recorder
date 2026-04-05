let actions = [];
let recording = undefined;
let lastActionTime = Date.now();

let playingTabs = [];
let lastActiveTabId;

function executeAction(tabId, action) {

  return new Promise((resolve, reject) => {

    chrome.tabs.sendMessage(
      tabId,
      { type: "execute-action", action },
      (response) => {

        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
          return;
        }

        if (!response || !response.success) {
          reject(response?.error || "Unknown error");
          return;
        }

        resolve();
      }
    );

  });
}


async function playTabActions(playingTab) {
    if (playingTab.currentStep >= actions.length || playingTab.paused) return;
    let currentSessionId = playingTab.sessionId;
    while (playingTab.currentStep < actions.length) {
        const action = actions[playingTab.currentStep]?.data;
        if (lastActiveTabId === playingTab.id) {
            chrome.storage.local.set({ currentStep: playingTab.currentStep });
        }

        // console.log('preparing execute action for current step ', playingTab.currentStep, 'current loop', playingTab.currentLoopRun);
        // if (action.time) {
        //     await new Promise(r => setTimeout(r, action.time * 1000));
        // }
        
        // playingTab = playingTabs.find(t => t.id === playingTab.id); // update playingtab a bit weird
        // if (playingTab.paused || playingTab.sessionId != currentSessionId) break;
        // console.log('execute action for current step ', playingTab.currentStep, 'current loop', playingTab.currentLoopRun, playingTab);
        await executeAction(playingTab.id, action);

        playingTab.currentStep++;
        
        if (action.type === "redirect" || action.waitNavigation === true) {
            break; // will leave tab, stop current execution, on load complete will check if need to continue
        }
    }

        
    if (playingTab.currentStep >= actions.length) {
        playingTab.currentStep = 0;
        if (playingTab.numberRuns > playingTab.currentLoopRun) {
            // wait 5 secs before continuing
            await new Promise(r => setTimeout(r, 5000));
            playingTab.currentLoopRun++;
            if (lastActiveTabId === playingTab.id)
                chrome.storage.local.set({ currentRun: playingTab.currentLoopRun });

            playTabActions(playingTab);
        }
        else {
            playingTab.paused = true;
            if (lastActiveTabId === playingTab.id)
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
        actions.push(
            ...message.data.map((action) => ({
                type: message.type,
                data: action
            })));

        // console.log("Recorded action:", message);
        // console.log("All actions:", actions);

        chrome.storage.local.set({ actions: actions });
    }
    
    // console.log("Received message:", message.type);
    if (message.type === "toggle-play-recording") {
        if (lastActiveTabId !== undefined) {
            let playingTab = playingTabs.find(t => t.id === lastActiveTabId);
            lastActiveTabId = undefined;
            playingTab.paused = true;
            chrome.storage.local.set({ isPlaying: false });
        }
        else {
            actions = message.actions;
            chrome.tabs.query({active:true,currentWindow:true}, tabs => {
                let playingTab = playingTabs.find(t => t.id === tabs[0].id);
                if (!playingTab) {
                    playingTab = {
                        id: tabs[0].id,
                        currentStep: 0,
                        currentLoopRun: 1,
                        sessionId: Date.now()
                    };
                    
                    playingTabs.push(playingTab);
                }
                
                lastActiveTabId = playingTab.id;
                playingTab.paused = false;
                playingTab.numberRuns = message.tries || playingTab.numberRuns;
                playingTab.sessionId = Date.now();
                chrome.storage.local.set({ isPlaying: true, currentRun: playingTab.currentLoopRun });
                playTabActions(playingTab);
            });
        }
    }

    if (message.type === "restart-play-recording") {
        if (lastActiveTabId) {
            let playingTab = playingTabs.find(t => t.id === lastActiveTabId);

            playingTab.currentStep = 0;
            playingTab.currentLoopRun = 1;
            playingTab.paused = true;
            chrome.storage.local.set({ isPlaying: false });
        }
    }

    if (message.type === "skip-to-step") {
        if (lastActiveTabId) {
            let playingTab = playingTabs.find(t => t.id === lastActiveTabId);
            const step = message.step;
            playingTab.currentStep = step;
            chrome.storage.local.set({ currentStep: playingTab.currentStep });
        }
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
//   console.log("Tab updated:", tabId, changeInfo);
    let playingTab = playingTabs.find(t => t.id === tabId);
    if (changeInfo.status === "loading" && playingTab)
        playingTab.sessionId = Date.now();

    if (changeInfo.status === "complete") {
        if (recording) {
            chrome.tabs.sendMessage(tabId, {
                type: "navigation"
            });
        } 
        else if (playingTab && !playingTab.paused) {  
            playTabActions(playingTab);
        }
    }
});

chrome.action.onClicked.addListener(async (tab) => {

  await chrome.sidePanel.open({
    windowId: tab.windowId
  });

});

chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log("Tab activated:", activeInfo);
    let playingTab = playingTabs.find(t => t.id === activeInfo.tabId);
    if (playingTab && lastActiveTabId !== activeInfo.tabId) {
        lastActiveTabId = playingTab.id;
        chrome.storage.local.set({ currentStep: playingTab.currentStep, isPlaying: !playingTab.paused, currentRun: playingTab.currentLoopRun });
    }
});