const toggleBtn = document.getElementById("togglerecording");
const exportBtn = document.getElementById("export");
const clearBtn = document.getElementById("clear");
const output = document.getElementById("output");

function updateButton(recording) {
  toggleBtn.textContent = recording ? "Stop Recording" : "Start Recording";
}

chrome.storage.local.get("recording", (data) => {
  updateButton(data.recording === true);
});

toggleBtn.addEventListener("click", () => {
  chrome.storage.local.get("recording", (data) => {
    const newState = !data.recording;

    chrome.runtime.sendMessage({
      type: "toggle-recording",
      value: newState
    }, (response) => {
      updateButton(response.recording);
    });
  });
});

document.getElementById("export").addEventListener("click", () => {

  chrome.storage.local.get("actions", (data) => {
    const actions = data.actions || [];

    document.getElementById("output").textContent =
      JSON.stringify(actions.map((action) => action.data), null, 2);
  });

});
document.getElementById("clear").addEventListener("click", () => {
  chrome.storage.local.set({ actions: [] });
  document.getElementById("output").textContent = "";
});
