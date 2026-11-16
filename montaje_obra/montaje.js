'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const land = $('land'), audio = $('audio'), mri = $('mri'), stage = $('stage');
  const play = $('play'), seek = $('seek'), status = $('status');
  const layers = $('layers');
  const chapters = $('chapters');
  const mosaicPace = $('mosaic-pace');
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
  const filterDefaults = {entrada: 0, fundido: 1, saturacion: 100, brillo: 100, contraste: 100, vinetado: 0};
  const soundDefaults = {ritmo: 1, fondo: 28, desde: 58, intervaloFinal: .65, irregularidad: 38, variacion: 20, nivelInicial: 55, estereo: 0, espera: 0};
  const saved = structuredClone(initial);
  for (const place of saved) {
    place.filtros = {...filterDefaults, ...place.filtros};
    place.sonido = {...soundDefaults, ...place.sonido};
    place.textura = {grano: 0, granoHistorico: 0, ...place.textura};
    place.textura.granoAntesExpansion ??= place.textura.granoHistorico;
    // La línea de tiempo usa los mismos límites que los controles.
    for (const input of timeControls) {
      const key = input.dataset.ajuste.split('.')[1];
      input.value = place.tiempo[key];
      place.tiempo[key] = Number(input.value);
    }
  }
  const scenes = structuredClone(saved);
  const savedParallax = window.FUNCION?.paralaje ?? 40;
  const showConfig = {...window.FUNCION, paralaje: savedParallax};
  const ending = {duracion: 12, texto: 'El territorio respira', ...showConfig.cierre};
  const savedShowSound = {...saved[0].sonido, ...showConfig.sonido};
  let showSound = structuredClone(savedShowSound);
  let index = 0, position = 0, startedAt = 0, running = false, raf = 0, audioUrl;
  let sequence = true, mapReady = false, startWhenReady = false, runSeed;
  let presenceMode = 'manual', audience = null;
  let standby = true, replayTimer;
  let starts, sequenceLength;
  const pending = new WeakSet(), blocked = new WeakSet();
  const scene = () => scenes[index];
  const duration = ({esperaInicial, recorrido, pausaFinal}) => esperaInicial + recorrido + pausaFinal;
  const sceneStart = () => sequence ? starts[index] : 0;
  const localTime = () => position - sceneStart();
  const endingLength = () => sequence && composed() ? Math.max(0, ending.duracion) : 0;
  const total = () => sequence ? sequenceLength + endingLength() : duration(scene().tiempo);
  const soundSettings = () => sequence ? showSound : scene().sonido;
  const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
  const transitionDuration = time => clamp(showConfig.fundido ?? 1.6, 0, duration(time) / 2);
  const seconds = n => n.toFixed(1).replace('.', ',');
  const note = message => { status.textContent = message; };
  const hidePreviews = () => previews.forEach(input => { input.checked = false; });
  const usesLayers = () => soundSettings().procedural && !audioUrl;
  const composed = () => layers.value === 'full';
  const riverLoop = () => endingLength() > 0 && ending.rio && Boolean(window.RIO_1984);
  const freshSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

  function smooth(from, to, value) {
    const t = clamp((value - from) / (to - from), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function closingAudio() {
    const length = endingLength();
    return length > 0 ? {
      fadeStart: sequenceLength + length * .10,
      lastBreath: sequenceLength + length * .28,
      silentAt: sequenceLength + length * .78,
    } : null;
  }

  function mosaicCount(place) {
    return place.anios?.length === 2 ? place.anios[1] - place.anios[0] + 1 : 0;
  }

  function paintGrowthGrain(place, age, attenuation) {
    const {textura, tiempo, crecimiento} = place;
    const defaultInterval = tiempo.recorrido / (mosaicCount(place) || tiempo.recorrido);
    const interval = Math.max(.15, textura.intervalo ?? defaultInterval);
    const steps = Math.max(1, Math.ceil(crecimiento.duracion / interval));
    const step = Math.min(steps - 1, Math.floor(age / interval));
    const level = steps > 1 ? step / (steps - 1) : 0;
    const seed = runSeed ^ Math.imul(index + 1, 465073) ^ Math.imul(step + 1, 31337);
    const intensity = textura.granoAntesExpansion * (1 - level) + textura.grano * level;
    paintGrain(seed, intensity / 100 * attenuation, age);
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
        ? {esperaInicial: firstWait, recorrido: sequenceLength - firstWait - finalHold, pausaFinal: finalHold}
        : {...scene().tiempo};
      timing.recorrido += clamp(soundSettings().picoEnCierre ?? 0, 0, timing.pausaFinal);
      sound.play(soundSettings(), timing, position, total(), runSeed, closingAudio()).catch(() => {
        sound.stop();
        note('El navegador bloqueó la mezcla. Pausa y vuelve a pulsar Reproducir.');
      });
    } else sound.stop();
  }

  function fadeIn({entrada, fundido}, elapsed) {
    return smooth(entrada, entrada + fundido, elapsed);
  }

  function controlValue(input, fromFile = false) {
    const [group, key] = input.dataset.ajuste.split('.');
    const settings = group === 'funcion' ? showConfig : group === 'sonido' ? soundSettings() : scene()[group];
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
    const endLength = endingLength();
    const endProgress = endLength > 0 ? clamp((position - sequenceLength) / endLength, 0, 1) : 0;
    const loop = riverLoop();
    const opening = loop ? (standby ? 0 : smooth(0, 2.8, position)) : 1;
    const contrast = loop ? smooth(.12, .65, endProgress) : 0;
    const darken = loop ? smooth(.19, .76, endProgress) : smooth(.19, .68, endProgress);
    const untilClosing = (sequenceLength - position) / Math.max(1, endLength);
    const stillness = loop ? smooth(0, .20, untilClosing) : 1 - smooth(.04, .44, endProgress);
    const depth = showConfig.paralaje / 100 * stillness;
    const growthStart = tiempo.esperaInicial + tiempo.recorrido + (crecimiento?.espera ?? 0);
    const artistic = Boolean(layers.value !== 'map' && crecimiento && elapsed >= growthStart);
    const growth = artistic ? clamp((elapsed - growthStart) / Math.max(.1, crecimiento.duracion), 0, 1) : 0;
    const reveal = composed() ? ($('preview-mri').checked ? 1 : fadeIn(layer, elapsed)) : 0;
    const mriFade = 1 - smooth(.54, .83, endProgress);
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
    style.setProperty('--ending-tone', contrast);
    style.setProperty('--ending-light', 1 - .40 * contrast);
    style.setProperty('--ending-contrast', 1 + 10 * contrast);
    style.setProperty('--mri-contrast', 1.09 + 9 * contrast);
    style.setProperty('--vignette', composed() ? filtros.vinetado / 100 * filterMix : 0);
    style.setProperty('--mri-x', `${layer.x}%`);
    style.setProperty('--mri-y', `${layer.y}%`);
    style.setProperty('--mri-height', `${layer.tamano}%`);
    const mriOpacity = layer.opacidad / 100 * (1 + .16 * darken);
    style.setProperty('--mri-opacity', layer.archivo ? reveal * mriOpacity * mriFade : 0);
    const focus = layer.archivo && audience ? reveal * audience.near * (.13 + growth * .24) * depth : 0;
    style.setProperty('--focus-opacity', focus);
    style.setProperty('--focus-x', `${audience ? 23 + audience.x * 55 : 50}%`);
    style.setProperty('--focus-y', `${audience ? 25 + audience.y * 48 : 50}%`);
    const shading = layer.archivo ? reveal * layer.opacidad / 300 : 0;
    style.setProperty('--shade', shading + (1 - shading) * darken);
    const dx = (audience ? audience.x - .5 : 0) * depth;
    const dy = (audience ? audience.y - .5 : 0) * depth;
    style.setProperty('--react-x', `${dx * 2.4}%`);
    style.setProperty('--react-y', `${dy * 1.5}%`);
    style.setProperty('--react-zoom', audience ? 1 + depth * (.035 + audience.near * .025) : 1);
    // El mapa y su máscara se mueven juntos. La resonancia se desplaza un poco más.
    style.setProperty('--depth-x', `${dx * 2.8}cqw`);
    style.setProperty('--depth-y', `${dy * 1.0}cqw`);
    $('damage').style.opacity = (crecimiento?.opacidad ?? 100) / 100;
    paintDamage(elapsed - growthStart, artistic ? crecimiento : undefined);
    const cue = $('presence-cue');
    cue.hidden = !standby || presenceMode !== 'rehearsal' || audience !== null;
    cue.textContent = presenceMode === 'rehearsal' ? 'Entra con el cursor'
      : position > 0 ? 'Acércate para continuar' : 'Acércate para activar';
    const length = duration(tiempo);
    const transition = transitionDuration(tiempo);
    let visibility = Number(mapReady);
    if (sequence && transition > 0) {
      if (index > 0) visibility = Math.min(visibility, elapsed / transition);
      if (index < scenes.length - 1) visibility = Math.min(visibility, (length - elapsed) / transition);
    }
    const blackout = loop ? smooth(.77, .96, endProgress) : smooth(.66, .83, endProgress);
    style.setProperty('--curtain', Math.max(1 - clamp(visibility * opening, 0, 1), blackout));
    const riverIn = smooth(.20, .59, endProgress);
    const riverSettles = smooth(.71, 1, endProgress);
    const riverLight = loop ? .085 * (1 - opening) + riverIn * (.39 - .305 * riverSettles) : 0;
    $('river-frame').hidden = !riverLight;
    style.setProperty('--river-light', riverLight);
    style.setProperty('--river-imprint', loop ? .25 * smooth(.35, .63, endProgress) * (1 - smooth(.74, .98, endProgress)) : 0);
    const waiting = standby || (running && endProgress >= .84);
    sound.standby(loop && waiting ? soundSettings().espera / 100 : 0);
    style.setProperty('--legend', 1 - smooth(.18, .65, endProgress));
    const titleOpacity = smooth(.74, .89, endProgress);
    $('coda').hidden = !titleOpacity || !ending.texto;
    style.setProperty('--title-opacity', titleOpacity);
    style.setProperty('--place', sequence && mapReady && !loop ? clamp((4.6 - elapsed) / 1.2, 0, 1) : 0);

    const count = mosaicCount(current);
    const progress = videoProgress(elapsed);
    const mosaic = Math.min(count - 1, Math.floor(progress * count));
    if (artistic && mapReady) {
      const grainTime = loop ? Math.min(elapsed, length) : elapsed;
      paintGrowthGrain(current, grainTime - growthStart, loop ? 1 - smooth(.02, .31, endProgress) : 1);
    } else {
      const {granoHistorico, granoAntesExpansion} = current.textura;
      const grain = composed() && mapReady
        ? (granoHistorico + (granoAntesExpansion - granoHistorico) * Math.max(0, mosaic) / Math.max(1, count - 1)) / 100
        : 0;
      const seed = runSeed ^ Math.imul(index + 1, 465073) ^ Math.imul(mosaic + 1, 19391);
      paintGrain(seed, grain, elapsed);
    }
    $('year').textContent = artistic ? `Escenario artístico · desde ${anios?.[1] ?? 'el último mosaico'}`
      : count > 0 ? anios[0] + mosaic : '';
    seek.max = total();
    if (document.activeElement !== seek || running) seek.value = position;
    $('time').textContent = `${seconds(position)} / ${seconds(total())} s`;
    play.textContent = running || startWhenReady ? 'Pausar' : position >= total() ? 'Volver a ver' : 'Reproducir';
    play.disabled = !mapReady && !running && !startWhenReady;
    seek.disabled = !mapReady && !running;
    const pace = count > 1 ? `Cada año ocupa ${seconds(tiempo.recorrido / count)} s en pantalla.` : '';
    if (mosaicPace.textContent !== pace) mosaicPace.textContent = pace;
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
    const endingAudio = closingAudio();
    const fade = endingAudio ? 1 - clamp(
      (position - endingAudio.fadeStart) / (endingAudio.silentAt - endingAudio.fadeStart), 0, 1,
    ) : 1;
    audio.volume = sonido.volumen / 100 * fade;
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
      if (riverLoop()) {
        standby = true;
        runSeed = freshSeed();
        moveTo(0);
        seek.value = 0;
        update(true);
        if (presenceMode === 'manual' || audience) {
          replayTimer = setTimeout(() => {
            if (presenceMode === 'manual' || audience) startPlayback();
          }, Math.max(0, ending.espera ?? 4) * 1000);
        }
        return;
      }
      update(true);
      return;
    }
    update();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    clearTimeout(replayTimer);
    running = false;
    startWhenReady = false;
    cancelAnimationFrame(raf);
    land.pause(); audio.pause();
    sound.stop();
  }

  function jump(t) {
    clearTimeout(replayTimer);
    standby = false;
    moveTo(t);
    seek.value = position;
    if (running) startedAt = performance.now() - position * 1000;
    update(true);
    restartSound();
  }

  function startPlayback() {
    if (running) return;
    clearTimeout(replayTimer);
    if (!mapReady) {
      startWhenReady = true;
      paint();
      return;
    }
    startWhenReady = false;
    standby = false;
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
    unlockAudio();
    if (running || startWhenReady) { stop(); update(true); return; }
    if (position >= total()) restartPlayback();
    else if (!play.disabled) startPlayback();
  }

  function reactToPresence(mode, signal) {
    const wasPresent = audience !== null;
    const modeChanged = mode !== presenceMode;
    presenceMode = mode;
    audience = signal;
    if (modeChanged) {
      clearTimeout(replayTimer);
      if (mode === 'camera' || mode === 'rehearsal') unlockAudio();
    }
    if (mode !== 'manual') {
      if (!signal) {
        clearTimeout(replayTimer);
        if (wasPresent) startWhenReady = false;
      } else if (!wasPresent && !running) {
        if (position >= total()) restartPlayback();
        else startPlayback();
      }
    }
    paint();
  }

  function unlockAudio() {
    sound.arm().then(paint).catch(() => {});
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
    $('standby-volume').hidden = !riverLoop();
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
    for (const image of [mri, $('mri-echo'), $('mri-imprint')]) {
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
    $('standby-volume').hidden = !riverLoop();
    if (standby) { clearTimeout(replayTimer); paint(); }
    else jump(position);
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
      paint();
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
    unlockAudio();
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
    showConfig.paralaje = savedParallax;
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
    standby = true;
    seek.value = 0;
    chapters.hidden = !sequence;
    $('sound-scope').textContent = sequence
      ? 'Estos ajustes se aplican a la obra completa.'
      : 'Estos ajustes se aplican a este lugar.';
    loadScene();
    restoreAudio();
  }
  select.addEventListener('change', selectMode);
  if (ending.rio && window.RIO_1984) {
    $('river').src = window.RIO_1984;
    style.setProperty('--river-mask', `url(${JSON.stringify(window.RIO_1984)})`);
  }
  $('coda').textContent = ending.texto;
  rebuildTimeline();
  selectMode();
  window.configurarPresencia($('composition'), reactToPresence);
})();
