let lastActionTime = Date.now();

function getCssSelector(el) {

  if (!(el instanceof Element)) return;

  // 1️⃣ Use ID if available
  if (el.id) {
    return "#" + CSS.escape(el.id);
  }
  const otherIds = [
    // "data-ved"
  ]

  if (otherIds.some(attr => el.getAttribute(attr))) {
    const attr = otherIds.find(attr => el.getAttribute(attr));
    return `${el.nodeName.toLowerCase()}[${attr}="${el.getAttribute(attr)}"]`;
  }

  const path = [];
const preferredAttributes = [
    "data-testid",
    "data-test"
    // "data-qa",
    // "aria-label",
    // "role"
];

  while (el.nodeType === Node.ELEMENT_NODE) {

    let selector = el.nodeName.toLowerCase();
    // 2️⃣ Prefer stable attributes
    for (const attr of preferredAttributes) {
      if (el.getAttribute(attr)) {
        selector += `[${attr}="${el.getAttribute(attr)}"]`;
        path.unshift(selector);
        break;
      }
    }

    if (el.getAttribute("name")) {
      selector += `[name="${el.getAttribute("name")}"]`;
    }

    // 3️⃣ Add classes
    if (el.className && typeof el.className === "string") {
      const classes = el.className.trim().split(/\s+/).join(".");
      if (classes) selector += "." + classes;
    }

    // 4️⃣ Add nth-child if needed
    const parent = el.parentNode;

    if (parent) {
      const siblings = Array.from(parent.children)
        .filter(e => e.nodeName === el.nodeName);

      if (siblings.length > 1) {
        const index = siblings.indexOf(el) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    el = parent;

    // stop at body
    if (el === document.body) break;
  }

  return path.join(" > ");
}
function highlight(el) {

  const old = el.style.outline;

  el.style.outline = "3px solid red";

  setTimeout(() => {
    el.style.outline = old;
  }, 500);
}

function sendAction(action) {
  const now = Date.now();
  const delta = (now - lastActionTime) / 1000;

  lastActionTime = now;
  action.time = delta;

  chrome.runtime.sendMessage({
    type: "action",
    data: action
  });

}

function isRecording(callback) {

  chrome.storage.local.get("recording", (data) => {
    callback(data.recording === true);
  });

}

document.addEventListener("click", (e) => {
  isRecording((recording) => {
    if (!recording) return;

    const button = e.target.closest("button, a, input[type='submit']") || e.target;

    highlight(button);
    sendAction({
      type: "click",
      selector: getCssSelector(button)
    });

  });
}, true);

document.addEventListener("input", (e) => {
  isRecording((recording) => {
    console.log("Input event:", e.target, "Recording:", recording);
    if (!recording) return;

    highlight(e.target);
    sendAction({
      type: e.target.type != "select-one" ? "input" : "select",
      selector: getCssSelector(e.target),
      value: e.target.value
    });
  });
}, true);

document.addEventListener("submit", (e) => {
    isRecording((recording) => {
        console.log("Input event:", e.target, "Recording:", recording);
        if (!recording) return;

        highlight(e.target);
        sendAction({
            type: "submit",
            selector: getCssSelector(e.target)
        });
    });

}, true);

window.addEventListener("beforeunload", () => {
    isRecording((recording) => {
        console.log("Input event:", e.target, "Recording:", recording);
        if (!recording) return;

        highlight(e.target);
        sendAction({
            type: "navigation",
            selector: getCssSelector(e.target)
        });
    });

}, true);
