'use strict';

window.crearGrano = function crearGrano(canvas) {
  const context = canvas.getContext('2d');
  const {width, height} = canvas;
  const image = context.createImageData(width, height);
  const above = new Float32Array(width);
  let lastSeed;
  return function paint(seed, opacity) {
    canvas.hidden = opacity <= 0;
    if (canvas.hidden) return;
    canvas.style.opacity = opacity;
    if (seed === lastSeed) return;
    lastSeed = seed;
    let state = seed >>> 0;
    above.fill(0);
    for (let y = 0; y < height; y++) {
      let left = 0;
      for (let x = 0; x < width; x++) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const sample = (state >>> 24) - 128;
        const gray = 128 + .62 * sample + .17 * left + .17 * above[x];
        const i = (y * width + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = gray;
        image.data[i + 3] = 255;
        left = above[x] = sample;
      }
    }
    context.putImageData(image, 0, 0);
  };
};
