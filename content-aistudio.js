// Content script for aistudio.google.com/generate-speech
// Implements functions from readme.md section 2

// Helper: Wait for element to appear
async function waitForElement(selector, timeout = 5000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(resolve => setTimeout(resolve, timeout));
  }
  throw new Error(`Không tìm thấy element: ${selector}`);
}

// Helper: Wait for Run button to be enabled
async function waitForRunButtonEnabled(timeout = 5000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const runButton = document.querySelector("button.run-button");
    if (runButton && !runButton.disabled && runButton.getAttribute("aria-disabled") !== "true") {
      return runButton;
    }
    await new Promise(resolve => setTimeout(resolve, timeout));
  }
  throw new Error("Timeout: Nút Run không khả dụng");
}

// Helper: Wait for button label to change
function waitForButtonLabel(runButton, expectedText, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = setInterval(() => {
      const labelEl = runButton.querySelector(".label");
      if (labelEl && labelEl.textContent.trim() === expectedText) {
        clearInterval(check);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(check);
        reject(`Timeout: không thấy nút ở trạng thái "${expectedText}"`);
      }
    }, 500);
  });
}

// Helper: Wait for audio src to appear
function waitForAudioSrc(timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const checkAudio = setInterval(() => {
      const audio = document.querySelector("div.speech-prompt-footer-actions-left audio");
      if (audio && audio.src) {
        clearInterval(checkAudio);
        resolve(audio.src);
      } else if (Date.now() - start > timeout) {
        clearInterval(checkAudio);
        reject("Timeout: không thấy audio.src");
      }
    }, 1000);
  });
}

// Main TTS generation function
async function generateTTS({
  textInput,
  mode = "single",       // "single" or "multi"
  temperature = null,    // only used if mode = single
  styleInstruction = ""  // style text
}) {
  console.log("Starting TTS generation with:", { textInput, mode, temperature, styleInstruction });

  // 1. Set mode
  function setMode(mode) {
    const buttons = document.querySelectorAll("ms-toggle-button button");
    let singleBtn = null, multiBtn = null;

    buttons.forEach(btn => {
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes("single-speaker")) singleBtn = btn;
      if (text.includes("multi-speaker")) multiBtn = btn;
    });

    if (!singleBtn || !multiBtn) {
      console.warn("Không tìm thấy button chọn mode");
      return;
    }

    if (mode === "single" && !singleBtn.classList.contains("ms-button-active")) {
      singleBtn.click();
      console.log("Đã chuyển sang Single-speaker");
    }
    if (mode === "multi" && !multiBtn.classList.contains("ms-button-active")) {
      multiBtn.click();
      console.log("Đã chuyển sang Multi-speaker");
    }
  }

  setMode(mode);

  // 2. If single → set temperature
  if (mode === "single" && temperature !== null) {
    const tempInput = document.querySelector("input.slider-number-input");
    if (tempInput) {
      tempInput.value = temperature;
      tempInput.dispatchEvent(new Event("input", { bubbles: true }));
      console.log("Đã set temperature:", temperature);
    }
  }

  // 3. Style instructions
  if (styleInstruction.trim() !== "") {
    const styleTextarea = document.querySelector('textarea[placeholder*="Describe the style"]');
    if (styleTextarea) {
      styleTextarea.value = "";
      styleTextarea.dispatchEvent(new Event("input", { bubbles: true }));

      styleTextarea.value = styleInstruction;
      styleTextarea.dispatchEvent(new Event("input", { bubbles: true }));
      console.log("Đã nhập style instruction:", styleInstruction);
    }
  }

  // 4. Input text content (with retry)
  const textarea = await waitForElement(
    'textarea[placeholder="Start writing or paste text here to generate speech"]',
    5000,
    2
  );
  textarea.value = "";
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.value = textInput;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  console.log("Đã nhập:", textInput);

  // 5. Wait for Run button to be enabled and click
  const runButton = await waitForRunButtonEnabled(5000, 2);
  runButton.click();
  console.log("Đã click Run");

  try {
    // 6. Wait Stop → Run
    await waitForButtonLabel(runButton, "Stop");
    console.log("Đang xử lý...");
    await waitForButtonLabel(runButton, "Run");
    console.log("Xử lý xong, quay lại Run");

    // 7. Get audio src
    const audioSrc = await waitForAudioSrc();
    console.log("Audio src:", audioSrc);

    return audioSrc;
  } catch (err) {
    console.error("Error in TTS generation:", err);
    throw err;
  }
}

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message in AI Studio content script:", request);
  
  if (request.action === "generateTTS") {
    generateTTS({
      textInput: request.text,
      mode: request.mode || "single",
      temperature: request.temperature || 1.0,
      styleInstruction: request.styleInstruction || ""
    })
      .then(audioSrc => {
        sendResponse({ success: true, audioSrc: audioSrc });
      })
      .catch(error => {
        console.error("TTS generation error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === "checkPageReady") {
    try {
      const textarea = document.querySelector('textarea[placeholder="Start writing or paste text here to generate speech"]');
      const runButton = document.querySelector("button.run-button");
      const ready = textarea && runButton;
      sendResponse({ success: true, ready: ready });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

// Log when content script is loaded
console.log("AI Studio TTS content script loaded");

// Check if page is ready
function checkPageReady() {
  const textarea = document.querySelector('textarea[placeholder="Start writing or paste text here to generate speech"]');
  const runButton = document.querySelector("button.run-button");
  
  if (textarea && runButton) {
    console.log("AI Studio page is ready for TTS generation");
    return true;
  }
  return false;
}

// Auto-check page readiness
let readinessInterval = setInterval(() => {
  if (checkPageReady()) {
    clearInterval(readinessInterval);
    console.log("AI Studio ready - stopping readiness check");
  }
}, 2000);