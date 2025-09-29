// Content script for gemini.google.com/gem/storybook
// Implements functions from readme.md section 0 and 1

// Helper: Wait for element to appear
async function waitForElement(selector, timeout = 5000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(resolve => setTimeout(resolve, timeout));
  }
  throw new Error(`Không tìm thấy element: ${selector}`);
}

// Function to send message (from section 0)
async function sendMessage(message) {
  try {
    // #1: Wait for input box (div.ql-editor)
    const inputBox = await waitForElement("div.ql-editor[contenteditable='true']", 5000, 2);

    // Clear old content
    inputBox.textContent = "";
    inputBox.dispatchEvent(new Event("input", { bubbles: true }));

    // Input new value
    inputBox.textContent = message;
    inputBox.dispatchEvent(new Event("input", { bubbles: true }));
    console.log("Đã nhập:", message);

    // #2: Wait for send button
    const sendBtn = await waitForElement("button.send-button", 5000, 2);

    // Click send
    sendBtn.click();
    console.log("Đã click nút Gửi");
    
    return { success: true };
  } catch (err) {
    console.error("Lỗi:", err);
    throw err;
  }
}

// --- Utility functions from section 1 ---
function normalize(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function pickLonger(current, candidate) {
  return (candidate && candidate.length > (current?.length || 0)) ? candidate : current;
}

// Get text from all right-pages
function collectTextByIdx() {
  const textByIdx = new Map();

  document.querySelectorAll('[data-test-id^="storybook-right-page-"]').forEach(page => {
    page.querySelectorAll(
      ".page-content.main storybook-text-page-content, " +
      ".page-content.underneath storybook-text-page-content, " +
      ".page-content.back storybook-text-page-content"
    ).forEach(layer => {
      const p = layer.querySelector(".story-text");
      if (p) {
        // Priority: get page number from footer
        const footer = layer.closest(".page-content")?.querySelector(".footer-page-number");
        let pageNum = null;
        if (footer) {
          pageNum = Number(footer.textContent.trim());
        } else {
          // fallback: get from data-test-id
          const id = page.getAttribute("data-test-id") || "";
          const m = id.match(/storybook-right-page-(\d+)/);
          if (m) pageNum = Number(m[1]);
        }

        if (pageNum != null) {
          const candidate = normalize(p.textContent);
          if (candidate) {
            textByIdx.set(pageNum, pickLonger(textByIdx.get(pageNum), candidate));
          }
        }
      }
    });
  });

  return textByIdx;
}

// Get images from all left-pages
function collectImageByIdx() {
  const imgByIdx = new Map();

  document.querySelectorAll('[data-test-id^="storybook-left-page-"]').forEach(page => {
    page.querySelectorAll(
      ".page-content.main storybook-image-page-content, " +
      ".page-content.underneath storybook-image-page-content, " +
      ".page-content.back storybook-image-page-content"
    ).forEach(layer => {
      const img = layer.querySelector("img");
      if (img) {
        // get index from data-test-id since images rarely have footer
        const id = page.getAttribute("data-test-id") || "";
        const m = id.match(/storybook-left-page-(\d+)/);
        if (!m) return;
        const pageNum = Number(m[1]);

        const src = img.currentSrc || img.src;
        if (src) {
          imgByIdx.set(pageNum, src);
        }
      }
    });
  });

  return imgByIdx;
}

// Get cover information
function collectCover() {
  const coverEl = document.querySelector("storybook-cover-page-content");
  if (!coverEl) return null;

  const imgEl = coverEl.querySelector("img");
  const titleEl = coverEl.querySelector(".cover-title");
  const authorEl = coverEl.querySelector(".cover-author");

  return {
    image: imgEl?.currentSrc || imgEl?.src || "",
    title: normalize(titleEl?.textContent || ""),
    author: normalize(authorEl?.textContent || "")
  };
}

// Combine text + image
function getStoryPairsAll() {
  const textMap = collectTextByIdx();
  const imgMap = collectImageByIdx();

  const out = [];
  const indices = [...new Set([...textMap.keys(), ...imgMap.keys()])].sort((a, b) => a - b);

  for (const i of indices) {
    const text = textMap.get(i);
    const image = imgMap.get(i);
    if (text && image) {
      out.push({ pageNumber: i, text, image });
    }
  }
  return out;
}

// Main API
function getStorybookData() {
  const cover = collectCover();
  const pages = getStoryPairsAll();
  return { cover, pages };
}

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message in Gemini content script:", request);
  
  if (request.action === "sendPrompt") {
    sendMessage(request.prompt)
      .then(result => {
        console.log("Prompt sent successfully");
        sendResponse(result);
      })
      .catch(error => {
        console.error("Error sending prompt:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === "extractData") {
    try {
      const data = getStorybookData();
      console.log("Extracted storybook data:", data);
      
      // Validate data quality
      const isComplete = data && data.cover && data.pages && data.pages.length > 0;
      const hasValidPages = data.pages && data.pages.every(page => page.text && page.image);
      
      sendResponse({ 
        success: true, 
        data: data,
        isComplete: isComplete && hasValidPages,
        pagesCount: data.pages ? data.pages.length : 0
      });
    } catch (error) {
      console.error("Error extracting data:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (request.action === "checkPageReady") {
    try {
      const inputBox = document.querySelector("div.ql-editor[contenteditable='true']");
      const sendButton = document.querySelector("button.send-button");
      const ready = inputBox && sendButton;
      
      sendResponse({ success: true, ready: ready });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

// Log when content script is loaded
console.log("Gemini Storybook content script loaded");

// Auto-check for storybook data every few seconds
let autoCheckInterval;
function startAutoCheck() {
  if (autoCheckInterval) clearInterval(autoCheckInterval);
  
  autoCheckInterval = setInterval(() => {
    try {
      const data = getStorybookData();
      if (data && data.cover && data.pages && data.pages.length > 0) {
        console.log("Auto-detected storybook data:", data);
        // Could send message to background script or store in storage
      }
    } catch (error) {
      // Silent fail for auto-check
    }
  }, 5000);
}

// Start auto-checking when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAutoCheck);
} else {
  startAutoCheck();
}