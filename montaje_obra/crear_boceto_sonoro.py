"""Crea una variante más espaciada sin reemplazar respiracion_boceto.wav."""
from pathlib import Path
import wave

import numpy as np

sample_rate = 44100
duration = 60
count = round(duration * sample_rate)
t = np.arange(count) / sample_rate
rng = np.random.default_rng(9820)
f = np.fft.rfftfreq(count, 1 / sample_rate)
noise = np.fft.irfft(np.fft.rfft(rng.standard_normal(count)) *
                     ((f / 115) ** 2 / (1 + (f / 115) ** 2)) / (1 + (f / 1050) ** 2))
noise /= noise.std()
breath = np.zeros(count)
# (segundo de entrada en el WAV, duración del soplo, intensidad)
respiraciones = [
    (1, 2.6, 1), (7.6, 2.4, .92), (15, 2.1, .84), (23.4, 1.75, .74),
    (32.5, 1.36, .63), (41.5, .96, .49), (49, .67, .36), (54, .38, .21),
]
for start, length, strength in respiraciones:
    k = (t - start) / length
    mask = (k >= 0) & (k <= 1)
    breath[mask] = strength * np.sin(np.pi * k[mask]) ** 1.7
bed = .11 * np.sin(2 * np.pi * 53 * t) + .07 * np.sin(2 * np.pi * 79.5 * t)
fade = np.clip(t / 2.5, 0, 1) * np.clip((54.5 - t) / 34, 0, 1) ** 1.5
audio = .6 * noise * breath + bed * fade
audio *= .38 / np.max(np.abs(audio))
pcm = np.int16(np.clip(audio, -1, 1) * 32767)
with wave.open(str(Path(__file__).with_name('respiracion_larga.wav')), 'wb') as out:
    out.setnchannels(1)
    out.setsampwidth(2)
    out.setframerate(sample_rate)
    out.writeframes(pcm.tobytes())
