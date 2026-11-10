'use strict';

window.crearCrecimiento = function crearCrecimiento(canvas) {
  const {width, height, places} = window.DANO_DATOS;
  const context = canvas.getContext('2d');
  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const maskContext = mask.getContext('2d');
  const young = maskContext.createImageData(width, height);
  const mature = maskContext.createImageData(width, height);
  const layer = document.createElement('canvas');
  layer.width = canvas.width;
  layer.height = canvas.height;
  const layerContext = layer.getContext('2d');
  let lastStep, requested;
  const assets = Object.fromEntries(Object.entries(places).map(([key, data]) => {
    const texture = new Image();
    texture.addEventListener('load', () => {
      if (requested?.key === key) paint(requested.elapsed, requested.settings);
    });
    texture.src = data.texture;
    const arrival = Uint8Array.from(atob(data.times), char => char.charCodeAt(0));
    return [key, {texture, arrival}];
  }));

  function paint(elapsed, settings) {
    const key = settings?.zona ?? 'madre';
    requested = {key, elapsed, settings};
    const asset = assets[key];
    canvas.hidden = !settings || elapsed <= 0 || !asset?.texture.naturalWidth;
    if (canvas.hidden) return;
    const duration = Math.max(.1, settings.duracion);
    const aging = Math.max(.1, settings.maduracion ?? 6);
    const t = Math.min(duration + aging, Math.round(elapsed * 12) / 12);
    const step = `${key}:${t}:${duration}:${aging}`;
    if (step === lastStep) return;
    lastStep = step;
    const {arrival, texture} = asset;
    for (let i = 0; i < arrival.length; i++) {
      if (arrival[i] === 255) {
        young.data[i * 4 + 3] = mature.data[i * 4 + 3] = 0;
        continue;
      }
      const age = t - arrival[i] / 246 * duration;
      const edge = Math.max(0, Math.min(1, age / .56));
      const color = Math.max(0, Math.min(1, (age - .3) / aging));
      young.data[i * 4 + 3] = 255 * edge * (1 - color) * .58;
      mature.data[i * 4 + 3] = 255 * edge * color;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);

    function drawPass(pixels, filter, blend) {
      maskContext.putImageData(pixels, 0, 0);
      layerContext.clearRect(0, 0, layer.width, layer.height);
      layerContext.globalCompositeOperation = 'source-over';
      layerContext.filter = filter;
      layerContext.drawImage(texture, 0, 0, layer.width, layer.height);
      layerContext.filter = 'none';
      layerContext.globalCompositeOperation = 'destination-in';
      layerContext.drawImage(mask, 0, 0, layer.width, layer.height);
      context.globalCompositeOperation = blend;
      context.drawImage(layer, 0, 0);
    }
    drawPass(young, 'saturate(.32) brightness(.90)', 'source-over');
    drawPass(mature, 'none', 'lighter');
  }
  return paint;
};
