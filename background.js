let actions = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "toggle-recording") {
        recording = message.value;
        chrome.storage.local.set({ recording });
        sendResponse({ recording });
    }

    if (message.type === "get-recording-state") {
        sendResponse({ recording });
    }

    if (recording && message.type === "action") {
        actions.push(message);

        console.log("Recorded action:", message);
        console.log("All actions:", actions);

        chrome.storage.local.set({ actions: actions });
    }
});
