'use strict';

// Ensayo con ratón y lectura de silueta contra una referencia del espacio vacío.
window.configurarPresencia = function configurarPresencia(stage, onSignal) {
  const cameraButton = document.getElementById('camera');
  const rehearsal = document.getElementById('rehearsal');
  const label = document.getElementById('presence-state');
  const video = document.createElement('video');
  video.muted = video.playsInline = true;
  const canvas = document.createElement('canvas');
  const width = canvas.width = 96;
  const height = canvas.height = 54;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  let mode = 'manual', stream, timer, leave, generation = 0;

  function choose(next) {
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
    label.textContent = next === 'rehearsal'
      ? 'Mueve el cursor sobre la imagen. Hacia abajo equivale a acercarte.'
      : next === 'manual' ? 'Control manual' : 'Esperando permiso de cámara…';
    onSignal(next, null);
  }

  function pointer(event) {
    if (mode !== 'rehearsal') return;
    clearTimeout(leave);
    const box = stage.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    const y = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height));
    onSignal(mode, {x, y, near: y});
  }

  stage.addEventListener('pointerenter', pointer);
  stage.addEventListener('pointermove', pointer);
  stage.addEventListener('pointerleave', () => {
    if (mode === 'rehearsal') leave = setTimeout(() => onSignal(mode, null), 1800);
  });
  rehearsal.addEventListener('click', () => choose(mode === 'rehearsal' ? 'manual' : 'rehearsal'));

  function luma() {
    context.drawImage(video, 0, 0, width, height);
    const rgba = context.getImageData(0, 0, width, height).data;
    const gray = new Float32Array(width * height);
    for (let i = 0; i < gray.length; i++) {
      const j = i * 4;
      gray[i] = .299 * rgba[j] + .587 * rgba[j + 1] + .114 * rgba[j + 2];
    }
    return gray;
  }

  function locate(frame, background) {
    // Compensa cambios uniformes de luz antes de contar los píxeles de la silueta.
    const histogram = new Uint16Array(511);
    for (let i = 0; i < frame.length; i++) histogram[Math.round(frame[i] - background[i]) + 255]++;
    let bin = 0, accumulated = histogram[0];
    while (accumulated < frame.length / 2) accumulated += histogram[++bin];
    const light = bin - 255;
    let mass = 0, x = 0, y = 0;
    for (let i = 0; i < frame.length; i++) {
      if (Math.abs(frame[i] - background[i] - light) < 30) continue;
      mass++;
      x += i % width;
      y += Math.floor(i / width);
    }
    const area = mass / frame.length;
    if (area < .038 || area > .74) return null;
    return {
      x: 1 - x / mass / (width - 1),
      y: y / mass / (height - 1),
      near: Math.min(1, (area - .038) / .28),
    };
  }

  function track() {
    let background, firstFrame, seenAt, lastSeen, active = false;
    label.textContent = 'Aléjate del encuadre durante 3 segundos para calibrar.';
    timer = setInterval(() => {
      if (video.readyState < 2) return;
      const now = performance.now();
      firstFrame ??= now;
      if (!background) {
        if (now - firstFrame < 3000) return;
        background = luma();
        label.textContent = 'Cámara lista · esperando presencia';
        return;
      }
      const signal = locate(luma(), background);
      if (signal) {
        seenAt ??= now;
        lastSeen = now;
        if (now - seenAt >= 400) {
          if (!active) label.textContent = 'Presencia detectada';
          active = true;
          onSignal(mode, signal);
        }
      } else {
        seenAt = undefined;
        if (active && now - lastSeen > 2000) {
          active = false;
          label.textContent = 'En pausa · esperando presencia';
          onSignal(mode, null);
        }
      }
    }, 130);
  }

  cameraButton.addEventListener('click', async () => {
    if (mode === 'camera') { choose('manual'); return; }
    choose('camera');
    const request = generation;
    try {
      const incoming = await navigator.mediaDevices.getUserMedia({
        video: {width: {ideal: 320}, height: {ideal: 180}, frameRate: {ideal: 10}}, audio: false,
      });
      if (request !== generation) { incoming.getTracks().forEach(item => item.stop()); return; }
      stream = incoming;
      video.srcObject = stream;
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (request !== generation) return;
        choose('manual');
        label.textContent = 'Se desconectó la cámara. Puedes ensayar con el cursor.';
      });
      await video.play();
      if (request === generation) track();
    } catch {
      if (request !== generation) return;
      choose('manual');
      label.textContent = 'La cámara no está disponible. Revisa el permiso o usa el ensayo con el cursor.';
    }
  });
  window.addEventListener('pagehide', () => choose('manual'));
};
