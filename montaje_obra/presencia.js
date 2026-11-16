'use strict';

// Ensayo con ratón y detección local de rostros con Pico.
window.configurarPresencia = function configurarPresencia(stage, onSignal) {
  const cameraButton = document.getElementById('camera');
  const rehearsal = document.getElementById('rehearsal');
  const label = document.getElementById('presence-state');
  const video = document.createElement('video');
  video.muted = video.playsInline = true;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', {willReadFrequently: true});
  let mode = 'manual', stream, timer, leave, classifier, generation = 0;

  function clamp(value) { return Math.max(0, Math.min(1, value)); }

  function choose(next, message) {
    generation++;
    clearInterval(timer);
    clearTimeout(leave);
    stream?.getTracks().forEach(track => track.stop());
    stream = undefined;
    video.srcObject = null;
    mode = next;
    cameraButton.setAttribute('aria-pressed', String(next === 'camera'));
    rehearsal.setAttribute('aria-pressed', String(next === 'rehearsal'));
    cameraButton.textContent = next === 'camera' ? 'Apagar cámara' : 'Activar cámara';
    rehearsal.textContent = next === 'rehearsal' ? 'Salir del ensayo' : 'Ensayar presencia';
    label.textContent = message ?? (next === 'rehearsal'
      ? 'Mueve el cursor sobre la imagen. Hacia abajo equivale a acercarte.'
      : next === 'manual' ? 'Control manual' : 'Esperando permiso de cámara…');
    onSignal(next, null);
  }

  function pointer(event) {
    if (mode !== 'rehearsal') return;
    clearTimeout(leave);
    const box = stage.getBoundingClientRect();
    const x = clamp((event.clientX - box.left) / box.width);
    const y = clamp((event.clientY - box.top) / box.height);
    onSignal(mode, {x, y, near: y});
  }

  stage.addEventListener('pointerenter', pointer);
  stage.addEventListener('pointermove', pointer);
  stage.addEventListener('pointerleave', () => {
    if (mode === 'rehearsal') leave = setTimeout(() => onSignal(mode, null), 1800);
  });
  rehearsal.addEventListener('click', () => choose(mode === 'rehearsal' ? 'manual' : 'rehearsal'));

  function track() {
    const scale = Math.min(1, 256 / Math.max(video.videoWidth, video.videoHeight));
    const width = canvas.width = Math.round(video.videoWidth * scale);
    const height = canvas.height = Math.round(video.videoHeight * scale);
    const shortSide = Math.min(width, height);
    const pixels = new Uint8Array(width * height);
    const image = {pixels, nrows: height, ncols: width, ldim: width};
    const scan = {
      shiftfactor: .12, scalefactor: 1.15,
      minsize: Math.max(22, Math.round(shortSide * .14)), maxsize: shortSide,
    };
    let lastFrame, seenAt, lastSeen, active = false, smoothed;
    label.textContent = 'Esperando rostro';

    function locate() {
      context.drawImage(video, 0, 0, width, height);
      const rgba = context.getImageData(0, 0, width, height).data;
      for (let i = 0; i < pixels.length; i++) {
        const j = i * 4;
        pixels[i] = (2 * rgba[j] + 7 * rgba[j + 1] + rgba[j + 2]) / 10;
      }
      const detections = window.pico.run_cascade(image, classifier, scan);
      const face = window.pico.cluster_detections(detections, .2).find(item => item[3] >= 5);
      if (!face) return null;
      const [row, column, size] = face;
      return {
        x: 1 - clamp(column / width), y: clamp(row / height),
        near: clamp((size / shortSide - .18) / .48),
      };
    }

    timer = setInterval(() => {
      const now = performance.now();
      if (now - lastSeen >= 650) {
        lastSeen = undefined;
        seenAt = undefined;
        if (active) {
          active = false;
          smoothed = undefined;
          label.textContent = 'Esperando rostro';
          onSignal(mode, null);
        }
      }
      // Un fotograma congelado nunca renueva la detección.
      if (video.readyState < 2 || video.currentTime === lastFrame) return;
      lastFrame = video.currentTime;
      const signal = locate();
      if (!signal) { seenAt = undefined; return; }
      seenAt ??= now;
      lastSeen = now;
      if (!active && now - seenAt < 350) return;
      if (!active) label.textContent = 'Rostro detectado';
      active = true;
      smoothed ??= {...signal};
      for (const key of ['x', 'y', 'near']) smoothed[key] += (signal[key] - smoothed[key]) * .2;
      onSignal(mode, {...smoothed});
    }, 130);
  }

  cameraButton.addEventListener('click', async () => {
    if (mode === 'camera') { choose('manual'); return; }
    choose('camera');
    const request = generation;
    try {
      classifier ??= window.pico.unpack_cascade(Uint8Array.from(
        atob(window.CASCADA_ROSTRO), character => character.charCodeAt(0),
      ));
    } catch {
      choose('camera-error', 'No se cargó el detector facial. Recarga la página o ensaya con el cursor.');
      return;
    }
    try {
      const incoming = await navigator.mediaDevices.getUserMedia({
        video: {width: {ideal: 320}, height: {ideal: 180}, frameRate: {ideal: 10}}, audio: false,
      });
      if (request !== generation) { incoming.getTracks().forEach(item => item.stop()); return; }
      stream = incoming;
      video.srcObject = stream;
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (request !== generation) return;
        choose('camera-error', 'Se desconectó la cámara. Puedes volver a activarla o ensayar con el cursor.');
      });
      await video.play();
      if (request === generation) track();
    } catch {
      if (request !== generation) return;
      choose('camera-error', 'La cámara no está disponible. Revisa el permiso o ensaya con el cursor.');
    }
  });
  window.addEventListener('pagehide', () => choose('manual'));
};
