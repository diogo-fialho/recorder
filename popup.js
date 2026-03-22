const toggleBtn = document.getElementById("togglerecording");
const exportBtn = document.getElementById("export");
const clearBtn = document.getElementById("clear");
const editor = document.getElementById("editor");
const saveBtn = document.getElementById("save");
const restartBtn = document.getElementById("restart");

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

  let editorVisible = editor.style.display != 'none';
  editor.style.display = editorVisible ? 'none' : 'block';
  exportBtn.textContent = editorVisible ? "Show Actions" : "Hide Actions";
  if (!editorVisible) {
    chrome.storage.local.get("actions", (data) => {
      const actions = data.actions || [];
      editor.value =
        JSON.stringify(actions.map((action) => action.data), null, 2);
    });
  }

});

editor.addEventListener("change", () => {
  console.log("Editor content changed");
  try {
    const actions = JSON.parse(editor.value);
    chrome.runtime.sendMessage({
      type: "actions",
      actions: actions.map((data) => ({ data }))
    });
  } catch (e) {
    console.error("Invalid JSON", e);
  }
});
document.getElementById("clear").addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "actions",
      actions: []
    });
  editor.value = "";
});

document.getElementById("copy").addEventListener("click", () => {
  chrome.storage.local.get("actions", (data) => {
    const actions = data.actions || [];
    navigator.clipboard.writeText(JSON.stringify(actions.map((action) => action.data), null, 2));
  });
});

document.getElementById("play").addEventListener("click", () => {
  console.log("Play button clicked");
  chrome.storage.local.get("actions", (data) => {

    chrome.runtime.sendMessage({
      type: "toggle-play-recording",
      actions: data.actions
    });
  });
});

restartBtn.addEventListener("click", () => {
  console.log("Restart button clicked");

  chrome.runtime.sendMessage({
    type: "restart-play-recording"
  });
});