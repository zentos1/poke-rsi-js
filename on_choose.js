let imgElement = document.getElementById('imageSrc');
let inputElement = document.getElementById('fileInput');
let spritesElement = document.getElementById('sprites');
inputElement.addEventListener('change', (e) => {
  imgElement.src = URL.createObjectURL(e.target.files[0]);
}, false);

imgElement.onload = function() {
  let img = cv.imread(imgElement);
  let imgInputShow = relativeResize(img, 375);
  cv.imshow('canvasInput', imgInputShow);
  imgInputShow.delete();

  let [ibest, maxScore] = match(img);

  let pokeNameElement = document.getElementById('pokeName');
  pokeNameElement.innerHTML = spriteInfo[ibest][2];
  let typeStr = spriteInfo[ibest][3];
  if (spriteInfo[ibest][4].length > 0) {
    typeStr = spriteInfo[ibest][3] + ' / ' + spriteInfo[ibest][4];
  }
  let pokeTypeElement = document.getElementById('pokeType');
  pokeTypeElement.innerHTML = typeStr;
  let imgOutputShow = relativeResize(globalSpritesVec.get(ibest), 200);
  cv.imshow('canvasOutput', imgOutputShow);
  let confidenceElement = document.getElementById('confidence');
  confidenceElement.innerHTML = "Prediction confidence: " +
      (100*maxScore).toString().split('.')[0] + "%";
  img.delete();
  imgOutputShow.delete();
};