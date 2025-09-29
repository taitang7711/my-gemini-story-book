### 0. Gửi prompt trên gemini pro
// Helper: chờ element xuất hiện
async function waitForElement(selector, timeout = 5000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(resolve => setTimeout(resolve, timeout));
  }
  throw new Error(`Không tìm thấy element: ${selector}`);
}

// Hàm nhập và gửi tin nhắn
async function sendMessage(message) {
  try {
    // #1: Chờ ô nhập (div.ql-editor)
    const inputBox = await waitForElement("div.ql-editor[contenteditable='true']", 5000, 2);

    // Xóa nội dung cũ
    inputBox.textContent = "";
    inputBox.dispatchEvent(new Event("input", { bubbles: true }));

    // Nhập giá trị mới
    inputBox.textContent = message;
    inputBox.dispatchEvent(new Event("input", { bubbles: true }));
    console.log("Đã nhập:", message);

    // #2: Chờ nút gửi
    const sendBtn = await waitForElement("button.send-button", 5000, 2);

    // Click gửi
    sendBtn.click();
    console.log("Đã click nút Gửi");
  } catch (err) {
    console.error("Lỗi:", err);
  }
}

### 0 END ###

### 1. Script trích xuất text + ảnh từ Storybook ###
// truy cập url: https://gemini.google.com/gem/storybook

// --- utils ---
function normalize(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}
function pickLonger(current, candidate) {
  return (candidate && candidate.length > (current?.length || 0)) ? candidate : current;
}

// Lấy text từ mọi right-page
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
        // Ưu tiên lấy số trang từ footer
        const footer = layer.closest(".page-content")?.querySelector(".footer-page-number");
        let pageNum = null;
        if (footer) {
          pageNum = Number(footer.textContent.trim());
        } else {
          // fallback: lấy theo data-test-id
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

// Lấy ảnh từ mọi left-page
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
        // lấy index từ data-test-id vì ảnh ít khi có footer
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

// Lấy thông tin cover
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

// Ghép text + image
function getStoryPairsAll() {
  const textMap = collectTextByIdx();
  const imgMap  = collectImageByIdx();

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

// API chính
function getStorybookData() {
  const cover = collectCover();
  const pages = getStoryPairsAll();
  return { cover, pages };
}

// --- Test ---
console.log(getStorybookData());
### 1. END ###

### 2. Script để tự động chạy TTS và lấy audio.src ###
// url thực hiện tạo. https://aistudio.google.com/generate-speech
// Helper: chờ element xuất hiện
async function waitForElement(selector, timeout = 5000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(resolve => setTimeout(resolve, timeout));
  }
  throw new Error(`Không tìm thấy element: ${selector}`);
}

// Helper: chờ nút Run bật lên (enabled)
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

// Helper: chờ label nút đổi
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

// Helper: chờ audio src xuất hiện
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

// Hàm chính
async function generateTTS({
  textInput,
  mode = "single",       // "single" hoặc "multi"
  temperature = null,    // chỉ dùng nếu mode = single
  styleInstruction = ""  // style text
}) {
  // 1. Chọn mode
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

  // 2. Nếu single → set temperature
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

  // 4. Nhập nội dung text (có chờ load với retry)
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

  // 5. Chờ nút Run khả dụng rồi click
  const runButton = await waitForRunButtonEnabled(5000, 2);
  runButton.click();
  console.log("Đã click Run");

  try {
    // 6. Chờ Stop → Run
    await waitForButtonLabel(runButton, "Stop");
    console.log("Đang xử lý...");
    await waitForButtonLabel(runButton, "Run");
    console.log("Xử lý xong, quay lại Run");

    // 7. Lấy audio src
    const audioSrc = await waitForAudioSrc();
    console.log("Audio src:", audioSrc);

    // Thêm hiển thị
    const result = document.createElement("p");
    result.textContent = "Audio src: " + audioSrc;
    document.body.appendChild(result);

    return audioSrc;
  } catch (err) {
    console.error(err);
  }
}

// Single-speaker, set temperature, có style
generateTTS({
  textInput: "Xin chào, đây là demo test",
  mode: "single",
  temperature: 1.2,
  styleInstruction: "Read this in a dramatic whisper"
});
### 2 END 

