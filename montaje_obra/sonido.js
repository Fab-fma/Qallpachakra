'use strict';

// Genera un fondo de aire mecánico y organiza copias del primer soplo.
// La semilla de una pasada conserva sus variaciones al pausar o mover la barra.
window.crearSonidoProcedural = function crearSonidoProcedural() {
  let context, sample, ambience, compressor, playing, standbyBus, standbyLevel = 0;

  function randomFrom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function createAmbience() {
    const rate = 22050;
    const buffer = context.createBuffer(1, rate * 12, rate);
    const data = buffer.getChannelData(0);
    const random = randomFrom(302);
    for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
    let high = 0, low = 0;
    // Calentar los filtros con el mismo ruido para que el fondo pueda repetirse.
    for (const write of [false, true]) {
      for (let i = 0; i < data.length; i++) {
        high += .16 * (data[i] - high);
        low += .034 * (data[i] - low);
        if (write) {
          const t = i / rate;
          data[i] = .40 * (high - low) + .020 * Math.sin(2 * Math.PI * 62 * t)
            + .009 * Math.sin(2 * Math.PI * 124 * t);
        }
      }
    }
    return buffer;
  }

  function prepare() {
    context = new AudioContext();
    const pcm = Uint8Array.from(atob(window.SOPLO_PCM), byte => byte.charCodeAt(0));
    const view = new DataView(pcm.buffer);
    sample = context.createBuffer(1, pcm.length / 2, 44100);
    const data = sample.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = view.getInt16(i * 2, true) / 32768;
    ambience = createAmbience();
    compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -13;
    compressor.ratio.value = 5;
    compressor.connect(context.destination);
  }

  function stop() {
    if (!playing) return;
    const {bus, voices} = playing;
    const now = context.currentTime;
    bus.gain.cancelAndHoldAtTime(now);
    bus.gain.linearRampToValueAtTime(0, now + .018);
    for (const voice of voices) voice.stop(now + .02);
    if (!voices.size) bus.disconnect();
    playing = undefined;
  }

  async function arm() {
    if (!context) prepare();
    return context.resume();
  }

  function standby(level) {
    if (!context || level === standbyLevel) return;
    if (!standbyBus) {
      const air = context.createBufferSource();
      air.buffer = ambience;
      air.loop = true;
      air.playbackRate.value = .67;
      standbyBus = context.createGain();
      standbyBus.gain.value = 0;
      air.connect(standbyBus).connect(compressor);
      air.start();
    }
    standbyLevel = level;
    standbyBus.gain.setTargetAtTime(level, context.currentTime, .33);
  }

  async function play(settings, time, elapsed, end, seed, closing) {
    stop();
    const silentAt = closing?.silentAt ?? end;
    if (elapsed >= silentAt) return;
    if (!sample) prepare();
    const ready = context.resume();
    const start = context.currentTime + .025;
    const remaining = silentAt - elapsed;
    const bus = context.createGain();
    const voices = new Set();
    playing = {bus, voices};
    bus.connect(compressor);
    const initialLevel = (settings.nivelInicial ?? 100) / 100;
    const rise = Math.min(.05, remaining / 3);
    const fadeStart = closing?.fadeStart ?? end - .4;
    const levelAt = position => position <= fadeStart
      ? initialLevel + (1 - initialLevel) * position / fadeStart
      : Math.max(0, (silentAt - position) / (silentAt - fadeStart));
    bus.gain.setValueAtTime(0, start);
    bus.gain.linearRampToValueAtTime(levelAt(elapsed + rise), start + rise);
    if (fadeStart > elapsed + rise) bus.gain.linearRampToValueAtTime(1, start + fadeStart - elapsed);
    bus.gain.linearRampToValueAtTime(0, start + remaining);

    function voice(buffer, when, offset, rate, volume, loop = false, pan = null) {
      if (volume <= 0) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = loop;
      source.playbackRate.value = rate;
      gain.gain.value = volume;
      const stereo = pan !== null && context.createStereoPanner ? context.createStereoPanner() : null;
      source.connect(gain);
      if (stereo) {
        stereo.pan.value = pan;
        gain.connect(stereo).connect(bus);
      } else gain.connect(bus);
      voices.add(source);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        stereo?.disconnect();
        voices.delete(source);
        if (!voices.size && playing?.bus !== bus) bus.disconnect();
      };
      source.start(start + when, offset);
      source.stop(start + remaining);
    }

    voice(ambience, 0, elapsed % ambience.duration, 1, settings.fondo / 100, true);
    const random = randomFrom(seed);
    const stereoRandom = randomFrom(seed ^ 0x4d292c8c);
    const width = Math.max(0, Math.min(1, (settings.estereo ?? 0) / 100));
    const transition = time.esperaInicial + time.recorrido * settings.desde / 100;
    const buildUp = time.recorrido * (1 - settings.desde / 100);
    const wobble = settings.irregularidad / 100;
    const variation = settings.variacion / 100;
    const stretch = settings.estiramientoFinal ?? .32;
    const firstStart = settings.entrada + random() * Math.min(2.6, Math.max(0, end - settings.entrada - .5));
    for (let t = firstStart; t < (closing?.lastBreath ?? end);) {
      const pressure = Math.max(0, Math.min(1, (t - transition) / buildUp));
      const first = t === firstStart;
      const length = first ? 1 : (1 + stretch * pressure) * (1 + variation * (2 * random() - 1));
      const rate = 1 / length;
      const gain = settings.volumen / 100 * (.83 + .17 * pressure) * (first ? 1 : .88 + .20 * random());
      const offset = Math.max(0, (elapsed - t) * rate);
      const pan = stereoRandom();
      const balance = first ? 0 : (2 * pan - 1) * width * (1 - .65 * pressure);
      if (offset < sample.duration) voice(sample, Math.max(0, t - elapsed), offset, rate, gain, false, width ? balance : null);
      const interval = settings.intervalo * (settings.intervaloFinal / settings.intervalo) ** pressure;
      t += Math.max(.3, interval * (1 + wobble * (2 * random() - 1)));
    }
    await ready;
  }

  return {play, stop, arm, standby};
};
