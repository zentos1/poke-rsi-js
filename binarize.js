const BASE_LARGER_SIZE = 1000;
const MIN_PKMN_SIZE = BASE_LARGER_SIZE / 40;
const MAX_PKMN_SIZE = BASE_LARGER_SIZE - BASE_LARGER_SIZE / 10;

function binarize(imgColor, adaptiveThresholdConstant, noiseKernelSize) {
  let largeImgColor = relativeResize(imgColor, BASE_LARGER_SIZE);
  let largeImgGray = new cv.Mat();
  cv.cvtColor(largeImgColor, largeImgGray, cv.COLOR_RGBA2GRAY)

  let darkMask = extractDarkRegions(
      largeImgGray, adaptiveThresholdConstant, noiseKernelSize);
  let brightMask = extractBrightRegions(largeImgColor);

  let pokemonRoi = crop_pokemon(darkMask, brightMask);

  largeImgColor.delete();
  largeImgGray.delete();
  darkMask.delete();
  brightMask.delete();
  return pokemonRoi;
};

function crop_pokemon(darkMask, brightMask) {
  let size = Math.max(darkMask.cols, darkMask.rows) / 80;
  let kernelClose = cv.Mat.ones(size, size, cv.CV_8U);
  let darkMaskClosed = new cv.Mat();
  cv.morphologyEx(darkMask, darkMaskClosed, cv.MORPH_CLOSE, kernelClose)
  kernelClose.delete();

  let labels = new cv.Mat();
  let stats = new cv.Mat();
  let centroids = new cv.Mat();
  cv.connectedComponentsWithStats(darkMaskClosed, labels, stats, centroids);

  let maxCoverage = 0.0;
  let i;
  let darkRoi = new cv.Mat();
  let brightRoi = new cv.Mat();
  let intersectionRoi = new cv.Mat();
  let unionRoi = new cv.Mat();
  let finalRoi = new cv.Mat();
  let mask = new cv.Mat();
  let pokemonRoi = new cv.Mat();
  for (i = 0; i < stats.rows; i++) {
    let x = stats.intAt(i, 0);
    let y = stats.intAt(i, 1);
    let w = stats.intAt(i, 2);
    let h = stats.intAt(i, 3);
    let n = stats.intAt(i, 4);
    if (x > 0 && y > 0 && w > MIN_PKMN_SIZE && w < MAX_PKMN_SIZE &&
        h > MIN_PKMN_SIZE && h < MAX_PKMN_SIZE) {
      let cx = centroids.doubleAt(i, 0);
      let cy = centroids.doubleAt(i, 1);
      let x1 = Math.max(0, cx-w);
      let y1 = Math.max(0, cy-h);
      let w1 = Math.min(darkMask.cols - x1, 2 * w);
      let h1 = Math.min(darkMask.rows - y1, 2 * h);
      let bbox = new cv.Rect(x1, y1, w1, h1);
      darkRoi = darkMask.roi(bbox);
      brightRoi = brightMask.roi(bbox);
      cv.bitwise_and(darkRoi, brightRoi, intersectionRoi);
      cv.bitwise_or(darkRoi, brightRoi, unionRoi);
      cv.subtract(unionRoi, intersectionRoi, finalRoi, mask, unionRoi.type());
      let count = cv.countNonZero(finalRoi);
      let coverage = count / (2*h*2*w);
      if (coverage > maxCoverage) {
        maxCoverage = coverage;
        bbox = new cv.Rect(x, y, w, h);
        pokemonRoi = darkMask.roi(bbox);
      }
    }
  }

  darkMaskClosed.delete();
  labels.delete();
  stats.delete();
  centroids.delete();
  darkRoi.delete();
  brightRoi.delete();
  mask.delete();
  intersectionRoi.delete();
  unionRoi.delete();
  finalRoi.delete();
  return pokemonRoi;
}

function extractDarkRegions(
    imgGray, adaptiveThresholdConstant, noiseKernelSize) {
  let imgEq = new cv.Mat();
  cv.equalizeHist(imgGray, imgEq);

  let threshImg = new cv.Mat();
  let blockSize = Math.max(imgGray.rows, imgGray.cols) / 2 + 1;
  cv.adaptiveThreshold(
    imgEq, threshImg, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV,
    blockSize, adaptiveThresholdConstant);
  let darkMask = removeNoise(threshImg, noiseKernelSize);
  imgEq.delete()
  threshImg.delete();
  return darkMask;
};

function extractBrightRegions(imgColor) {
  let imgRgb = new cv.Mat();
  cv.cvtColor(imgColor, imgRgb, cv.COLOR_RGBA2RGB);
  let imgHsv = new cv.Mat();
  cv.cvtColor(imgRgb, imgHsv, cv.COLOR_RGB2HSV);
  imgRgb.delete();
  let low = new cv.Mat(
    imgHsv.rows, imgHsv.cols, imgHsv.type(), [0, 100, 100, 0]);
  let high = new cv.Mat(
    imgHsv.rows, imgHsv.cols, imgHsv.type(), [180, 255, 255, 255]);
  let brightMask = new cv.Mat();
  cv.inRange(imgHsv, low, high, brightMask);
  low.delete();
  high.delete();
  imgHsv.delete();
  return brightMask;
};

function printMatStats(title, mat) {
  let minMax = cv.minMaxLoc(mat)
  console.log(title + ' - (' + mat.rows + ', ' + mat.cols + ', ' +
      mat.channels() + ') - (' + minMax['minVal'] + ', ' + minMax['maxVal'] +
      ') - type: ' + mat.type())
};

function relativeResize(img, baseSizeValue, baseSizeIndex=null) {
  let imgBaseSizeValue;
  if (baseSizeIndex == null) {
    imgBaseSizeValue = Math.max(img.rows, img.cols);
  } else if (baseSizeIndex == 0) {
    imgBaseSizeValue = img.rows;
  } else {
    imgBaseSizeValue = img.cols;
  }
  let scale = baseSizeValue / imgBaseSizeValue;
  let size = new cv.Size(img.cols*scale, img.rows*scale);
  let resizedImg = new cv.Mat();
  cv.resize(img, resizedImg, size, 0, 0, cv.INTER_NEAREST);
  return resizedImg;
};

function removeNoise(imgBin, kernelSize) {
  let kernel = cv.Mat.ones(kernelSize, kernelSize, cv.CV_8U);
  let cleanImg = new cv.Mat()
  cv.morphologyEx(imgBin, cleanImg, cv.MORPH_OPEN, kernel)
  kernel.delete();
  return cleanImg;
}