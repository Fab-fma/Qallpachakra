'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const land = $('land'), audio = $('audio'), mri = $('mri'), stage = $('stage');
  const play = $('play'), seek = $('seek'), status = $('status');
  const layers = $('layers');
  const chapters = $('chapters');
  const sound = window.crearSonidoProcedural();
  const paintDamage = window.crearCrecimiento($('damage'));
  const paintGrain = window.crearGrano($('grain'));
  const style = $('composition').style;
  const previews = [$('preview-mri'), $('preview-filters')];
  const controls = [...document.querySelectorAll('[data-ajuste]')];
  const timeControls = controls.filter(input => input.dataset.ajuste.startsWith('tiempo.'));
  const initial = window.ESCENAS;
  if (!Array.isArray(initial) || !initial.length) {
    status.textContent = 'Añade al menos un lugar en ajustes.js.';
    return;
  }

  // El archivo de ajustes es la versión guardada. La interfaz edita esta copia.
  const filterDefaults = {entrada: 0, fundido: 1, saturacion: 100, brillo: 100, contraste: 100};
  const soundDefaults = {ritmo: 1, fondo: 28, desde: 58, intervaloFinal: .65, irregularidad: 38, variacion: 20, nivelInicial: 55};
  const saved = structuredClone(initial);
  for (const place of saved) {
    place.filtros = {...filterDefaults, ...place.filtros};
    place.sonido = {...soundDefaults, ...place.sonido};
    place.textura = {grano: place.textura?.grano ?? 0, intervalo: place.textura?.intervalo};
    // La línea de tiempo usa los mismos límites que los controles.
    for (const input of timeControls) {
      const key = input.dataset.ajuste.split('.')[1];
      input.value = place.tiempo[key];
      place.tiempo[key] = Number(input.value);
    }
  }
  const scenes = structuredClone(saved);
  const showConfig = window.FUNCION ?? {};
  const savedShowSound = {...saved[0].sonido, ...showConfig.sonido};
  let showSound = structuredClone(savedShowSound);
  let index = 0, position = 0, startedAt = 0, running = false, raf = 0, audioUrl;
  let sequence = true, mapReady = false, startWhenReady = false, runSeed;
  let presenceMode = 'manual', audience = null;
  let starts, sequenceLength;
  const pending = new WeakSet(), blocked = new WeakSet();
  const scene = () => scenes[index];
  const duration = ({esperaInicial, recorrido, pausaFinal}) => esperaInicial + recorrido + pausaFinal;
  const sceneStart = () => sequence ? starts[index] : 0;
  const localTime = () => position - sceneStart();
  const total = () => sequence ? sequenceLength : duration(scene().tiempo);
  const soundSettings = () => sequence ? showSound : scene().sonido;
  const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
  const transitionDuration = time => clamp(showConfig.fundido ?? 1.6, 0, duration(time) / 2);
  const seconds = n => n.toFixed(1).replace('.', ',');
  const note = message => { status.textContent = message; };
  const hidePreviews = () => previews.forEach(input => { input.checked = false; });
  const usesLayers = () => soundSettings().procedural && !audioUrl;
  const composed = () => layers.value === 'full';
  const freshSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

  function mosaicCount(place) {
    return place.anios?.length === 2 ? place.anios[1] - place.anios[0] + 1 : 0;
  }

  function paintGrowthGrain(place, age, visible) {
    if (!visible || !place.textura.grano) { paintGrain(0, 0); return; }
    const {textura, tiempo, crecimiento} = place;
    const defaultInterval = tiempo.recorrido / (mosaicCount(place) || tiempo.recorrido);
    const interval = Math.max(.15, textura.intervalo ?? defaultInterval);
    const steps = Math.max(1, Math.ceil(crecimiento.duracion / interval));
    const step = Math.min(steps - 1, Math.floor(age / interval));
    const level = steps > 1 ? step / (steps - 1) : 0;
    const seed = runSeed ^ Math.imul(index + 1, 465073) ^ Math.imul(step + 1, 31337);
    paintGrain(seed, textura.grano / 100 * (.22 + .78 * level));
  }

  function rebuildTimeline() {
    sequenceLength = 0;
    starts = scenes.map(place => {
      const start = sequenceLength;
      sequenceLength += duration(place.tiempo);
      return start;
    });
  }

  function restartSound() {
    if (running && composed() && usesLayers() && position < total()) {
      const firstWait = scenes[0].tiempo.esperaInicial;
      const finalHold = scenes.at(-1).tiempo.pausaFinal;
      const timing = sequence
        ? {esperaInicial: firstWait, recorrido: total() - firstWait - finalHold, pausaFinal: finalHold}
        : {...scene().tiempo};
      timing.recorrido += clamp(soundSettings().picoEnCierre ?? 0, 0, timing.pausaFinal);
      sound.play(soundSettings(), timing, position, total(), runSeed).catch(() => {
        sound.stop();
        note('El navegador bloqueó la mezcla. Pausa y vuelve a pulsar Reproducir.');
      });
    } else sound.stop();
  }

  function fadeIn({entrada, fundido}, elapsed) {
    const t = clamp((elapsed - entrada) / fundido, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function controlValue(input, fromFile = false) {
    const [group, key] = input.dataset.ajuste.split('.');
    const settings = group === 'sonido' ? soundSettings() : scene()[group];
    if (fromFile) {
      if (settings[key] === undefined) return;
      input.value = settings[key];
    }
    const value = settings[key] = Number(input.value);
    input.parentElement.querySelector('output').textContent = `${String(value).replace('.', ',')}${input.dataset.unidad}`;
  }

  function limitEntries() {
    for (const input of controls.filter(control => control.dataset.ajuste.endsWith('.entrada'))) {
      const length = input.dataset.ajuste.startsWith('sonido.') ? total() : duration(scene().tiempo);
      input.max = Math.max(0, length - 1);
      controlValue(input, true);
    }
  }

  function videoProgress(t) {
    const {esperaInicial, recorrido} = scene().tiempo;
    return clamp((t - esperaInicial) / recorrido, 0, 1);
  }

  function paint() {
    const current = scene();
    const {mapa, mri: layer, filtros, anios, tiempo, crecimiento} = current;
    const elapsed = localTime();
    const growthStart = tiempo.esperaInicial + tiempo.recorrido + (crecimiento?.espera ?? 0);
    const artistic = Boolean(layers.value !== 'map' && crecimiento && elapsed >= growthStart);
    const growth = artistic ? clamp((elapsed - growthStart) / Math.max(.1, crecimiento.duracion), 0, 1) : 0;
    const reveal = composed() ? ($('preview-mri').checked ? 1 : fadeIn(layer, elapsed)) : 0;
    const filterMix = composed() ? ($('preview-filters').checked ? 1 : fadeIn(filtros, elapsed)) : 0;
    const filterValue = key => 1 + (filtros[key] / 100 - 1) * filterMix;
    // Para cubrir el marco, ambos lados deben tener margen suficiente para el desplazamiento.
    const minimumZoom = 1 + 2 * Math.max(Math.abs(mapa.x - 50), Math.abs(mapa.y - 50)) / 100;
    style.setProperty('--map-x', `${mapa.x - 50}%`);
    style.setProperty('--map-y', `${mapa.y - 50}%`);
    style.setProperty('--map-zoom', Math.max((mapa.margen ?? 1) * mapa.zoom / 100, minimumZoom));
    style.setProperty('--map-saturation', filterValue('saturacion'));
    style.setProperty('--map-brightness', filterValue('brillo'));
    style.setProperty('--map-contrast', filterValue('contraste'));
    style.setProperty('--mri-x', `${layer.x}%`);
    style.setProperty('--mri-y', `${layer.y}%`);
    style.setProperty('--mri-height', `${layer.tamano}%`);
    style.setProperty('--mri-opacity', layer.archivo ? reveal * layer.opacidad / 100 : 0);
    const focus = layer.archivo && audience ? reveal * audience.near * (.13 + growth * .24) : 0;
    style.setProperty('--focus-opacity', focus);
    style.setProperty('--focus-x', `${audience ? 23 + audience.x * 55 : 50}%`);
    style.setProperty('--focus-y', `${audience ? 25 + audience.y * 48 : 50}%`);
    style.setProperty('--shade', layer.archivo ? reveal * layer.opacidad / 300 : 0);
    style.setProperty('--react-x', audience ? `${(audience.x - .5) * 4.2}%` : '0%');
    style.setProperty('--react-y', audience ? `${(audience.y - .5) * 2.7}%` : '0%');
    style.setProperty('--react-zoom', audience ? 1.05 + audience.near * .025 : 1);
    $('damage').style.opacity = (crecimiento?.opacidad ?? 100) / 100;
    paintDamage(elapsed - growthStart, artistic ? crecimiento : undefined);
    const cue = $('presence-cue');
    cue.hidden = presenceMode === 'manual' || audience !== null;
    cue.textContent = presenceMode === 'rehearsal' ? 'Entra con el cursor'
      : position > 0 ? 'Acércate para continuar' : 'Acércate para activar';
    const length = duration(tiempo);
    const transition = transitionDuration(tiempo);
    let visibility = Number(mapReady);
    if (sequence && transition > 0) {
      if (index > 0) visibility = Math.min(visibility, elapsed / transition);
      if (index < scenes.length - 1) visibility = Math.min(visibility, (length - elapsed) / transition);
    }
    style.setProperty('--curtain', 1 - clamp(visibility, 0, 1));
    style.setProperty('--place', sequence && mapReady ? clamp((4.6 - elapsed) / 1.2, 0, 1) : 0);

    const count = mosaicCount(current);
    const progress = videoProgress(elapsed);
    const mosaic = Math.min(count - 1, Math.floor(progress * count));
    paintGrowthGrain(current, elapsed - growthStart, artistic && mapReady);
    $('year').textContent = artistic ? `Escenario artístico · desde ${anios?.[1] ?? 'el último mosaico'}`
      : count > 0 ? anios[0] + mosaic : '';
    seek.max = total();
    if (document.activeElement !== seek || running) seek.value = position;
    $('time').textContent = `${seconds(position)} / ${seconds(total())} s`;
    play.textContent = running || startWhenReady ? 'Pausar' : position >= total() ? 'Volver a ver' : 'Reproducir';
    play.disabled = !mapReady && !running && !startWhenReady;
    seek.disabled = !mapReady && !running;
  }

  function alignMedia(media, target, rate, active, force) {
    if (!Number.isFinite(media.duration) || media.duration <= 0) return;
    // Evitar colocar un video exactamente después de su último fotograma.
    const position = clamp(target, 0, Math.max(0, media.duration - .02));
    if (media.playbackRate !== rate) media.playbackRate = rate;
    if (!active && !media.paused) media.pause();
    const drift = Math.abs(media.currentTime - position);
    if ((force || !media.seeking) && drift > (force ? .035 : .27)) media.currentTime = position;
    if (!active || !media.paused || media.seeking || media.readyState < 2 ||
        pending.has(media) || blocked.has(media)) return;
    pending.add(media);
    media.play().catch(error => {
      if (!running || error.name === 'AbortError') return;
      blocked.add(media);
      note(media === audio ? 'El navegador bloqueó el audio. Pausa y vuelve a pulsar Reproducir.'
        : 'No se pudo reproducir el mapa. Revisa el archivo de video.');
    }).finally(() => pending.delete(media));
  }

  function syncMedia(force = false) {
    const {tiempo} = scene();
    const elapsed = localTime();
    const sonido = soundSettings();
    const moving = elapsed >= tiempo.esperaInicial && elapsed < tiempo.esperaInicial + tiempo.recorrido;
    const videoTime = videoProgress(elapsed) * (land.duration || 0);
    const videoRate = clamp((land.duration || 1) / tiempo.recorrido, .0625, 8);
    if (mapReady) alignMedia(land, videoTime, videoRate, running && moving, force);

    if (!composed()) { audio.pause(); return; }
    if (usesLayers()) return;
    const sinceAudioStart = position - sonido.entrada;
    const repeat = sonido.intervalo > 0 && !audioUrl;
    const audioRate = repeat ? 1 : (sonido.ritmo ?? 1);
    const audioTime = repeat ? sinceAudioStart % sonido.intervalo : sinceAudioStart * audioRate;
    audio.volume = sonido.volumen / 100;
    alignMedia(audio, audioTime, audioRate,
      running && audio.volume > 0 && sinceAudioStart >= 0 && audioTime < audio.duration, force);
  }

  function update(force = false) { paint(); syncMedia(force); }

  function moveTo(t) {
    position = clamp(t, 0, total());
    if (!sequence) return;
    const next = starts.findLastIndex(start => start <= position);
    if (next !== index) {
      index = next;
      loadScene();
    }
  }

  function frame(now) {
    if (!running) return;
    moveTo((now - startedAt) / 1000);
    if (position >= total()) {
      running = false;
      sound.stop();
      update(true);
      return;
    }
    update();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    startWhenReady = false;
    cancelAnimationFrame(raf);
    land.pause(); audio.pause();
    sound.stop();
  }

  function jump(t) {
    moveTo(t);
    seek.value = position;
    if (running) startedAt = performance.now() - position * 1000;
    update(true);
    restartSound();
  }

  function startPlayback() {
    if (running) return;
    if (!mapReady) {
      startWhenReady = true;
      paint();
      return;
    }
    startWhenReady = false;
    hidePreviews();
    blocked.delete(land); blocked.delete(audio);
    running = true;
    startedAt = performance.now() - position * 1000;
    update(true);
    restartSound();
    raf = requestAnimationFrame(frame);
  }

  function restartPlayback() {
    stop();
    runSeed = freshSeed();
    jump(0);
    startPlayback();
  }

  function togglePlayback() {
    if (running || startWhenReady) { stop(); update(true); return; }
    if (position >= total()) restartPlayback();
    else if (!play.disabled) startPlayback();
  }

  function reactToPresence(mode, signal) {
    const wasPresent = audience !== null;
    const modeChanged = mode !== presenceMode;
    presenceMode = mode;
    audience = signal;
    if (mode !== 'manual') {
      if (signal && !wasPresent && position < total()) startPlayback();
      if (!signal && (modeChanged || wasPresent)) {
        stop();
        if (position >= total()) {
          runSeed = freshSeed();
          jump(0);
        } else update(true);
      }
    }
    paint();
  }

  function setAudio(source, name) {
    audio.pause();
    blocked.delete(audio);
    const layers = usesLayers();
    if (!layers && source) audio.src = source;
    else if (audio.hasAttribute('src')) { audio.removeAttribute('src'); audio.load(); }
    $('sound-name').textContent = layers ? 'Fondo continuo y primer soplo' : name || 'Sin pista asignada';
    const repeat = soundSettings().intervalo > 0 && !audioUrl;
    $('sound-mode').checked = Boolean(soundSettings().procedural);
    $('sound-mode-row').hidden = Boolean(audioUrl) || (!layers && name !== 'primer_soplo.wav');
    $('sound-layer-controls').hidden = !layers;
    $('sound-spacing').hidden = !repeat;
    $('sound-rate').hidden = repeat;
    $('restore-sound').hidden = !audioUrl;
    restartSound();
  }

  function restoreAudio() {
    if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = undefined; }
    $('sound-file').value = '';
    const file = soundSettings().archivo;
    setAudio(file, file?.split('/').pop());
  }

  function loadScene() {
    land.pause();
    blocked.delete(land);
    mapReady = false;
    hidePreviews();
    const current = scene();
    limitEntries();
    controls.forEach(input => controlValue(input, true));
    $('credit').textContent = current.credito || '';
    $('source-note').textContent = current.notaFuente || '';
    $('place').textContent = current.nombre;
    $('scene-label').textContent = sequence ? `Escena ${index + 1} · ${current.nombre}` : current.nombre;
    chapterButtons.forEach((button, i) => {
      if (i === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    for (const image of [mri, $('mri-echo')]) {
      if (current.mri.archivo) image.src = current.mri.archivo;
      else image.removeAttribute('src');
    }
    note('Cargando el paisaje…');
    land.src = current.video;
    paint();
  }

  land.addEventListener('loadeddata', () => {
    mapReady = true;
    note('Prueba los ajustes y descarga tu versión cuando te guste el resultado.');
    update(true);
    if (startWhenReady) startPlayback();
  });
  land.addEventListener('error', () => {
    stop();
    mapReady = false;
    paint();
    note('No se pudo abrir el mapa. Revisa la ruta del MP4 en ajustes.js.');
  });
  audio.addEventListener('loadeddata', () => syncMedia(true));
  audio.addEventListener('error', () => note('No se pudo abrir la pista de audio. Revisa el archivo o prueba otro WAV.'));
  mri.addEventListener('error', () => note('No se pudo abrir la resonancia. Revisa la ruta de su imagen en ajustes.js.'));

  play.addEventListener('click', togglePlayback);
  layers.addEventListener('change', () => {
    hidePreviews();
    update(true);
    restartSound();
  });
  $('restart').addEventListener('click', restartPlayback);
  seek.addEventListener('input', () => jump(Number(seek.value)));
  for (const input of previews) input.addEventListener('change', paint);
  for (const input of controls) input.addEventListener('input', () => {
    controlValue(input);
    if (input.dataset.ajuste.startsWith('tiempo.')) {
      const elapsed = localTime();
      rebuildTimeline();
      limitEntries();
      jump(sceneStart() + clamp(elapsed, 0, duration(scene().tiempo) - .01));
    }
    else if (input.dataset.ajuste.startsWith('sonido.')) {
      syncMedia(true);
      restartSound();
    }
    else paint();
  });

  const panels = [...document.querySelectorAll('.panel-switch button')];
  for (const button of panels) {
    button.addEventListener('click', () => {
      for (const tab of panels) {
        $(tab.getAttribute('aria-controls')).hidden = tab !== button;
        tab.setAttribute('aria-pressed', String(tab === button));
      }
    });
  }

  $('project').addEventListener('click', async () => {
    hidePreviews();
    paint();
    try { await stage.requestFullscreen(); }
    catch {
      stage.classList.add('presenting');
      document.body.classList.add('presenting');
      stage.focus({preventScroll: true});
    }
  });
  document.addEventListener('keydown', e => {
    if (e.code === 'Escape' && stage.classList.contains('presenting')) {
      stage.classList.remove('presenting');
      document.body.classList.remove('presenting');
      $('project').focus();
    }
    if (e.code === 'Space' && (document.fullscreenElement === stage || stage.classList.contains('presenting'))) {
      e.preventDefault(); togglePlayback();
    }
  });

  $('sound-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(file);
    setAudio(audioUrl, `${file.name} · prueba temporal`);
    note('Para guardar esa pista, copia el archivo al proyecto y cambia sonido.archivo en ajustes.js.');
  });
  $('restore-sound').addEventListener('click', restoreAudio);
  $('sound-mode').addEventListener('change', e => {
    soundSettings().procedural = e.target.checked;
    restoreAudio();
  });

  $('save').addEventListener('click', () => {
    const text = '// Una ficha por lugar. Las rutas son relativas a index.html.\n' +
      '// Tiempos en segundos; X, Y, tamaño y opacidad en porcentajes.\n' +
      `window.FUNCION = ${JSON.stringify({...showConfig, sonido: showSound}, null, 2)};\n` +
      `window.ESCENAS = ${JSON.stringify(scenes, null, 2)};\n`;
    const url = URL.createObjectURL(new Blob([text], {type: 'text/javascript'}));
    const link = Object.assign(document.createElement('a'), {href: url, download: 'ajustes.js'});
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    note('Para conservar los cambios, reemplaza ajustes.js con la copia descargada.');
  });
  $('reset').addEventListener('click', () => {
    stop();
    scenes[index] = structuredClone(saved[index]);
    if (sequence) showSound = structuredClone(savedShowSound);
    rebuildTimeline();
    position = sceneStart();
    seek.value = position;
    loadScene();
    restoreAudio();
  });

  const select = $('scene');
  const chapterButtons = scenes.map((place, i) => {
    select.add(new Option(place.nombre, i));
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${String(i + 1).padStart(2, '0')} · ${place.nombre}`;
    button.addEventListener('click', () => {
      const previewOffset = i > 0 && !running ? transitionDuration(scenes[i].tiempo) : 0;
      jump(starts[i] + previewOffset);
    });
    chapters.append(button);
    return button;
  });

  function selectMode() {
    stop();
    runSeed = freshSeed();
    sequence = select.value === 'all';
    index = sequence ? 0 : Number(select.value);
    position = 0;
    seek.value = 0;
    chapters.hidden = !sequence;
    $('sound-scope').textContent = sequence
      ? 'Estos ajustes se aplican a la obra completa.'
      : 'Estos ajustes se aplican a este lugar.';
    loadScene();
    restoreAudio();
  }
  select.addEventListener('change', selectMode);
  rebuildTimeline();
  selectMode();
  window.configurarPresencia($('composition'), reactToPresence);
})();
