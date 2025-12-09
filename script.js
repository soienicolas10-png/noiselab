// ===== DOM ELEMENTS =====
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const customCursor = document.getElementById("customCursor");
const kbDisplay = document.getElementById("kbDisplay");
const shutterKbLabel = document.getElementById("shutterKbLabel");

const captureBtn = document.getElementById("capture");
const modeToggleBtn = document.getElementById("modeToggleBtn");
const fpsBtn = document.getElementById("fpsBtn");
const fpsIndicator = document.getElementById("fpsIndicator");
const fpsValue = document.getElementById("fpsValue");
const filtersBtn = document.getElementById("filtersBtn");
const flipCameraBtn = document.getElementById("flipCamera");
const filtersOverlay = document.getElementById("filtersOverlay");
const filtersPanel = filtersOverlay ? filtersOverlay.querySelector(".filters-panel") : null;
const filtersBackdrop = filtersOverlay ? filtersOverlay.querySelector(".filters-backdrop") : null;
const closeFilters = document.getElementById("closeFilters");
const recIndicator = document.getElementById("recIndicator");
const recSize = document.getElementById("recSize");

// Mode controls
const modeSelect = document.getElementById("modeSelect");
const asciiVariant = document.getElementById("asciiVariant");
const pointShape = document.getElementById("pointShape") || { value: "circle" };
const modeConfigs = document.querySelectorAll(".mode-config");

// Optional selects (safe even if not in HTML)
const paletteAlgoSelectEl = document.getElementById("paletteAlgo");
const paletteAlgoSelect = paletteAlgoSelectEl || { value: "median" }; // default
const halftoneTypeSelectEl = document.getElementById("halftoneType");
const halftoneTypeSelect = halftoneTypeSelectEl || { value: "mono" };

// All filter controls
const filters = {
  gray:          { enable: "enableGray",          range: "grayRange",          value: "grayValue",          suffix: "%" },
  bitmap:        { enable: "enableBitmap",        range: "bitmapRange",        value: "bitmapValue" },
  dither:        { enable: "enableDither",        range: "ditherRange",        value: "ditherValue" },
  blur:          { enable: "enableBlur",          range: "blurRange",          value: "blurValue" },
  poster:        { enable: "enablePoster",        range: "posterRange",        value: "posterValue" },
  voronoi:       { enable: "enableVoronoi",       range: "voronoiRange",       value: "voronoiValue" },
  lowpoly:       { enable: "enableLowpoly",       range: "lowpolyRange",       value: "lowpolyValue" },
  point:         { enable: "enablePoint",         range: "pointRange",         value: "pointValue" },
  halftone:      { enable: "enableHalftone",      range: "halftoneRange",      value: "halftoneValue" },
  mezzo:         { enable: "enableMezzo",         range: "mezzoRange",         value: "mezzoValue" },
  contour:       { enable: "enableContour",       range: "contourRange",       value: "contourValue" },
  edges:         { enable: "enableEdges",         range: "edgesRange",         value: "edgesValue" },
  pixelSort:     { enable: "enablePixelSort",     range: "pixelSortRange",     value: "pixelSortValue" },
  pixel:         { enable: "enablePixel",         range: "pixelRange",         value: "pixelValue" },
  pixelStretch:  { enable: "enablePixelStretch",  range: "pixelStretchRange",  value: "pixelStretchValue" },
  blobs:         { enable: "enableBlobs",         range: "blobsRange",         value: "blobsValue" },
  palette:       { enable: "enablePalette",       range: "paletteRange",       value: "paletteValue" }
};

const filterEls = {};
Object.keys(filters).forEach(key => {
  const f = filters[key];
  filterEls[key] = {
    enable: document.getElementById(f.enable),
    range: document.getElementById(f.range),
    valueEl: document.getElementById(f.value),
    suffix: f.suffix || ""
  };
});

// Modal elements
const modalBG = document.getElementById("modalBG");
const saveNo = document.getElementById("saveNo");
const snapshotImg = document.getElementById("snapshot");
const videoPreview = document.getElementById("videoPreview");
const imageSizeLabel = document.getElementById("imageSizeLabel");

const formatButtonsContainer = document.getElementById("imageFormatButtons");
const saveJpegBtn = document.getElementById("saveJPEG");
const savePngBtn  = document.getElementById("savePNG");
const saveWebpBtn = document.getElementById("saveWEBP");
const saveVideoBtn = document.getElementById("saveVideo");

// ===== STATE =====
let streaming = false;
let paused = false;
let stream = null;
let useFrontCamera = false;

let isVideoMode = false;  // false = photo, true = video
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;

// FPS options
const fpsOptions = [5, 12, 24];
let currentFpsIndex = 2; // default 24 FPS

// Recording size tracking
let recordingSize = 0;

// Current KB size for display
let currentKBSize = "-- KB";

// Image blobs for current capture
let currentJpegBlob = null;
let currentPngBlob  = null;
let currentWebpBlob = null;

// Extra canvases
const offCanvas = document.createElement("canvas");
const offCtx = offCanvas.getContext("2d");
const tempCanvas = document.createElement("canvas");
const tempCtx = tempCanvas.getContext("2d");

// Snapshot canvas (for freezing frame)
const snapshotCanvas = document.createElement("canvas");
const snapshotCtx = snapshotCanvas.getContext("2d");

// Voronoi points cache (cells stay stable while sliders unchanged)
let voronoiPoints = [];
let lastVoronoiCount = 0;

// Low poly / pixel stretch caches (to freeze them)
let lowPolyPointsCache = null;
let lowPolyLastSize = null;
let lowPolyLastW = 0;
let lowPolyLastH = 0;

let pixelStretchRowStarts = null;
let pixelStretchLastAmount = null;
let pixelStretchLastW = 0;
let pixelStretchLastH = 0;

// Palette reduce: stable palette, but image still moves
let paletteCurrent = null;
let paletteParams = { colorsCount: null, algo: null, w: 0, h: 0 };

// ===== CUSTOM CURSOR (desktop) =====
document.addEventListener("mousemove", (e) => {
  if (!customCursor) return;
  customCursor.style.left = e.clientX + "px";
  customCursor.style.top = e.clientY + "px";
});

document.addEventListener("mousedown", () => {
  if (!customCursor) return;
  customCursor.classList.add("clicking");
});

document.addEventListener("mouseup", () => {
  if (!customCursor) return;
  customCursor.classList.remove("clicking");
});

document.addEventListener("mouseover", (e) => {
  if (!customCursor) return;
  const target = e.target;
  if (target.matches('button, a, input, select, label, .toggle-switch')) {
    customCursor.classList.add("hovering");
  }
});

document.addEventListener("mouseout", (e) => {
  if (!customCursor) return;
  const target = e.target;
  if (target.matches('button, a, input, select, label, .toggle-switch')) {
    customCursor.classList.remove("hovering");
  }
});

// ===== iOS DETECTION & BEHAVIOR =====
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function setupIOSFeatures() {
  if (isIOS()) {
    if (flipCameraBtn) flipCameraBtn.classList.add("ios-visible");
    document.body.classList.add("ios");
  }
}

// ===== FILTERS OVERLAY OPEN/CLOSE =====
function openFiltersOverlay() {
  if (!filtersOverlay) return;
  filtersOverlay.classList.add("open");
  filtersOverlay.setAttribute("aria-hidden", "false");
}

function closeFiltersOverlay() {
  if (!filtersOverlay) return;
  filtersOverlay.classList.remove("open");
  filtersOverlay.setAttribute("aria-hidden", "true");
}

// Open when user clicks the Filters button
if (filtersBtn) {
  filtersBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openFiltersOverlay();
  });
}

// Close when user clicks the ✕ button
if (closeFilters) {
  closeFilters.addEventListener("click", (e) => {
    e.stopPropagation();
    closeFiltersOverlay();
  });
}

// Close when clicking the backdrop (outside), NOT on touch
if (filtersBackdrop) {
  const backdropHandler = (e) => {
    e.stopPropagation();
    closeFiltersOverlay();
  };
  filtersBackdrop.addEventListener("mousedown", backdropHandler);
}

// ===== UI EVENTS =====
Object.keys(filterEls).forEach(key => {
  const f = filterEls[key];
  if (f.range && f.valueEl) {
    f.range.addEventListener("input", () => {
      f.valueEl.textContent = f.range.value + f.suffix;
    });
  }
});

// ASCII cell size label
const asciiRange = document.getElementById("asciiRange");
if (asciiRange) {
  asciiRange.addEventListener("input", (e) => {
    const asciiValue = document.getElementById("asciiValue");
    if (asciiValue) asciiValue.textContent = e.target.value;
  });
}

// Mode UI visibility for extra configs
function updateModeUI() {
  const mode = modeSelect ? modeSelect.value : "none";

  modeConfigs.forEach(el => {
    const configMode = el.dataset.mode;
    let show = false;

    if (configMode === mode) show = true;
    if (configMode === "pointillism" && filterEls.point.enable && filterEls.point.enable.checked) show = true;
    if (configMode === "palette" && filterEls.palette.enable && filterEls.palette.enable.checked) show = true;
    if (configMode === "halftone" && filterEls.halftone.enable && filterEls.halftone.enable.checked) show = true;

    if (show) el.classList.add("active");
    else el.classList.remove("active");
  });
}

if (filterEls.point.enable) {
  filterEls.point.enable.addEventListener("change", updateModeUI);
}
if (filterEls.palette.enable) {
  filterEls.palette.enable.addEventListener("change", () => {
    paletteCurrent = null;
    updateModeUI();
  });
}
if (filterEls.halftone.enable) {
  filterEls.halftone.enable.addEventListener("change", updateModeUI);
}
if (modeSelect) {
  modeSelect.addEventListener("change", updateModeUI);
}

// Palette recompute when controls change
if (filterEls.palette.range) {
  filterEls.palette.range.addEventListener("input", () => {
    paletteCurrent = null;
  });
}
if (paletteAlgoSelectEl) {
  paletteAlgoSelectEl.addEventListener("change", () => {
    paletteCurrent = null;
  });
}

// ===== BLUR VIA CSS (iOS-SAFE) =====
const blurFilter = filterEls.blur || null;

function updateCanvasBlur() {
  if (!blurFilter || !canvas) return;
  const enabled = blurFilter.enable && blurFilter.enable.checked;
  if (!enabled) {
    canvas.style.filter = "";
    canvas.classList.remove("blur-enabled");
    return;
  }
  const radius = parseInt(blurFilter.range.value, 10) || 0;
  canvas.classList.add("blur-enabled");
  canvas.style.filter = `blur(${radius}px)`;
}

if (blurFilter && blurFilter.enable) {
  blurFilter.enable.addEventListener("change", updateCanvasBlur);
}
if (blurFilter && blurFilter.range) {
  blurFilter.range.addEventListener("input", updateCanvasBlur);
}

// ===== FILTER IMPLEMENTATIONS =====
function applyGrayscale(data, intensity) {
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
    data[i]   = data[i]   * (1 - intensity) + gray * intensity;
    data[i+1] = data[i+1] * (1 - intensity) + gray * intensity;
    data[i+2] = data[i+2] * (1 - intensity) + gray * intensity;
  }
}

function applyBitmap(data, threshold) {
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
    const val = gray >= threshold ? 255 : 0;
    data[i] = data[i+1] = data[i+2] = val;
  }
}

function applyDithered(data, w, h, contrast) {
  const bayer = [
    [0, 8, 2,10],
    [12,4,14,6],
    [3,11,1, 9],
    [15,7,13,5]
  ];
  const factor = contrast / 100;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let gray = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
      gray = (gray - 128) * factor + 128;
      const threshold = (bayer[y % 4][x % 4] + 0.5) * 16;
      const val = gray > threshold ? 255 : 0;
      data[i] = data[i+1] = data[i+2] = val;
    }
  }
}

function applyPosterize(data, levels) {
  const step = 255 / (levels - 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i]   = Math.round(data[i]   / step) * step;
    data[i+1] = Math.round(data[i+1] / step) * step;
    data[i+2] = Math.round(data[i+2] / step) * step;
  }
}

function applyPixelStretch(data, w, h, amount) {
  if (
    !pixelStretchRowStarts ||
    pixelStretchLastAmount !== amount ||
    pixelStretchLastW !== w ||
    pixelStretchLastH !== h
  ) {
    pixelStretchRowStarts = new Array(h);
    for (let y = 0; y < h; y++) {
      pixelStretchRowStarts[y] = Math.floor(Math.random() * w);
    }
    pixelStretchLastAmount = amount;
    pixelStretchLastW = w;
    pixelStretchLastH = h;
  }

  const stretch = Math.max(1, Math.floor((w * amount) / 100));

  for (let y = 0; y < h; y++) {
    const rowStart = y * w * 4;
    const x0 = pixelStretchRowStarts[y];
    const i0 = rowStart + x0 * 4;
    const r = data[i0], g = data[i0 + 1], b = data[i0 + 2], a = data[i0 + 3];

    for (let x = x0; x < Math.min(w, x0 + stretch); x++) {
      const i = rowStart + x * 4;
      data[i]   = r;
      data[i+1] = g;
      data[i+2] = b;
      data[i+3] = a;
    }
  }
}

function applyVoronoi(data, w, h, numPoints) {
  const actualPoints = Math.max(5, Math.min(2000, numPoints | 0));

  if (voronoiPoints.length !== actualPoints || lastVoronoiCount !== actualPoints) {
    voronoiPoints = [];
    for (let i = 0; i < actualPoints; i++) {
      voronoiPoints.push({ x: Math.random() * w, y: Math.random() * h });
    }
    lastVoronoiCount = actualPoints;
  }

  const copy = new Uint8ClampedArray(data);
  const cellColors = voronoiPoints.map(p => {
    const px = Math.max(0, Math.min(w - 1, Math.floor(p.x)));
    const py = Math.max(0, Math.min(h - 1, Math.floor(p.y)));
    const i = (py * w + px) * 4;
    return { r: copy[i], g: copy[i+1], b: copy[i+2] };
  });

  const step = actualPoints < 50 ? 1 : actualPoints < 200 ? 2 : actualPoints < 500 ? 3 : 4;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      let minDist = Infinity;
      let closestIdx = 0;
      for (let pi = 0; pi < voronoiPoints.length; pi++) {
        const p = voronoiPoints[pi];
        const dist = (x - p.x) ** 2 + (y - p.y) ** 2;
        if (dist < minDist) {
          minDist = dist;
          closestIdx = pi;
        }
      }

      const c = cellColors[closestIdx];

      for (let dy = 0; dy < step && y + dy < h; dy++) {
        for (let dx = 0; dx < step && x + dx < w; dx++) {
          const i = ((y + dy) * w + (x + dx)) * 4;
          data[i]   = c.r;
          data[i+1] = c.g;
          data[i+2] = c.b;
        }
      }
    }
  }
}

function applyLowPoly(ctx, w, h, size) {
  if (
    !lowPolyPointsCache ||
    lowPolyLastSize !== size ||
    lowPolyLastW !== w ||
    lowPolyLastH !== h
  ) {
    lowPolyPointsCache = [];
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        lowPolyPointsCache.push({
          x: x + (Math.random() - 0.5) * size * 0.5,
          y: y + (Math.random() - 0.5) * size * 0.5
        });
      }
    }
    lowPolyLastSize = size;
    lowPolyLastW = w;
    lowPolyLastH = h;
  }

  tempCanvas.width = w;
  tempCanvas.height = h;
  tempCtx.drawImage(canvas, 0, 0);
  const imgData = tempCtx.getImageData(0, 0, w, h).data;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  const points = lowPolyPointsCache;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1] || points[0];
    const p3 = points[Math.min(i + Math.floor(w / size), points.length - 1)];

    const cx = (p1.x + p2.x + p3.x) / 3;
    const cy = (p1.y + p2.y + p3.y) / 3;
    const ci = (Math.floor(cy) * w + Math.floor(cx)) * 4;

    ctx.fillStyle = `rgb(${imgData[ci]},${imgData[ci+1]},${imgData[ci+2]})`;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fill();
  }
}

function applyPointillism(ctx, w, h, dotSize, shape) {
  tempCanvas.width = w;
  tempCanvas.height = h;
  tempCtx.drawImage(canvas, 0, 0);
  const imgData = tempCtx.getImageData(0, 0, w, h).data;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += dotSize) {
    for (let x = 0; x < w; x += dotSize) {
      const i = (y * w + x) * 4;
      ctx.fillStyle = `rgb(${imgData[i]},${imgData[i+1]},${imgData[i+2]})`;

      if (shape === 'rectangle') {
        ctx.fillRect(x + 1, y + 1, dotSize - 2, dotSize - 2);
      } else if (shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(x + dotSize/2, y);
        ctx.lineTo(x + dotSize, y + dotSize);
        ctx.lineTo(x, y + dotSize);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x + dotSize/2, y + dotSize/2, dotSize/2 - 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function applyHalftoneMono(data, w, h, dotSize) {
  const copy = new Uint8ClampedArray(data);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i+1] = data[i+2] = 255;
  }

  for (let cy = 0; cy < h; cy += dotSize) {
    for (let cx = 0; cx < w; cx += dotSize) {
      let gray = 0;
      let count = 0;
      for (let y = cy; y < Math.min(cy + dotSize, h); y++) {
        for (let x = cx; x < Math.min(cx + dotSize, w); x++) {
          const i = (y * w + x) * 4;
          gray += copy[i] * 0.299 + copy[i+1] * 0.587 + copy[i+2] * 0.114;
          count++;
        }
      }
      gray /= count;
      const radius = Math.floor((1 - gray / 255) * dotSize / 2);
      const centerX = cx + dotSize / 2;
      const centerY = cy + dotSize / 2;

      for (let y = cy; y < Math.min(cy + dotSize, h); y++) {
        for (let x = cx; x < Math.min(cx + dotSize, w); x++) {
          if (Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) <= radius) {
            const i = (y * w + x) * 4;
            data[i] = data[i+1] = data[i+2] = 0;
          }
        }
      }
    }
  }
}

function applyHalftoneRGB(ctx, w, h, dotSize) {
  tempCanvas.width = w;
  tempCanvas.height = h;
  tempCtx.drawImage(canvas, 0, 0);
  const src = tempCtx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const dataOut = out.data;
  const data = src.data;

  const angles = [0, Math.PI/4, -Math.PI/4];
  const channelIndex = [0,1,2];

  for (let i = 0; i < dataOut.length; i += 4) {
    dataOut[i] = dataOut[i+1] = dataOut[i+2] = 255;
    dataOut[i+3] = 255;
  }

  for (let ch = 0; ch < 3; ch++) {
    const angle = angles[ch];
    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);

    for (let y = 0; y < h; y += dotSize) {
      for (let x = 0; x < w; x += dotSize) {
        const i = (y * w + x) * 4;
        const v = data[i + channelIndex[ch]];

        const radius = (1 - v / 255) * dotSize / 2;

        const cx = x + dotSize / 2 + cosA * dotSize/4;
        const cy = y + dotSize / 2 + sinA * dotSize/4;

        for (let yy = y; yy < Math.min(y + dotSize, h); yy++) {
          for (let xx = x; xx < Math.min(x + dotSize, w); xx++) {
            if (Math.sqrt((xx - cx)**2 + (yy - cy)**2) <= radius) {
              const oi = (yy * w + xx) * 4;
              dataOut[oi + ch] = Math.min(dataOut[oi + ch], 0);
            }
          }
        }
      }
    }
  }

  ctx.putImageData(out, 0, 0);
}

function applyMezzotint(data, w, h, density) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const gray = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
      const pattern = ((x + y) % density === 0) ? 1 : 0;
      const threshold = pattern ? 128 - density * 10 : 128 + density * 10;
      const val = gray > threshold ? 255 : 0;
      data[i] = data[i+1] = data[i+2] = val;
    }
  }
}

function applyContour(data, w, h, levels) {
  const numLevels = Math.max(2, Math.floor(levels / 10));
  const step = 255 / numLevels;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
    const v = Math.round(gray / step) * step;
    data[i] = data[i+1] = data[i+2] = v;
  }

  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const current = copy[i];
      const right   = copy[(y * w + x + 1) * 4];
      const bottom  = copy[((y + 1) * w + x) * 4];
      data[i] = data[i+1] = data[i+2] =
        (current !== right || current !== bottom) ? 0 : 255;
    }
  }
}

function applyEdges(data, w, h, threshold) {
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      let gx = 0, gy = 0;
      for (let c = 0; c < 3; c++) {
        const tl = copy[((y-1) * w + (x-1)) * 4 + c];
        const t  = copy[((y-1) * w + x)      * 4 + c];
        const tr = copy[((y-1) * w + (x+1))  * 4 + c];
        const l  = copy[(y * w + (x-1))      * 4 + c];
        const r  = copy[(y * w + (x+1))      * 4 + c];
        const bl = copy[((y+1) * w + (x-1))  * 4 + c];
        const b  = copy[((y+1) * w + x)      * 4 + c];
        const br = copy[((y+1) * w + (x+1))  * 4 + c];
        gx += (-tl + tr - 2*l + 2*r - bl + br);
        gy += (-tl - 2*t - tr + bl + 2*b + br);
      }
      const mag = Math.sqrt(gx*gx + gy*gy) / 3;
      data[i] = data[i+1] = data[i+2] =
        mag > threshold * 2.55 ? 255 : 0;
    }
  }
}

function applyPixelSort(data, w, h, factor) {
  const segmentLength = Math.max(4, Math.floor(w * factor / 100));

  for (let y = 0; y < h; y++) {
    for (let start = 0; start < w; start += segmentLength) {
      const end = Math.min(w, start + segmentLength);
      const pixels = [];
      for (let x = start; x < end; x++) {
        const i = (y * w + x) * 4;
        pixels.push({
          r: data[i],
          g: data[i+1],
          b: data[i+2],
          a: data[i+3],
          brightness: data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114
        });
      }
      pixels.sort((a, b) => a.brightness - b.brightness);
      for (let x = start, idx = 0; x < end; x++, idx++) {
        const i = (y * w + x) * 4;
        const p = pixels[idx];
        data[i]   = p.r;
        data[i+1] = p.g;
        data[i+2] = p.b;
        data[i+3] = p.a;
      }
    }
  }
}

function applyPixelate(w, h, pixelSize) {
  const sw = Math.max(1, Math.floor(w / pixelSize));
  const sh = Math.max(1, Math.floor(h / pixelSize));
  offCanvas.width = sw;
  offCanvas.height = sh;
  offCtx.imageSmoothingEnabled = false;
  offCtx.drawImage(canvas, 0, 0, sw, sh);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(offCanvas, 0, 0, sw, sh, 0, 0, w, h);
}

function applyAbstractBlobs(ctx, w, h, strength) {
  const scale = Math.max(4, strength | 0);
  const smallW = Math.max(1, Math.floor(w / scale));
  const smallH = Math.max(1, Math.floor(h * (smallW / w)));

  offCanvas.width = smallW;
  offCanvas.height = smallH;

  offCtx.clearRect(0, 0, smallW, smallH);
  offCtx.drawImage(canvas, 0, 0, smallW, smallH);

  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(offCanvas, 0, 0, smallW, smallH, 0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
}

// ===== PALETTE HELPERS =====
function samplePixels(data, step) {
  const samples = [];
  for (let i = 0; i < data.length; i += 4 * step) {
    samples.push([data[i], data[i+1], data[i+2]]);
  }
  return samples;
}

function buildPaletteMedianCut(colors, maxColors) {
  if (!colors.length) return [];

  let boxes = [{
    colors,
    rMin: 0, rMax: 255,
    gMin: 0, gMax: 255,
    bMin: 0, bMax: 255
  }];

  function updateBox(box) {
    let rMin = 255, rMax = 0,
        gMin = 255, gMax = 0,
        bMin = 255, bMax = 0;
    box.colors.forEach(([r,g,b]) => {
      if (r < rMin) rMin = r;
      if (r > rMax) rMax = r;
      if (g < gMin) gMin = g;
      if (g > gMax) gMax = g;
      if (b < bMin) bMin = b;
      if (b > bMax) bMax = b;
    });
    box.rMin = rMin; box.rMax = rMax;
    box.gMin = gMin; box.gMax = gMax;
    box.bMin = bMin; box.bMax = bMax;
  }

  updateBox(boxes[0]);

  while (boxes.length < maxColors) {
    boxes.sort((a,b) => {
      const aRange = Math.max(a.rMax-a.rMin, a.gMax-a.gMin, a.bMax-a.bMin);
      const bRange = Math.max(b.rMax-b.rMin, b.gMax-b.gMin, b.bMax-b.bMin);
      return bRange - aRange;
    });
    const box = boxes.shift();
    if (!box || box.colors.length <= 1) break;

    const rRange = box.rMax - box.rMin;
    const gRange = box.gMax - box.gMin;
    const bRange = box.bMax - box.bMin;
    let channel = 0;
    if (gRange >= rRange && gRange >= bRange) channel = 1;
    else if (bRange >= rRange && bRange >= gRange) channel = 2;

    box.colors.sort((c1, c2) => c1[channel] - c2[channel]);
    const mid = box.colors.length >> 1;
    const box1 = { colors: box.colors.slice(0, mid) };
    const box2 = { colors: box.colors.slice(mid) };
    updateBox(box1);
    updateBox(box2);
    boxes.push(box1, box2);
  }

  return boxes.map(box => {
    let r = 0, g = 0, b = 0;
    box.colors.forEach(c => {
      r += c[0]; g += c[1]; b += c[2];
    });
    const len = box.colors.length || 1;
    return [r/len, g/len, b/len];
  });
}

function buildPaletteKMeans(colors, k) {
  if (colors.length === 0) return [];

  const centroids = [];
  for (let i = 0; i < k; i++) {
    centroids.push(colors[(i * Math.floor(colors.length / k)) % colors.length].slice());
  }

  const maxIter = 5;
  for (let iter = 0; iter < maxIter; iter++) {
    const clusters = Array.from({length: k}, () => []);
    colors.forEach(c => {
      let best = 0, bestDist = Infinity;
      for (let i = 0; i < k; i++) {
        const d =
          (c[0]-centroids[i][0])**2 +
          (c[1]-centroids[i][1])**2 +
          (c[2]-centroids[i][2])**2;
        if (d < bestDist) { bestDist = d; best = i; }
      }
      clusters[best].push(c);
    });
    for (let i = 0; i < k; i++) {
      const cluster = clusters[i];
      if (!cluster.length) continue;
      let r = 0, g = 0, b = 0;
      cluster.forEach(c => { r+=c[0]; g+=c[1]; b+=c[2]; });
      centroids[i] = [r/cluster.length, g/cluster.length, b/cluster.length];
    }
  }
  return centroids;
}

function buildPaletteOctree(colors, maxColors) {
  const buckets = new Map();
  colors.forEach(([r,g,b]) => {
    const key = ((r>>3)<<10) | ((g>>3)<<5) | (b>>3);
    let ent = buckets.get(key);
    if (!ent) {
      ent = { r:0,g:0,b:0,count:0 };
      buckets.set(key, ent);
    }
    ent.r += r; ent.g += g; ent.b += b; ent.count++;
  });

  let palette = Array.from(buckets.values()).map(ent => [
    ent.r/ent.count, ent.g/ent.count, ent.b/ent.count
  ]);

  if (palette.length > maxColors) {
    palette = palette.slice(0, maxColors);
  }
  return palette;
}

function buildPaletteFromCanvas(w, h, colorsCount, algo) {
  const smallW = 160;
  const smallH = Math.max(1, Math.round(h * (smallW / w)));

  offCanvas.width = smallW;
  offCanvas.height = smallH;
  offCtx.drawImage(canvas, 0, 0, smallW, smallH);
  const img = offCtx.getImageData(0, 0, smallW, smallH);
  const samples = samplePixels(img.data, 4);
  const k = Math.max(2, Math.min(colorsCount, 64));

  if (algo === "kmeans") return buildPaletteKMeans(samples, k);
  if (algo === "octree") return buildPaletteOctree(samples, k);
  return buildPaletteMedianCut(samples, k);
}

function applyPaletteQuantization(data, palette) {
  if (!palette || !palette.length) return;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    let best = 0, bestDist = Infinity;
    for (let p = 0; p < palette.length; p++) {
      const [pr, pg, pb] = palette[p];
      const d = (r-pr)**2 + (g-pg)**2 + (b-pb)**2;
      if (d < bestDist) { bestDist = d; best = p; }
    }
    const [pr, pg, pb] = palette[best];
    data[i]   = pr;
    data[i+1] = pg;
    data[i+2] = pb;
  }
}

// ===== ASCII MODE =====
function applyAsciiMode(w, h) {
  const cell = asciiRange ? parseInt(asciiRange.value, 10) || 8 : 8;
  const variant = asciiVariant ? asciiVariant.value : "classic";
  const cols = Math.floor(w / cell);
  const rows = Math.floor(h / cell);
  if (cols <= 0 || rows <= 0) return;

  offCanvas.width = cols;
  offCanvas.height = rows;
  offCtx.drawImage(canvas, 0, 0, cols, rows);
  const img = offCtx.getImageData(0, 0, cols, rows).data;

  let chars;
  switch (variant) {
    case 'braille':     chars = "⠀⠁⠃⠇⠏⠟⠿⡿⣿"; break;
    case 'blocks':      chars = " ░▒▓█"; break;
    case 'punctuation': chars = " .,:;!?#@"; break;
    case 'unicode':     chars = " ·∙●◉◎○"; break;
    case 'ansi':        chars = " ░▒▓█"; break;
    default:            chars = " .:-=+*#%@";
  }

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.font = `${cell}px monospace`;
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

      ctx.fillStyle = variant === 'ansi' ? `rgb(${r},${g},${b})` : "#fff";
      ctx.fillText(ch, x * cell, y * cell);
    }
  }
}

// ===== CAMERA CONTROL & MODE TOGGLE =====
if (flipCameraBtn) {
  flipCameraBtn.addEventListener("click", async () => {
    useFrontCamera = !useFrontCamera;
    await stopCamera();
    await startCamera();
  });
}

// Mode toggle (photo / video)
modeToggleBtn.addEventListener("click", () => {
  if (isRecording) return;
  isVideoMode = !isVideoMode;

  modeToggleBtn.classList.toggle("video-mode", isVideoMode);
  captureBtn.classList.toggle("video-mode", isVideoMode);

  fpsBtn.classList.toggle("visible", isVideoMode);
  fpsIndicator.classList.toggle("visible", isVideoMode);
});

// FPS button
fpsBtn.addEventListener("click", () => {
  if (isRecording) return;
  currentFpsIndex = (currentFpsIndex + 1) % fpsOptions.length;
  const fps = fpsOptions[currentFpsIndex];
  fpsValue.textContent = fps + " FPS";
  fpsBtn.textContent = fps + " FPS";
});

// Capture button
captureBtn.addEventListener("click", () => {
  if (!streaming) return;

  if (isVideoMode) {
    if (isRecording) stopRecording();
    else startRecording();
  } else {
    capturePhoto();
  }
});

// Video recording
function startRecording() {
  if (!MediaRecorder || !canvas.captureStream) {
    alert("Video recording not supported in this browser.");
    return;
  }

  if (typeof MediaRecorder.isTypeSupported === "function" &&
      !MediaRecorder.isTypeSupported("video/webm")) {
    alert("Video recording (WEBM) not supported in this browser.");
    return;
  }

  const fps = fpsOptions[currentFpsIndex];
  recordedChunks = [];
  recordingSize = 0;
  recSize.textContent = "0 KB";

  const canvasStream = canvas.captureStream(fps);
  mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm' });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      recordedChunks.push(e.data);
      recordingSize += e.data.size;
      recSize.textContent = formatFileSize(recordingSize);
    }
  };

  mediaRecorder.onstop = () => {
    recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
    openVideoSavePrompt();
  };

  mediaRecorder.start(500);
  isRecording = true;
  recIndicator.classList.add("recording");
  captureBtn.classList.add("recording");
  captureBtn.classList.remove("video-mode");
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    recIndicator.classList.remove("recording");
    captureBtn.classList.remove("recording");
    captureBtn.classList.add("video-mode");
    recSize.textContent = "";
  }
}

// Camera start/stop
async function startCamera() {
  if (streaming) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#d80000";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Camera not supported", canvas.width/2, canvas.height/2);
    return;
  }

  video.setAttribute('autoplay', '');
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.muted = true;
  video.playsInline = true;

  try {
    const constraints = {
      video: {
        facingMode: useFrontCamera ? "user" : "environment",
        width:  { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;

    await new Promise((resolve, reject) => {
      video.oncanplay = resolve;
      video.onerror = reject;
      setTimeout(resolve, 5000);
    });

    try { await video.play(); } catch (e) {}

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    streaming = true;
    paused = false;
    requestAnimationFrame(drawLoop);
  } catch (err) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      video.srcObject = stream;
      await new Promise(r => {
        video.oncanplay = r;
        setTimeout(r, 3000);
      });
      try { await video.play(); } catch (e) {}
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      streaming = true;
      paused = false;
      requestAnimationFrame(drawLoop);
    } catch (fallbackErr) {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#d80000";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Camera error. Allow access and refresh.", canvas.width/2, canvas.height/2);
    }
  }
}

function stopCamera() {
  return new Promise((resolve) => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    video.srcObject = null;
    streaming = false;
    paused = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    resolve();
  });
}

// ===== RENDER LOOP =====
let kbUpdateCounter = 0;

function updateKBDisplay() {
  if (isVideoMode && isRecording) {
    const sizeStr = formatFileSize(recordingSize);
    kbDisplay.textContent = sizeStr;
    if (shutterKbLabel) shutterKbLabel.textContent = sizeStr;
    return;
  }

  kbUpdateCounter++;
  if (kbUpdateCounter % 15 !== 0) return;

  canvas.toBlob(blob => {
    if (!blob) {
      currentKBSize = "-- KB";
      kbDisplay.textContent = currentKBSize;
      if (shutterKbLabel) shutterKbLabel.textContent = currentKBSize;
      return;
    }
    currentKBSize = formatFileSize(blob.size);
    kbDisplay.textContent = currentKBSize;
    if (shutterKbLabel) shutterKbLabel.textContent = currentKBSize;
  }, "image/png");
}

function drawLoop() {
  if (!streaming || paused) return;

  const w = canvas.width;
  const h = canvas.height;
  if (video.readyState < 2) {
    requestAnimationFrame(drawLoop);
    return;
  }

  // Base draw
  ctx.drawImage(video, 0, 0, w, h);

  // Now read pixels from canvas
  let frame = ctx.getImageData(0, 0, w, h);
  let data = frame.data;

  // Pixel-based filters
  if (filterEls.gray.enable && filterEls.gray.enable.checked)
    applyGrayscale(data, parseInt(filterEls.gray.range.value, 10) / 100);

  if (filterEls.bitmap.enable && filterEls.bitmap.enable.checked)
    applyBitmap(data, parseInt(filterEls.bitmap.range.value, 10));

  if (filterEls.dither.enable && filterEls.dither.enable.checked)
    applyDithered(data, w, h, parseInt(filterEls.dither.range.value, 10));

  if (filterEls.poster.enable && filterEls.poster.enable.checked)
    applyPosterize(data, parseInt(filterEls.poster.range.value, 10));

  if (filterEls.pixelStretch.enable && filterEls.pixelStretch.enable.checked)
    applyPixelStretch(data, w, h, parseInt(filterEls.pixelStretch.range.value, 10));

  if (filterEls.halftone.enable && filterEls.halftone.enable.checked &&
      halftoneTypeSelect.value === "mono") {
    applyHalftoneMono(data, w, h, parseInt(filterEls.halftone.range.value, 10));
  }

  if (filterEls.mezzo.enable && filterEls.mezzo.enable.checked)
    applyMezzotint(data, w, h, parseInt(filterEls.mezzo.range.value, 10));

  if (filterEls.contour.enable && filterEls.contour.enable.checked)
    applyContour(data, w, h, parseInt(filterEls.contour.range.value, 10));

  if (filterEls.edges.enable && filterEls.edges.enable.checked)
    applyEdges(data, w, h, parseInt(filterEls.edges.range.value, 10));

  if (filterEls.pixelSort.enable && filterEls.pixelSort.enable.checked)
    applyPixelSort(data, w, h, parseInt(filterEls.pixelSort.range.value, 10));

  // Voronoi: cells stable, colors live
  if (filterEls.voronoi.enable && filterEls.voronoi.enable.checked) {
    const numPoints = parseInt(filterEls.voronoi.range.value, 10) || 40;
    applyVoronoi(data, w, h, numPoints);
  }

  // Palette reduce: palette stable, image live
  if (filterEls.palette.enable && filterEls.palette.enable.checked) {
    const colorsCount = parseInt(filterEls.palette.range.value, 10) || 8;
    const algo = paletteAlgoSelect.value;

    const needsNewPalette =
      !paletteCurrent ||
      paletteParams.colorsCount !== colorsCount ||
      paletteParams.algo !== algo ||
      paletteParams.w !== w ||
      paletteParams.h !== h;

    if (needsNewPalette) {
      ctx.putImageData(frame, 0, 0);
      paletteCurrent = buildPaletteFromCanvas(w, h, colorsCount, algo);
      paletteParams = { colorsCount, algo, w, h };

      frame = ctx.getImageData(0, 0, w, h);
      data = frame.data;
    }

    applyPaletteQuantization(data, paletteCurrent);
  }

  ctx.putImageData(frame, 0, 0);

  // Canvas-based filters
  if (filterEls.point.enable && filterEls.point.enable.checked) {
    applyPointillism(
      ctx,
      w,
      h,
      parseInt(filterEls.point.range.value, 10),
      pointShape.value
    );
  }

  if (filterEls.lowpoly.enable && filterEls.lowpoly.enable.checked) {
    applyLowPoly(ctx, w, h, parseInt(filterEls.lowpoly.range.value, 10));
  }

  if (filterEls.blobs.enable && filterEls.blobs.enable.checked) {
    applyAbstractBlobs(ctx, w, h, parseInt(filterEls.blobs.range.value, 10));
  }

  if (filterEls.halftone.enable && filterEls.halftone.enable.checked &&
      halftoneTypeSelect.value === "rgb") {
    applyHalftoneRGB(ctx, w, h, parseInt(filterEls.halftone.range.value, 10));
  }

  // Mode filter
  if (modeSelect && modeSelect.value === "ascii") {
    applyAsciiMode(w, h);
  }

  // Pixelate last
  if (filterEls.pixel.enable && filterEls.pixel.enable.checked) {
    applyPixelate(w, h, parseInt(filterEls.pixel.range.value, 10));
  }

  updateKBDisplay();
  requestAnimationFrame(drawLoop);
}

// ===== CAPTURE / MODAL =====
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function makeNoiseLabFilename(type, ext) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  const date =
    now.getFullYear() +
    "-" + pad(now.getMonth() + 1) +
    "-" + pad(now.getDate());

  const time =
    pad(now.getHours()) +
    "-" + pad(now.getMinutes()) +
    "-" + pad(now.getSeconds());

  return `noiselab-${type}-${date}-${time}.${ext}`;
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Capture photo - freeze frame and show preview
function capturePhoto() {
  if (!streaming) return;
  
  // Freeze the current frame
  paused = true;
  
  // Copy current canvas to snapshot canvas
  snapshotCanvas.width = canvas.width;
  snapshotCanvas.height = canvas.height;
  snapshotCtx.drawImage(canvas, 0, 0);
  
  // Show preview in modal
  const dataURL = snapshotCanvas.toDataURL("image/png");
  snapshotImg.src = dataURL;
  snapshotImg.style.display = "block";
  videoPreview.style.display = "none";

  // Reset blobs
  currentJpegBlob = null;
  currentPngBlob  = null;
  currentWebpBlob = null;

  // Set loading state
  imageSizeLabel.textContent = "...";
  saveJpegBtn.textContent = "JPEG";
  savePngBtn.textContent = "PNG";
  saveWebpBtn.textContent = "WEBP";
  saveWebpBtn.style.display = "inline-block";

  formatButtonsContainer.style.display = "flex";
  saveVideoBtn.style.display = "none";

  // Open modal immediately
  modalBG.classList.add("open");

  // Generate blobs from snapshot canvas (async, non-blocking)
  snapshotCanvas.toBlob(blob => {
    if (!blob) return;
    currentPngBlob = blob;
    savePngBtn.textContent = "PNG · " + formatFileSize(blob.size);
    // Set size label to PNG size initially
    if (!currentJpegBlob) {
      imageSizeLabel.textContent = formatFileSize(blob.size);
    }
  }, "image/png");

  snapshotCanvas.toBlob(blob => {
    if (!blob) return;
    currentJpegBlob = blob;
    saveJpegBtn.textContent = "JPEG · " + formatFileSize(blob.size);
    imageSizeLabel.textContent = formatFileSize(blob.size);
  }, "image/jpeg", 0.9);

  snapshotCanvas.toBlob(blob => {
    if (!blob) {
      saveWebpBtn.style.display = "none";
      return;
    }
    currentWebpBlob = blob;
    saveWebpBtn.textContent = "WEBP · " + formatFileSize(blob.size);
  }, "image/webp");
}

function openVideoSavePrompt() {
  paused = true;

  const url = URL.createObjectURL(recordedBlob);
  videoPreview.src = url;
  videoPreview.style.display = "block";
  snapshotImg.style.display = "none";

  imageSizeLabel.textContent = formatFileSize(recordedBlob.size);

  formatButtonsContainer.style.display = "none";
  saveVideoBtn.style.display = "inline-block";
  saveVideoBtn.textContent = "WEBM · " + formatFileSize(recordedBlob.size);

  modalBG.classList.add("open");
}

function closeModal() {
  modalBG.classList.remove("open");
  paused = false;
  if (streaming) requestAnimationFrame(drawLoop);
}

// Modal buttons
saveNo.addEventListener("click", closeModal);

saveJpegBtn.addEventListener("click", () => {
  if (!currentJpegBlob) {
    // Generate on the fly if not ready
    snapshotCanvas.toBlob(blob => {
      if (!blob) return;
      const fname = makeNoiseLabFilename("photo", "jpg");
      downloadBlob(blob, fname);
      closeModal();
    }, "image/jpeg", 0.9);
    return;
  }
  const fname = makeNoiseLabFilename("photo", "jpg");
  downloadBlob(currentJpegBlob, fname);
  closeModal();
});

savePngBtn.addEventListener("click", () => {
  if (!currentPngBlob) {
    snapshotCanvas.toBlob(blob => {
      if (!blob) return;
      const fname = makeNoiseLabFilename("photo", "png");
      downloadBlob(blob, fname);
      closeModal();
    }, "image/png");
    return;
  }
  const fname = makeNoiseLabFilename("photo", "png");
  downloadBlob(currentPngBlob, fname);
  closeModal();
});

saveWebpBtn.addEventListener("click", () => {
  if (!currentWebpBlob) {
    snapshotCanvas.toBlob(blob => {
      if (!blob) return;
      const fname = makeNoiseLabFilename("photo", "webp");
      downloadBlob(blob, fname);
      closeModal();
    }, "image/webp");
    return;
  }
  const fname = makeNoiseLabFilename("photo", "webp");
  downloadBlob(currentWebpBlob, fname);
  closeModal();
});

saveVideoBtn.addEventListener("click", () => {
  if (!recordedBlob) return;
  const fname = makeNoiseLabFilename("video", "webm");
  downloadBlob(recordedBlob, fname);
  closeModal();
});

// iOS: first touch to start video playback
document.body.addEventListener('touchstart', function iosStart() {
  if (video.paused && stream) {
    video.play().then(() => {
      if (!streaming) {
        streaming = true;
        requestAnimationFrame(drawLoop);
      }
    }).catch(() => {});
  }
  document.body.removeEventListener('touchstart', iosStart);
}, { once: true });

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  setupIOSFeatures();
  updateModeUI();
  fpsBtn.textContent = fpsOptions[currentFpsIndex] + " FPS";
  fpsValue.textContent = fpsOptions[currentFpsIndex] + " FPS";
  updateCanvasBlur();
  setTimeout(startCamera, 100);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !streaming && !paused) {
    startCamera();
  }
});