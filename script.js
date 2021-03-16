import MagicWand from "magic-wand-tool";

let colorThreshold = 15;
let blurRadius = 5;
let simplifyTolerant = 0;
let simplifyCount = 30;
let hatchLength = 4;
let hatchOffset = 0;

let imageInfo = null;
let cacheInd = null;
let mask = null;
let oldMask = null;
let downPoint = null;
let allowDraw = false;
let addMode = false;

let currentThreshold = colorThreshold;

window.onload = function () {
  document.onkeydown = onKeyDown;
  document.onkeyup = onKeyUp;

  showThreshold();
  document.getElementById("blurRadius").value = blurRadius;
  setInterval(function () {
    hatchTick();
  }, 300);
};

window.uploadClick = () => {
  document.getElementById("file-upload").click();
};
window.onRadiusChange = (e) => {
  blurRadius = e.target.value;
};

window.imgChange = (inp) => {
  if (inp.files && inp.files[0]) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = document.getElementById("test-picture");
      img.setAttribute("src", e.target.result);
      img.onload = function () {
        initCanvas(img);
      };
    };
    reader.readAsDataURL(inp.files[0]);
  }
};

const initCanvas = (img) => {
  var cvs = document.getElementById("resultCanvas");
  cvs.width = img.width;
  cvs.height = img.height;
  imageInfo = {
    width: img.width,
    height: img.height,
    context: cvs.getContext("2d"),
  };
  mask = null;

  var tempCtx = document.createElement("canvas").getContext("2d");
  tempCtx.canvas.width = imageInfo.width;
  tempCtx.canvas.height = imageInfo.height;
  tempCtx.drawImage(img, 0, 0);
  imageInfo.data = tempCtx.getImageData(
    0,
    0,
    imageInfo.width,
    imageInfo.height
  );
};
window.getMousePosition = (e) => {
  const p = e.target.getBoundingClientRect();
  const x = Math.round((e.clientX || e.pageX) - p.left);
  const y = Math.round((e.clientY || e.pageY) - p.top);
  return { x: x, y: y };
};
window.onMouseDown = (e) => {
  if (e.button == 0) {
    allowDraw = true;
    addMode = e.shiftKey;
    downPoint = getMousePosition(e);
    drawMask(downPoint.x, downPoint.y);
  } else {
    allowDraw = false;
    addMode = false;
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
        drawMask(downPoint.x, downPoint.y);
      }
    }
  }
};
window.onMouseUp = (e) => {
  allowDraw = false;
  addMode = false;
  oldMask = null;
  currentThreshold = colorThreshold;
};
window.onKeyDown = (e) => {
  if (e.keyCode == 17)
    document.getElementById("resultCanvas").classList.add("add-mode");
};
window.onKeyUp = (e) => {
  if (e.keyCode == 17)
    document.getElementById("resultCanvas").classList.remove("add-mode");
};
window.showThreshold = () => {
  document.getElementById("threshold").innerHTML =
    "Threshold: " + currentThreshold;
};
window.drawMask = (x, y) => {
  if (!imageInfo) return;

  showThreshold();

  var image = {
    data: imageInfo.data.data,
    width: imageInfo.width,
    height: imageInfo.height,
    bytes: 4,
  };

  if (addMode && !oldMask) {
    oldMask = mask;
  }

  let old = oldMask ? oldMask.data : null;

  mask = MagicWand.floodFill(image, x, y, currentThreshold, old, true);
  if (mask) mask = MagicWand.gaussBlurOnlyBorder(mask, blurRadius, old);

  if (addMode && oldMask) {
    mask = mask ? concatMasks(mask, oldMask) : oldMask;
  }

  drawBorder();
};
window.hatchTick = () => {
  hatchOffset = (hatchOffset + 1) % (hatchLength * 2);
  drawBorder(true);
};
window.drawBorder = (noBorder) => {
  if (!mask) return;

  var x,
    y,
    i,
    j,
    k,
    w = imageInfo.width,
    h = imageInfo.height,
    ctx = imageInfo.context,
    // imgData = ctx.createImageData(w, h),
    imgData = imageInfo.data,
    res = imgData.data;

  if (!noBorder) cacheInd = MagicWand.getBorderIndices(mask);

  ctx.clearRect(0, 0, w, h);

  var len = cacheInd.length;
  for (j = 0; j < len; j++) {
    i = cacheInd[j];
    x = i % w; // calc x by index
    y = (i - x) / w; // calc y by index
    k = (y * w + x) * 4;
    if ((x + y + hatchOffset) % (hatchLength * 2) < hatchLength) {
      // detect hatch color
      res[k + 3] = 255; // black, change only alpha
    } else {
      res[k] = 255; // white
      res[k + 1] = 255;
      res[k + 2] = 255;
      res[k + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
};
window.trace = () => {
  var cs = MagicWand.traceContours(mask);
  cs = MagicWand.simplifyContours(cs, simplifyTolerant, simplifyCount);

  mask = null;

  // draw contours
  var ctx = imageInfo.context;
  ctx.clearRect(0, 0, imageInfo.width, imageInfo.height);
  //inner
  ctx.beginPath();
  for (var i = 0; i < cs.length; i++) {
    if (!cs[i].inner) continue;
    var ps = cs[i].points;
    ctx.moveTo(ps[0].x, ps[0].y);
    for (var j = 1; j < ps.length; j++) {
      ctx.lineTo(ps[j].x, ps[j].y);
    }
  }
  ctx.strokeStyle = "red";
  ctx.stroke();
  //outer
  ctx.beginPath();
  for (var i = 0; i < cs.length; i++) {
    if (cs[i].inner) continue;
    var ps = cs[i].points;
    ctx.moveTo(ps[0].x, ps[0].y);
    for (var j = 1; j < ps.length; j++) {
      ctx.lineTo(ps[j].x, ps[j].y);
    }
  }
  ctx.strokeStyle = "blue";
  ctx.stroke();
};
window.paint = (color, alpha) => {
  if (!mask) return;

  var rgba = hexToRgb(color, alpha);

  var x,
    y,
    data = mask.data,
    bounds = mask.bounds,
    maskW = mask.width,
    w = imageInfo.width,
    h = imageInfo.height,
    ctx = imageInfo.context,
    // imgData = ctx.createImageData(w, h),
    imgData = imageInfo.data,
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

  mask = null;

  ctx.putImageData(imgData, 0, 0);
};

function hexToRgb(hex, alpha) {
  var int = parseInt(hex, 16);
  var r = (int >> 16) & 255;
  var g = (int >> 8) & 255;
  var b = int & 255;

  return [r, g, b, Math.round(alpha * 255)];
}

window.concatMasks = (mask, old) => {
  let data1 = old.data,
    data2 = mask.data,
    w1 = old.width,
    w2 = mask.width,
    b1 = old.bounds,
    b2 = mask.bounds,
    b = {
      // bounds for new mask
      minX: Math.min(b1.minX, b2.minX),
      minY: Math.min(b1.minY, b2.minY),
      maxX: Math.max(b1.maxX, b2.maxX),
      maxY: Math.max(b1.maxY, b2.maxY),
    },
    w = old.width, // size for new mask
    h = old.height,
    i,
    j,
    k,
    k1,
    k2,
    len;

  let result = new Uint8Array(w * h);

  // copy all old mask
  len = b1.maxX - b1.minX + 1;
  i = b1.minY * w + b1.minX;
  k1 = b1.minY * w1 + b1.minX;
  k2 = b1.maxY * w1 + b1.minX + 1;
  // walk through rows (Y)
  for (k = k1; k < k2; k += w1) {
    result.set(data1.subarray(k, k + len), i); // copy row
    i += w;
  }

  // copy new mask (only "black" pixels)
  len = b2.maxX - b2.minX + 1;
  i = b2.minY * w + b2.minX;
  k1 = b2.minY * w2 + b2.minX;
  k2 = b2.maxY * w2 + b2.minX + 1;
  // walk through rows (Y)
  for (k = k1; k < k2; k += w2) {
    // walk through cols (X)
    for (j = 0; j < len; j++) {
      if (data2[k + j] === 1) result[i + j] = 1;
    }
    i += w;
  }

  return {
    data: result,
    width: w,
    height: h,
    bounds: b,
  };
};

console.log("boo!");
