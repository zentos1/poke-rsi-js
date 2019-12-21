const NOISE_KERNEL_SIZE = 5;

const SPRITES_NUM_ROWS = 25;
const SPRITES_NUM_COLS = 24;

let globalSpritesVec = null;
let globalSpritesBinVec = null;

window.onbeforeunload = function() {
  let i;
  for (i = 0; i < globalSpritesVec.size(); i++) {
    globalSpritesVec.get(i).delete();
  }
  globalSpritesVec.delete();
  for (i = 0; i < globalSpritesBinVec.size(); i++) {
    globalSpritesBinVec.get(i).delete();
  }
  globalSpritesBinVec.delete();
  globalSpritesVec = null;
  globalSpritesBinVec = null;
}

function match(img) {
  if (globalSpritesVec == null) {
    [globalSpritesVec, globalSpritesBinVec] = loadSprites();
  }

  let adaptiveThresholdTests = [10, 20, 40];
  let rotations = [
    null, cv.ROTATE_90_CLOCKWISE, cv.ROTATE_180,
    cv.ROTATE_90_COUNTERCLOCKWISE];
  let ith, irot;
  let maxScore = 0.0;
  let ibest = 0;
  for (ith = 0; ith < adaptiveThresholdTests.length; ith++) {
    let binQuery = binarize(img, adaptiveThresholdTests[ith],
        NOISE_KERNEL_SIZE);
    for (irot = 0; irot < rotations.length; irot++) {
      if (rotations[irot] != null) {
        cv.rotate(binQuery, binQuery, rotations[irot]);
      }
      let [score, ibestMatch] = computeMatchingScore(
          binQuery, globalSpritesBinVec);
      if (score > maxScore) {
        maxScore = score;
        ibest = ibestMatch;
      }
    }
    binQuery.delete();
  }
  return [ibest, maxScore]
};

function computeMatchingScore(binQuery, spritesBinVec) {
  let i;
  let ibest = 0;
  let maxScore = 0.0;
  for (i = 0; i < spritesBinVec.size(); i++) {
    let score = computeOneMatchScore(binQuery, spritesBinVec.get(i));
    if (score > maxScore) {
      maxScore = score;
      ibest = i;
    }
  }
  return [maxScore, ibest];
}

function computeOneMatchScore(binQuery, binSprite) {
  let binQueryResized = new cv.Mat();
  cv.resize(
      binQuery, binQueryResized, binSprite.size(), 0, 0, cv.INTER_LINEAR);
  let score = computeIoU(binQueryResized, binSprite);
  binQueryResized.delete();
  return score;
}

function computeIoU(binImg1, binImg2) {
  let intersection = new cv.Mat();
  cv.bitwise_and(binImg1, binImg2, intersection);
  let union = new cv.Mat();
  cv.bitwise_or(binImg1, binImg2, union);
  let interNum = cv.countNonZero(intersection);
  let unionNum = cv.countNonZero(union);
  let iou = interNum / unionNum;
  intersection.delete();
  union.delete();
  return iou;
}


function loadSprites() {
  let allSprites = cv.imread(spritesElement);
  let spriteWidth = allSprites.cols / SPRITES_NUM_COLS;
  let spriteHeight = allSprites.rows / SPRITES_NUM_ROWS;
  let spritesVec = new cv.MatVector();
  let spritesBinVec = new cv.MatVector();
  let labels = new cv.Mat();
  let stats = new cv.Mat();
  let centroids = new cv.Mat();
  let i, j;
  for (i = 0; i < SPRITES_NUM_ROWS; i++) {
    for (j = 0; j < SPRITES_NUM_COLS; j++) {
      let bbox = new cv.Rect(
          j*spriteWidth, i*spriteHeight, spriteWidth, spriteHeight);
      let crop = allSprites.roi(bbox);
      let rgbaPlanes = new cv.MatVector();
      cv.split(crop, rgbaPlanes);
      let alpha = rgbaPlanes.get(3);
      let count = cv.countNonZero(alpha);
      if (count > 0) {
        let kernel = cv.Mat.ones(5, 5, cv.CV_8U);
        let alphaClosed = new cv.Mat();
        cv.morphologyEx(alpha, alphaClosed, cv.MORPH_CLOSE, kernel)
        kernel.delete();
        cv.connectedComponentsWithStats(alphaClosed, labels, stats, centroids);
        alphaClosed.delete();
        bbox = new cv.Rect(
            stats.intAt(1, 0), stats.intAt(1, 1),
            stats.intAt(1, 2), stats.intAt(1, 3));
        sprite = crop.roi(bbox);
        spritesVec.push_back(sprite);
        let spriteBin = alpha.roi(bbox);
        count = cv.countNonZero(spriteBin);
        spritesBinVec.push_back(spriteBin);
      }
      alpha.delete();
      rgbaPlanes.delete();
    }
  }
  allSprites.delete();
  labels.delete();
  stats.delete();
  centroids.delete();
  return [spritesVec, spritesBinVec];
}