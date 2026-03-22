const toggleBtn = document.getElementById("togglerecording");
const exportBtn = document.getElementById("export");
const clearBtn = document.getElementById("clear");
const editor = document.getElementById("editor");
const saveBtn = document.getElementById("save");
const restartBtn = document.getElementById("restart");
const playBtn = document.getElementById("play");
const dropzone = document.getElementById("dropzone");
const preview = document.getElementById("preview");

function updateButton(recording) {
  toggleBtn.textContent = recording ? "Stop Recording" : "Start Recording";
}

chrome.storage.local.get(["recording", "isPlaying"], (data) => {
  updateButton(data.recording === true);
  updateMode(data.isPlaying === true);
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
  if (!editorVisible) {
    preview.style.display = "none";
    chrome.storage.local.get(["actions", "isPlaying"], (data) => {
      const actions = data.actions || [];
      editor.value =
        JSON.stringify(actions.map((action) => action.data), null, 2);
      if (data.isPlaying !== undefined)
        updateMode(data.isPlaying)
    });
  }

});

editor.addEventListener("change", () => {
  // console.log("Editor content changed");
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
  // console.log("Play button clicked");
  chrome.storage.local.get("actions", (data) => {

    chrome.runtime.sendMessage({
      type: "toggle-play-recording",
      actions: data.actions
    });
  });
});

restartBtn.addEventListener("click", () => {
  chrome.storage.local.get("actions", (data) => {
    renderActions(data.actions || [], 0);

    chrome.runtime.sendMessage({
      type: "restart-play-recording"
    });
  });
});

// Highlight on drag
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.style.background = "#eee";
});

// Remove highlight
dropzone.addEventListener("dragleave", () => {
  dropzone.style.background = "";
});

// Handle drop
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.style.background = "";

  const file = e.dataTransfer.files[0];

  if (!file) return;

  if (!file.name.endsWith(".json")) {
    alert("Please drop a JSON file");
    return;
  }

  const reader = new FileReader();

  reader.onload = function(event) {
    try {
      const importedActions = JSON.parse(event.target.result);

      if (!Array.isArray(importedActions)) {
        alert("Invalid format: must be an array");
        return;
      }

      chrome.runtime.sendMessage({
        type: "actions",
        actions: importedActions.map((data) => ({ data }))
      }, () => {
        editor.value = JSON.stringify(importedActions, null, 2);
        renderActions(importedActions, -1);
      });
    } catch (err) {
      alert("Invalid JSON file");
    }
  };

  reader.readAsText(file);
});

function renderActions(actions, currentStep = -1) {

  let html = "";

  actions.forEach((action, index) => {

    const isActive = index === currentStep;
    html += `
      <div class="${
        isActive ? "active" : ""
      }" style="padding:4px;">
        ${JSON.stringify(action)}
      </div>
    `;
  });

  preview.innerHTML = html;
}

function updateMode(playing) {
  if (playing) {
    playBtn.textContent = "Stop Playing";
    editor.style.display = "none";
    preview.style.display = "block";
    preview.classList.add("playing");
  } else {
    playBtn.textContent = "Play Recording";
    preview.classList.remove("playing");
  }

}

chrome.storage.onChanged.addListener((changes, area) => {

  if (area === "local" && changes.currentStep) {

    chrome.storage.local.get("actions", (data) => {
      renderActions(data.actions || [], changes.currentStep.newValue);
    });

  }

  
  if (area === "local" && changes.isPlaying) {
    updateMode(changes.isPlaying.newValue);
  }

});
