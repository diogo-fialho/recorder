let lastActionTime = Date.now();
let lastAction = undefined;

const INPUTS_KEYDOWN = ["input", "textarea", "number", "email", "password"];

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
    "data-test",
    // "data-qa",
    "aria-label"
    // "role"
];

  while (el.nodeType === Node.ELEMENT_NODE) {

    let selector = el.nodeName.toLowerCase();
    // 2️⃣ Prefer stable attributes
    for (const attr of preferredAttributes) {
      if (el.getAttribute(attr)) {
        selector += `[${attr}="${el.getAttribute(attr)}"]`;
        // path.unshift(selector);
        break;
      }
    }

    if (el.getAttribute("name")) {
      selector += `[name="${el.getAttribute("name")}"]`;
    }

    // // 3️⃣ Add classes
    // if (el.className && typeof el.className === "string") {
    //   const classes = el.className.trim().split(/\s+/).join(".");
    //   if (classes) selector += "." + classes;
    // }

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

function sendAction(action, setDelta = undefined) {
  const now = Date.now();
  const delta = setDelta !== undefined ? setDelta : (now - lastActionTime) / 1000;

  lastActionTime = now;
  lastAction = action;
  action.time = delta;

  chrome.runtime.sendMessage({
    type: "action",
    data: [
      action
    ]
  });

}

function isRecording(callback) {

  chrome.storage.local.get("recording", (data) => {
    callback(data.recording === true);
  });

}

function isPlaying(callback) {

  chrome.storage.local.get("isPlaying", (data) => {
    callback(data.isPlaying === true);
  });

}

async function waitForElement(selector, timeout = 5000, forceWait = false) {

  const start = Date.now();
  if (forceWait && selector !== undefined) {
    await new Promise(r => setTimeout(r, timeout));
    const el = document.querySelector(selector);
    if (el) return el;
    throw new Error("Element not found after forced wait: " + selector);
  }

  while (Date.now() - start < timeout) {

    if (selector !== undefined) {
      const el = document.querySelector(selector);

      if (el && el.offsetParent !== null) {
        return el;
      }
    }
    await new Promise(r => setTimeout(r, Math.min(1000, timeout + 100)));
  }

  if (selector === undefined) return null;

  const el = document.querySelector(selector);
  if (el) return el;
  throw new Error("Element not found: " + selector);
}


async function handleAction(action) {
  const element = await waitForElement(action.selector, (action.time ?? 0) * 1000, true);

  if (action.type === "redirect") {
    window.location.href = action.url;
    return;
  }
  
  if (!element) return;

  if (action.type === "click") {
    element.click();
    if (action.originalType == "INPUT") {
      element.focus();
    }
  }

  if (action.type === "input") {
    element.value = action.value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }

  if (action.type === "select") {
    element.value = action.value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function playAction(action) {
  console.log("Playing action:", action);

  const element = 
    waitForElement(action.selector, (action.time ?? 0) * 1000)
    .catch((e) => {
      console.warn("Element not found for action", action, e);
      return null;
    });
  
  if (action.type === "wait_for") {
    return;
  }

  if (action.type === "redirect") {
    window.location.href = action.url;
    return;
  }
  
  if (!element) return;

  if (action.type === "click") {
    element.click();
    if (action.originalType == "INPUT") {
      element.focus();
    }
  }

  if (action.type === "input") {
    element.value = action.value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }

  if (action.type === "select") {
    element.value = action.value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

}

document.addEventListener("click", (e) => {
  isRecording((recording) => {
    if (!recording) return;

    const button = e.target.closest("button, a, input[type='submit']") || e.target;

    highlight(button);
    sendAction({
      type: "click",
      selector: getCssSelector(button),
      url: button.href || (button.type == "submit" ? button.closest("form")?.action : undefined),
      originalType: e.target.nodeName
    });

  });
}, true);

document.addEventListener("input", (e) => {
  isRecording((recording) => {
    if (!recording) return;
    
    if (!INPUTS_KEYDOWN.includes(e.target.type)) {
      // console.log("Input event:", e.target.type, "Recording:", recording, "value:", e.target.value);
      highlight(e.target);
      sendAction({
        type: e.target.type != "select-one" ? "input" : "select",
        selector: getCssSelector(e.target),
        value: e.target.value,
        originalType: e.target.nodeName
      });
    }
  });
}, true);

document.addEventListener("keydown", (e) => {
  isRecording((recording) => {
    if (INPUTS_KEYDOWN.includes(e.target.type)) {
      // console.log("Input event:", e.target, "Recording:", recording, "value:", e.target.value);
      if (!recording) return;

      highlight(e.target);
      let selector = getCssSelector(e.target);
      let delta = undefined;
      if (lastAction
          && lastAction.type === "input" 
          && lastAction.selector === selector
      )
          delta = 0.001;

      sendAction({
        type: e.target.type != "select-one" ? "input" : "select",
        selector: selector,
        value: e.target.value,
        originalType: e.target.nodeName
      }, delta);
    }
  });
}, true);

document.addEventListener("submit", (e) => {
    isRecording((recording) => {
        if (!recording) return;

        highlight(e.target);
        sendAction({
            type: "submit",
            selector: getCssSelector(e.target),
            originalType: e.target.nodeName
        });
    });

}, true);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.type === "execute-action") {
      handleAction(message.action)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));

      return true; // 🔥 VERY IMPORTANT (keeps channel open)
    }

    if (message.type === "start-recording") {
      lastActionTime = Date.now();
    }

    if (message.type === "navigation") {
      isRecording((recording) => {
          if (!recording) return;
          chrome.runtime.sendMessage({
            type: "get-last-action"
          }, (response) => {
            const lastAction = response.lastAction?.data;
            if (!lastAction || (lastAction.type !== "click" && lastAction.type !== "submit")) {
              sendAction({
                type: "redirect",
                url: window.location.href,
                originalType: "NAVIGATION"
              });
            }
          });
      });
    }
});
