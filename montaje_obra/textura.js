'use strict';

window.crearGrano = function crearGrano(canvas) {
  const context = canvas.getContext('2d');
  const {width, height} = canvas;
  function surface(w, h) {
    const bitmap = document.createElement('canvas');
    bitmap.width = w;
    bitmap.height = h;
    const brush = bitmap.getContext('2d');
    return {bitmap, brush, image: brush.createImageData(w, h)};
  }
  const base = surface(width, height);
  const fineFrames = [surface(width / 2, height / 2), surface(width / 2, height / 2)];
  let lastSeed, lastTime;

  function setPattern(seed) {
    let state = seed >>> 0;
    function noise() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return (state >>> 24) - 128;
    }
    const data = base.image.data;
    let band = 0;
    for (let y = 0; y < height; y++) {
      band = .9 * band + .1 * noise();
      const scanline = y % 3 === 2 ? -10 : 4;
      const line = 128 + .8 * band + .11 * noise() + scanline;
      let streak = 0;
      for (let x = 0; x < width; x++) {
        const sample = noise();
        streak = .78 * streak + .22 * sample;
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = line + .22 * sample + .51 * streak;
        data[i + 3] = 255;
      }
    }
    base.brush.putImageData(base.image, 0, 0);
  }

  function fineFrame(seed, number) {
    const frame = fineFrames[number % 2];
    if (frame.seed === seed && frame.number === number) return frame.bitmap;
    frame.seed = seed;
    frame.number = number;
    let state = (seed ^ Math.imul(number + 1, 2246822519)) >>> 0;
    let value = 0;
    const data = frame.image.data;
    for (let i = 0; i < data.length; i += 4) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      value = .25 * value + .34 * ((state >>> 24) - 128);
      data[i] = data[i + 1] = data[i + 2] = 128 + value;
      data[i + 3] = 255;
    }
    frame.brush.putImageData(frame.image, 0, 0);
    return frame.bitmap;
  }

  return function paint(seed, opacity, elapsed = 0) {
    canvas.hidden = opacity <= 0;
    if (canvas.hidden) return;
    canvas.style.opacity = opacity;
    const cut = seed !== lastSeed;
    if (!cut && elapsed === lastTime) return;
    if (cut) setPattern(seed);
    lastSeed = seed;
    lastTime = elapsed;

    // Las bandas cambian al corte. El grano fino mezcla, en cada repintado,
    // dos patrones vecinos en el tiempo y conserva el encuadre fijo.
    const phase = Math.max(0, elapsed * 24);
    const frame = Math.floor(phase);
    const fraction = phase - frame;
    context.drawImage(base.bitmap, 0, 0);
    context.globalCompositeOperation = 'soft-light';
    context.globalAlpha = .65 * (1 - fraction);
    context.drawImage(fineFrame(seed, frame), 0, 0, width, height);
    context.globalAlpha = .65 * fraction;
    context.drawImage(fineFrame(seed, frame + 1), 0, 0, width, height);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  };
};
