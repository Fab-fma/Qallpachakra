'use strict';

// Genera un fondo de aire mecánico y organiza copias del primer soplo.
// La semilla de una pasada conserva sus variaciones al pausar o mover la barra.
window.crearSonidoProcedural = function crearSonidoProcedural() {
  let context, sample, ambience, roughSample, roughAmbience, compressor, playing, standbyBus, standbyLevel = 0;
  const unit = value => Math.min(1, Math.max(0, value));

  function smooth(value) {
    const t = unit(value);
    return t * t * (3 - 2 * t);
  }

  function crush(buffer) {
    const source = buffer.getChannelData(0);
    const result = context.createBuffer(1, buffer.length, buffer.sampleRate);
    const data = result.getChannelData(0);
    const hold = Math.round(buffer.sampleRate / 4000);
    let peak = 0;
    for (const value of source) peak = Math.max(peak, Math.abs(value));
    if (!peak) return result;
    const step = peak / 15;
    // Muestreo retenido y 31 niveles de amplitud para producir artefactos digitales.
    for (let i = 0; i < source.length; i += hold) {
      data.fill(Math.round(source[i] / step) * step, i, i + hold);
    }
    return result;
  }

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
    const {bus, voices, release} = playing;
    const now = context.currentTime;
    bus.gain.cancelAndHoldAtTime(now);
    bus.gain.linearRampToValueAtTime(0, now + .018);
    for (const voice of voices) voice.stop(now + .02);
    if (!voices.size) release();
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
    const score = context.createGain();
    const clean = context.createGain();
    const voices = new Set();
    const wear = unit((settings.degradacion ?? 0) / 100);
    const toneLevel = .022 * unit((settings.pitido ?? 0) / 100);
    const damaged = wear ? context.createGain() : null;
    const toneGain = toneLevel ? context.createGain() : null;
    function release() {
      for (const node of [bus, score, clean, damaged, toneGain]) node?.disconnect();
      if (playing?.bus === bus) playing = undefined;
    }
    playing = {bus, voices, release};
    clean.connect(score).connect(bus);
    bus.connect(compressor);
    const initialLevel = (settings.nivelInicial ?? 100) / 100;
    const rise = Math.min(.05, remaining / 3);
    const fadeStart = closing?.fadeStart ?? Math.max(0, end - .4);
    const levelAt = position => position <= fadeStart
      ? initialLevel + (1 - initialLevel) * position / Math.max(.001, fadeStart)
      : Math.max(0, (silentAt - position) / (silentAt - fadeStart));
    score.gain.setValueAtTime(0, start);
    score.gain.linearRampToValueAtTime(levelAt(elapsed + rise), start + rise);
    if (fadeStart > elapsed + rise) score.gain.linearRampToValueAtTime(1, start + fadeStart - elapsed);
    score.gain.linearRampToValueAtTime(0, start + remaining);

    function automate(parameter, valueAt) {
      const points = Math.max(2, Math.ceil(remaining * 32) + 1);
      const values = Float32Array.from({length: points}, (_, i) => valueAt(elapsed + i * remaining / (points - 1)));
      parameter.setValueCurveAtTime(values, start, remaining);
    }

    if (damaged) {
      roughSample ??= crush(sample);
      roughAmbience ??= crush(ambience);
      damaged.connect(score);
      const wearAt = position => wear * smooth((position / Math.max(.001, fadeStart) - .18) / .82);
      automate(damaged.gain, wearAt);
      automate(clean.gain, position => 1 - wearAt(position));
    }

    function schedule(source, disconnect) {
      voices.add(source);
      source.onended = () => {
        source.disconnect();
        disconnect?.();
        voices.delete(source);
        if (!voices.size) release();
      };
      source.stop(start + remaining);
    }

    if (toneGain) {
      const tone = context.createOscillator();
      tone.frequency.value = 3200;
      tone.connect(toneGain).connect(bus);
      const tail = Math.min(2.3, Math.max(.18, (silentAt - fadeStart) * .38), silentAt * .25);
      const peakAt = silentAt - tail;
      automate(toneGain.gain, position => {
        const swell = .003 + .997 * unit(position / peakAt) ** 4;
        const fade = 1 - smooth((position - peakAt) / tail);
        const flutter = .91 + .09 * Math.sin(2 * Math.PI * 1.7 * position);
        return toneLevel * swell * fade * flutter * smooth((position - elapsed) / rise);
      });
      tone.start(start);
      schedule(tone);
    }

    function voice(buffer, rough, when, offset, rate, volume, loop = false, pan = null) {
      if (volume <= 0) return;
      function send(audio, destination) {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = audio;
        source.loop = loop;
        source.playbackRate.value = rate;
        gain.gain.value = volume;
        const stereo = pan !== null && context.createStereoPanner ? context.createStereoPanner() : null;
        source.connect(gain);
        if (stereo) {
          stereo.pan.value = pan;
          gain.connect(stereo).connect(destination);
        } else gain.connect(destination);
        source.start(start + when, offset);
        schedule(source, () => { gain.disconnect(); stereo?.disconnect(); });
      }
      send(buffer, clean);
      if (damaged) send(rough, damaged);
    }

    voice(ambience, roughAmbience, 0, elapsed % ambience.duration, 1, settings.fondo / 100, true);
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
      if (offset < sample.duration) {
        voice(sample, roughSample, Math.max(0, t - elapsed), offset, rate, gain, false, width ? balance : null);
      }
      const interval = settings.intervalo * (settings.intervaloFinal / settings.intervalo) ** pressure;
      t += Math.max(.3, interval * (1 + wobble * (2 * random() - 1)));
    }
    await ready;
  }

  return {play, stop, arm, standby};
};
