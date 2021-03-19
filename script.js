import MagicWand from "magic-wand-tool";

// ----------------------------------------------------------------
// Some global variables that get modified in other functions
// TODO: state ought to be handled more carefully, and
// functions should be pure
// ----------------------------s------------------------------------

let colorThreshold = 15;
let blurRadius = 5;

let resultImage = null;
let interactionImage = null;

let mask = null;
let oldMask = null;
let downPoint = null;
let allowDraw = false;

let currentThreshold = colorThreshold;

// ----------------------------------------------------------------
// Functions
// ----------------------------------------------------------------

const onRadiusChange = (e) => {
  blurRadius = e.target.value;
};

const onImageUploaded = (input) => {
  if (input.files && input.files[0]) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = document.getElementById("original-image");
      img.setAttribute("src", e.target.result);
      img.onload = function () {
        initCanvasses(img);
      };
    };
    reader.readAsDataURL(input.files[0]);
  }
};

const initCanvasses = (img) => {
  const { width, height } = img;

  const resultCanvas = document.getElementById("resultCanvas");
  resultCanvas.width = width;
  resultCanvas.height = height;

  const interactionCanvas = document.getElementById("interactionCanvas");
  interactionCanvas.width = width;
  interactionCanvas.height = height;

  mask = null;

  resultImage = {
    width: width,
    height: height,
    context: resultCanvas.getContext("2d"),
  };

  interactionImage = {
    width: width,
    height: height,
    context: interactionCanvas.getContext("2d"),
  };

  // Temporary canvas because image data can only be loaded from Canvas
  var tempCtx = document.createElement("canvas").getContext("2d");
  tempCtx.canvas.width = width;
  tempCtx.canvas.height = height;
  tempCtx.drawImage(img, 0, 0);
  resultImage.data = tempCtx.getImageData(0, 0, width, height);
  resultImage.context.putImageData(resultImage.data, 0, 0);
};

const getMousePosition = (e) => {
  const p = e.target.getBoundingClientRect();
  const x = Math.round((e.clientX || e.pageX) - p.left);
  const y = Math.round((e.clientY || e.pageY) - p.top);
  return { x: x, y: y };
};

const updateThresholdValue = () => {
  document.getElementById("threshold").innerHTML =
    "Threshold: " + currentThreshold;
};

const calculateMask = (x, y) => {
  if (!resultImage) return;

  updateThresholdValue();

  var image = {
    data: resultImage.data.data,
    width: resultImage.width,
    height: resultImage.height,
    bytes: 4,
  };

  let old = oldMask ? oldMask.data : null;

  mask = MagicWand.floodFill(image, x, y, currentThreshold, old, true);
  if (mask) mask = MagicWand.gaussBlurOnlyBorder(mask, blurRadius, old);

  drawMask();
};

const drawMask = () => {
  if (!mask) return;

  interactionImage.data = interactionImage.context.getImageData(
    0,
    0,
    interactionImage.width,
    interactionImage.height
  );
  modifyPixels("ff0000", 0.5, interactionImage);
};

const modifyPixels = (color, alpha, targetImage) => {
  if (!mask) return;

  var rgba = hexToRgb(color, alpha);

  if (targetImage === undefined || targetImage === null) {
    // called from outside
    targetImage = resultImage;
    console.log("targetImage is resultImage", { color, alpha, rgba });
  }

  var x,
    y,
    data = mask.data,
    bounds = mask.bounds,
    maskW = mask.width,
    w = targetImage.width,
    h = targetImage.height,
    ctx = targetImage.context,
    // imgData = ctx.createImageData(w, h),
    imgData = targetImage.data,
    res = imgData.data;

  for (y = bounds.minY; y <= bounds.maxY; y++) {
    for (x = bounds.minX; x <= bounds.maxX; x++) {
      if (data[y * maskW + x] == 0) continue;
      const k = (y * w + x) * 4;
      res[k] = rgba[0];
      res[k + 1] = rgba[1];
      res[k + 2] = rgba[2];
      res[k + 3] = rgba[3];
    }
  }

  ctx.putImageData(imgData, 0, 0);
};

const hexToRgb = (hex, alpha) => {
  var int = parseInt(hex, 16);
  var r = (int >> 16) & 255;
  var g = (int >> 8) & 255;
  var b = int & 255;

  return [r, g, b, Math.round(alpha * 255)];
};

const initDownload = (el) => {
  const canvas = document.querySelector("#resultCanvas");
  console.log({ el, canvas });
  if (canvas) {
    const dataUrl = canvas.toDataURL("image/png");
    el.href = dataUrl;
  }
};

const clearInteractionCanvas = () => {
  const interactionCtx = interactionCanvas.getContext("2d");
  const { width, height } = interactionImage;
  interactionCtx.clearRect(0, 0, width, height);
};

const resetMask = () => {
  console.log("reset mask!");
  clearInteractionCanvas();
  mask = null;
};

// ----------------------------------------------------------------
// Some "global" functions reshared to be accessible from
// index.html
// ----------------------------------------------------------------

window.resetMask = resetMask;
window.modifyPixels = modifyPixels;
window.initDownload = initDownload;
window.onRadiusChange = onRadiusChange;
window.onImageUploaded = onImageUploaded;

// ----------------------------------------------------------------
// "Global" key event handler
// ----------------------------------------------------------------

document.addEventListener("keydown", (e) => {
  console.log("key!", e);
  if (e.key === "Delete" || e.key === "Backspace") {
    modifyPixels("000000", 0.0, resultImage);
    resetMask();
  }
  if (e.key === "Escape") {
    resetMask();
  }
});

// ----------------------------------------------------------------
// "Global" onload to kick off form values
// ----------------------------------------------------------------

window.onload = function () {
  updateThresholdValue();
  document.getElementById("blurRadius").value = blurRadius;
};

// ----------------------------------------------------------------
// Other mouse handling events registered "globally"
// ----------------------------------------------------------------

window.onMouseDown = (e) => {
  if (e.button == 0) {
    allowDraw = true;
    downPoint = getMousePosition(e);
    calculateMask(downPoint.x, downPoint.y);
  } else {
    allowDraw = false;
    oldMask = null;
  }
};

window.onMouseMove = (e) => {
  if (allowDraw) {
    var p = getMousePosition(e);
    if (p.x != downPoint.x || p.y != downPoint.y) {
      var dx = p.x - downPoint.x,
        dy = p.y - downPoint.y,
        len = Math.sqrt(dx * dx + dy * dy),
        adx = Math.abs(dx),
        ady = Math.abs(dy),
        sign = adx > ady ? dx / adx : dy / ady;
      sign = sign < 0 ? sign / 5 : sign / 3;
      var thres = Math.min(
        Math.max(colorThreshold + Math.floor(sign * len), 1),
        255
      );
      //var thres = Math.min(colorThreshold + Math.floor(len / 3), 255);
      if (thres != currentThreshold) {
        currentThreshold = thres;
        calculateMask(downPoint.x, downPoint.y);
      }
    }
  }
};

window.onMouseUp = (e) => {
  allowDraw = false;
  oldMask = null;
  currentThreshold = colorThreshold;
};
