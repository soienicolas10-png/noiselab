const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// buttons
const captureBtn = document.getElementById("capture");

// stackable filters
const enableGray = document.getElementById("enableGray");
const grayRange = document.getElementById("grayRange");
const grayValue = document.getElementById("grayValue");

const enableThreshold = document.getElementById("enableThreshold");
const thRange = document.getElementById("thRange");
const thValue = document.getElementById("thValue");

const enablePixel = document.getElementById("enablePixel");
const pixelRange = document.getElementById("pixelRange");
const pixelValue = document.getElementById("pixelValue");

const enableDither = document.getElementById("enableDither");
const ditherRange = document.getElementById("ditherRange");
const ditherValue = document.getElementById("ditherValue");

const enableTexturing = document.getElementById("enableTexturing");
const texRange = document.getElementById("texRange");
const texValue = document.getElementById("texValue");

const enableCacheTrail = document.getElementById("enableCacheTrail");
const cacheTrailRange = document.getElementById("cacheTrailRange");
const cacheTrailValue = document.getElementById("cacheTrailValue");

const enableCacheCentral = document.getElementById("enableCacheCentral");
const cacheCentralRange = document.getElementById("cacheCentralRange");
const cacheCentralValue = document.getElementById("cacheCentralValue");

const enableCacheGrid = document.getElementById("enableCacheGrid");
const cacheGridRange = document.getElementById("cacheGridRange");
const cacheGridValue = document.getElementById("cacheGridValue");

const enableCacheHGrid = document.getElementById("enableCacheHGrid");
const cacheHGridRange = document.getElementById("cacheHGridRange");
const cacheHGridValue = document.getElementById("cacheHGridValue");

// mode filters
const modeSelect = document.getElementById("modeSelect");

// per-mode sliders
const asciiRange = document.getElementById("asciiRange");
const asciiValue = document.getElementById("asciiValue");

const pixelSortRange = document.getElementById("pixelSortRange");
const pixelSortValue = document.getElementById("pixelSortValue");

const plataneRange = document.getElementById("plataneRange");
const plataneValue = document.getElementById("plataneValue");

const recursiveRange = document.getElementById("recursiveRange");
const recursiveValue = document.getElementById("recursiveValue");

const recursiveLatRange = document.getElementById("recursiveLatRange");
const recursiveLatValue = document.getElementById("recursiveLatValue");

// all mode config blocks
const modeConfigs = document.querySelectorAll(".mode-config");

// modal
const modalBG = document.getElementById("modalBG");
const saveYes = document.getElementById("saveYes");
const saveNo = document.getElementById("saveNo");
const snapshotImg = document.getElementById("snapshot");
const imageSizeLabel = document.getElementById("imageSizeLabel");

// state
let streaming = false;
let paused = false;
let stream = null;

// extra canvas
const offCanvas = document.createElement("canvas");
const offCtx = offCanvas.getContext("2d");

// cached frame for cache filters
let cachedFrame = null;

// ---------- helpers ----------

function getImageSizeFromDataURL(dataURL) {
  const base64 = dataURL.split(",")[1] || "";
  const byteLength = Math.floor(base64.length * 0.75);
  if (byteLength < 1024) return byteLength + " bytes";
  if (byteLength < 1024 * 1024) return (byteLength / 1024).toFixed(1) + " KB";
  return (byteLength / (1024 * 1024)).toFixed(2) + " MB";
}

function ensureCachedFrame(frame, w, h) {
  if (!cachedFrame || cachedFrame.width !== w || cachedFrame.height !== h) {
    cachedFrame = new ImageData(new Uint8ClampedArray(frame.data), w, h);
  }
}

// pixel-level filters
function applyGrayscale(frame, intensity) {
  const data = frame.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = r * 0.299 + g * 0.587 + b * 0.114;
    data[i]     = r * (1 - intensity) + gray * intensity;
    data[i + 1] = g * (1 - intensity) + gray * intensity;
    data[i + 2] = b * (1 - intensity) + gray * intensity;
  }
}

function applyThreshold(frame, level) {
  const data = frame.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const v = r * 0.299 + g * 0.587 + b * 0.114;
    const bw = v >= level ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = bw;
  }
}

function applyDithered(frame, w, h, contrastFactor) {
  const data = frame.data;
  const bayer4 = [
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      let gray = r * 0.299 + g * 0.587 + b * 0.114;
      gray = (gray - 128) * contrastFactor + 128;

      const threshold = (bayer4[y % 4][x % 4] + 0.5) * (255 / 16);
      const val = gray > threshold ? 255 : 0;
      data[idx] = data[idx + 1] = data[idx + 2] = val;
    }
  }
}

function applyTexturing(frame, w, h, strength) {
  const data = frame.data;
  const noiseAmp = 50 * strength;
  const patternSize = 8;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      const noise = (Math.random() - 0.5) * 2 * noiseAmp;
      r = Math.max(0, Math.min(255, r + noise));
      g = Math.max(0, Math.min(255, g + noise));
      b = Math.max(0, Math.min(255, b + noise));

      if ((x + y) % patternSize < 2) {
        r *= 0.8;
        g *= 0.8;
        b *= 0.8;
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
}

// cache-style
function applyCacheTrail(frame, w, h, strength) {
  ensureCachedFrame(frame, w, h);
  const data = frame.data;
  const prev = cachedFrame.data;
  const blended = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    blended[i]     = prev[i]     * strength + data[i]     * (1 - strength);
    blended[i + 1] = prev[i + 1] * strength + data[i + 1] * (1 - strength);
    blended[i + 2] = prev[i + 2] * strength + data[i + 2] * (1 - strength);
    blended[i + 3] = 255;
  }
  frame.data.set(blended);
  cachedFrame = new ImageData(blended, w, h);
}

function applyCacheCentral(frame, w, h, strength) {
  ensureCachedFrame(frame, w, h);
  const data = frame.data;
  const prev = cachedFrame.data;
  const blended = new Uint8ClampedArray(data.length);
  const xMin = Math.floor(w * 0.25);
  const xMax = Math.floor(w * 0.75);
  const yMin = Math.floor(h * 0.25);
  const yMax = Math.floor(h * 0.75);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inside = x >= xMin && x <= xMax && y >= yMin && y <= yMax;
      if (inside) {
        blended[i]     = prev[i]     * strength + data[i]     * (1 - strength);
        blended[i + 1] = prev[i + 1] * strength + data[i + 1] * (1 - strength);
        blended[i + 2] = prev[i + 2] * strength + data[i + 2] * (1 - strength);
      } else {
        blended[i]     = data[i];
        blended[i + 1] = data[i + 1];
        blended[i + 2] = data[i + 2];
      }
      blended[i + 3] = 255;
    }
  }
  frame.data.set(blended);
  cachedFrame = new ImageData(blended, w, h);
}

function applyCacheGrid(frame, w, h, strength) {
  ensureCachedFrame(frame, w, h);
  const data = frame.data;
  const prev = cachedFrame.data;
  const blended = new Uint8ClampedArray(data.length);
  const cellSize = Math.max(16, Math.floor(Math.min(w, h) / 10));
  for (let y = 0; y < h; y++) {
    const cellY = Math.floor(y / cellSize);
    for (let x = 0; x < w; x++) {
      const cellX = Math.floor(x / cellSize);
      const i = (y * w + x) * 4;
      const useCache = (cellX + cellY) % 2 === 0;
      if (useCache) {
        blended[i]     = prev[i]     * strength + data[i]     * (1 - strength);
        blended[i + 1] = prev[i + 1] * strength + data[i + 1] * (1 - strength);
        blended[i + 2] = prev[i + 2] * strength + data[i + 2] * (1 - strength);
      } else {
        blended[i]     = data[i];
        blended[i + 1] = data[i + 1];
        blended[i + 2] = data[i + 2];
      }
      blended[i + 3] = 255;
    }
  }
  frame.data.set(blended);
  cachedFrame = new ImageData(blended, w, h);
}

function applyCacheHGrid(frame, w, h, strength) {
  ensureCachedFrame(frame, w, h);
  const data = frame.data;
  const prev = cachedFrame.data;
  const blended = new Uint8ClampedArray(data.length);
  const bandHeight = Math.max(8, Math.floor(h / 12));
  for (let y = 0; y < h; y++) {
    const band = Math.floor(y / bandHeight);
    const useCache = band % 2 === 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (useCache) {
        blended[i]     = prev[i]     * strength + data[i]     * (1 - strength);
        blended[i + 1] = prev[i + 1] * strength + data[i + 1] * (1 - strength);
        blended[i + 2] = prev[i + 2] * strength + data[i + 2] * (1 - strength);
      } else {
        blended[i]     = data[i];
        blended[i + 1] = data[i + 1];
        blended[i + 2] = data[i + 2];
      }
      blended[i + 3] = 255;
    }
  }
  frame.data.set(blended);
  cachedFrame = new ImageData(blended, w, h);
}

// pixelate after other pixel filters
function applyPixelate(w, h, pixelSize) {
  const sw = Math.max(1, Math.floor(w / pixelSize));
  const sh = Math.max(1, Math.floor(h / pixelSize));
  offCanvas.width = sw;
  offCanvas.height = sh;
  offCtx.drawImage(canvas, 0, 0, sw, sh);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(offCanvas, 0, 0, sw, sh, 0, 0, w, h);
}

// ---------- mode filters (operate on current canvas) ----------

function applyAsciiMode(w, h) {
  const cell = parseInt(asciiRange.value, 10) || 10;
  const cols = Math.floor(w / cell);
  const rows = Math.floor(h / cell);
  if (cols <= 0 || rows <= 0) return;

  offCanvas.width = cols;
  offCanvas.height = rows;
  offCtx.drawImage(canvas, 0, 0, cols, rows);

  const img = offCtx.getImageData(0, 0, cols, rows).data;
  const chars = " .:-=+*#%@";

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "white";
  ctx.font = cell + "px monospace";
  ctx.textBaseline = "top";

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = img[i];
      const g = img[i + 1];
      const b = img[i + 2];
      const brightness = r * 0.299 + g * 0.587 + b * 0.114;
      const index = Math.floor((brightness / 255) * (chars.length - 1));
      const ch = chars[chars.length - 1 - index];
      ctx.fillText(ch, x * cell, y * cell);
    }
  }
}

function applyPixelSortMode(w, h) {
  const factor = (parseInt(pixelSortRange.value, 10) || 40) / 100;
  const sw = Math.max(32, Math.floor(w / 4));
  const sh = Math.max(24, Math.floor(h / 4));
  offCanvas.width = sw;
  offCanvas.height = sh;
  offCtx.drawImage(canvas, 0, 0, sw, sh);
  const frame = offCtx.getImageData(0, 0, sw, sh);
  const data = frame.data;
  const segmentLength = Math.max(4, Math.floor(sw * factor));
  for (let y = 0; y < sh; y++) {
    for (let start = 0; start < sw; start += segmentLength) {
      const end = Math.min(sw, start + segmentLength);
      const pixels = [];
      for (let x = start; x < end; x++) {
        const i = (y * sw + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = r * 0.299 + g * 0.587 + b * 0.114;
        pixels.push({ r, g, b, a: data[i + 3], brightness });
      }
      pixels.sort((a, b) => a.brightness - b.brightness);
      for (let x = start, idx = 0; x < end; x++, idx++) {
        const i = (y * sw + x) * 4;
        const p = pixels[idx];
        data[i] = p.r;
        data[i + 1] = p.g;
        data[i + 2] = p.b;
        data[i + 3] = p.a;
      }
    }
  }
  offCtx.putImageData(frame, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(offCanvas, 0, 0, sw, sh, 0, 0, w, h);
}

function applyPlataneMode(w, h) {
  const alpha = (parseInt(plataneRange.value, 10) || 60) / 100;
  const snapshot = ctx.getImageData(0, 0, w, h);
  ctx.putImageData(snapshot, 0, 0);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.putImageData(snapshot, 0, 0);
  ctx.restore();
}

function applyRecursiveMode(w, h) {
  const depth = parseInt(recursiveRange.value, 10) || 3;
  offCanvas.width = w;
  offCanvas.height = h;
  offCtx.drawImage(canvas, 0, 0, w, h);
  ctx.drawImage(offCanvas, 0, 0, w, h);
  for (let i = 1; i <= depth; i++) {
    const scale = 1 / (i + 1);
    const newW = w * scale;
    const newH = h * scale;
    const x = (w - newW) / 2;
    const y = (h - newH) / 2;
    ctx.drawImage(offCanvas, x, y, newW, newH);
  }
}

function applyRecursiveLatMode(w, h) {
  const depth = parseInt(recursiveLatRange.value, 10) || 3;
  offCanvas.width = w;
  offCanvas.height = h;
  offCtx.drawImage(canvas, 0, 0, w, h);
  ctx.drawImage(offCanvas, 0, 0, w, h);
  for (let i = 1; i <= depth; i++) {
    const scale = 1 / (i + 1);
    const newW = w * scale * 0.7;
    const newH = h * scale * 0.7;
    const y = (h - newH) / 2;
    ctx.drawImage(offCanvas, 0, y, newW, newH);
    ctx.drawImage(offCanvas, w - newW, y, newW, newH);
  }
}

// ---------- slider labels ----------

grayRange.addEventListener("input", () => {
  grayValue.textContent = grayRange.value + "%";
});

thRange.addEventListener("input", () => {
  thValue.textContent = thRange.value;
});

pixelRange.addEventListener("input", () => {
  pixelValue.textContent = pixelRange.value;
});

ditherRange.addEventListener("input", () => {
  ditherValue.textContent = ditherRange.value;
});

texRange.addEventListener("input", () => {
  texValue.textContent = texRange.value;
});

cacheTrailRange.addEventListener("input", () => {
  cacheTrailValue.textContent = cacheTrailRange.value;
});

cacheCentralRange.addEventListener("input", () => {
  cacheCentralValue.textContent = cacheCentralRange.value;
});

cacheGridRange.addEventListener("input", () => {
  cacheGridValue.textContent = cacheGridRange.value;
});

cacheHGridRange.addEventListener("input", () => {
  cacheHGridValue.textContent = cacheHGridRange.value;
});

asciiRange.addEventListener("input", () => {
  asciiValue.textContent = asciiRange.value;
});

pixelSortRange.addEventListener("input", () => {
  pixelSortValue.textContent = pixelSortRange.value;
});

plataneRange.addEventListener("input", () => {
  plataneValue.textContent = plataneRange.value;
});

recursiveRange.addEventListener("input", () => {
  recursiveValue.textContent = recursiveRange.value;
});

recursiveLatRange.addEventListener("input", () => {
  recursiveLatValue.textContent = recursiveLatRange.value;
});

// ---------- mode UI visibility ----------

function updateModeUI() {
  const mode = modeSelect.value;
  modeConfigs.forEach(el => {
    if (el.dataset.mode === mode) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
}

modeSelect.addEventListener("change", updateModeUI);

// ---------- camera controls ----------

captureBtn.addEventListener("click", openSavePrompt);

async function startCamera() {
  if (streaming) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: "environment" } }
    });
  } catch (e) {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
  }
  video.srcObject = stream;
  video.play();
  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    streaming = true;
    paused = false;
    cachedFrame = null;
    drawLoop();
  };
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  streaming = false;
  paused = false;
  cachedFrame = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ---------- main render loop ----------

function drawLoop() {
  if (!streaming || paused) return;

  const w = canvas.width;
  const h = canvas.height;

  // 1) base frame
  ctx.drawImage(video, 0, 0, w, h);

  // 2) pixel-based stackable filters
  let frame = ctx.getImageData(0, 0, w, h);

  if (enableGray.checked) {
    const intensity = (parseInt(grayRange.value, 10) || 100) / 100;
    applyGrayscale(frame, intensity);
  }

  if (enableThreshold.checked) {
    const level = parseInt(thRange.value, 10) || 128;
    applyThreshold(frame, level);
  }

  if (enableDither.checked) {
    const contrastFactor = (parseInt(ditherRange.value, 10) || 100) / 100;
    applyDithered(frame, w, h, contrastFactor);
  }

  if (enableTexturing.checked) {
    const strength = (parseInt(texRange.value, 10) || 30) / 100;
    applyTexturing(frame, w, h, strength);
  }

  if (enableCacheTrail.checked) {
    const strength = (parseInt(cacheTrailRange.value, 10) || 50) / 100;
    applyCacheTrail(frame, w, h, strength);
  }

  if (enableCacheCentral.checked) {
    const strength = (parseInt(cacheCentralRange.value, 10) || 50) / 100;
    applyCacheCentral(frame, w, h, strength);
  }

  if (enableCacheGrid.checked) {
    const strength = (parseInt(cacheGridRange.value, 10) || 50) / 100;
    applyCacheGrid(frame, w, h, strength);
  }

  if (enableCacheHGrid.checked) {
    const strength = (parseInt(cacheHGridRange.value, 10) || 50) / 100;
    applyCacheHGrid(frame, w, h, strength);
  }

  ctx.putImageData(frame, 0, 0);

  // 3) pixelation after all other stackable filters
  if (enablePixel.checked) {
    const pxSize = parseInt(pixelRange.value, 10) || 12;
    applyPixelate(w, h, pxSize);
  }

  // 4) mode filter on top
  const mode = modeSelect.value;
  if (mode === "ascii") {
    applyAsciiMode(w, h);
  } else if (mode === "pixelSort") {
    applyPixelSortMode(w, h);
  } else if (mode === "platane") {
    applyPlataneMode(w, h);
  } else if (mode === "recursive") {
    applyRecursiveMode(w, h);
  } else if (mode === "recursiveLateral") {
    applyRecursiveLatMode(w, h);
  }

  requestAnimationFrame(drawLoop);
}

// ---------- capture / modal ----------

function openSavePrompt() {
  if (!streaming) return;
  paused = true;
  const dataURL = canvas.toDataURL("image/png");
  snapshotImg.src = dataURL;
  imageSizeLabel.textContent = "Image Size: " + getImageSizeFromDataURL(dataURL);
  modalBG.style.display = "flex";
}

saveNo.addEventListener("click", () => {
  modalBG.style.display = "none";
  paused = false;
  if (streaming) drawLoop();
});

saveYes.addEventListener("click", () => {
  modalBG.style.display = "none";
  saveImage();
  paused = false;
  if (streaming) drawLoop();
});

function saveImage() {
  const link = document.createElement("a");
  link.download = "camera-filter-image.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// initialize mode UI and auto-start camera on load
window.addEventListener("load", () => {
  updateModeUI();
  startCamera();
});
