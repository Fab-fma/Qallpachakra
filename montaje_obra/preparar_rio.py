"""Extrae el cauce principal del primer mosaico para la espera y el cierre."""
from base64 import b64encode
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
VIDEO = HERE.parent / 'material_timelapse' / 'con_margen' / 'timelapse_1984-2022.mp4'
CENTERLINE = [
    (.24, 1), (.24, .92), (.26, .82), (.28, .74), (.294, .66),
    (.296, .57), (.302, .48), (.326, .386), (.371, .318),
    (.429, .264), (.513, .222), (.627, .195), (.736, .166),
    (.839, .133), (.934, .085), (1, .03),
]


def main():
    capture = cv2.VideoCapture(str(VIDEO))
    ok, image = capture.read()
    capture.release()
    if not ok:
        raise RuntimeError('No se pudo leer el primer mosaico.')

    image = cv2.resize(image, (1600, 900), interpolation=cv2.INTER_AREA)
    h, w = image.shape[:2]
    corridor = np.zeros((h, w), dtype=np.uint8)
    points = (np.array(CENTERLINE) * (w - 1, h - 1)).astype(np.int32)
    cv2.polylines(corridor, [points], False, 255, 52, cv2.LINE_AA)
    corridor = cv2.GaussianBlur(corridor, (0, 0), 5)
    luminance = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.float32)
    alpha = np.clip((luminance - 87) / 90, 0, 1) ** 1.4 * corridor
    gray = np.clip(luminance * 1.2 + 19, 0, 255)
    river = np.dstack([gray * .89, gray * .95, gray, alpha]).astype(np.uint8)
    river[river[:, :, 3] == 0] = 0
    ok, png = cv2.imencode('.png', river, [cv2.IMWRITE_PNG_COMPRESSION, 7])
    if not ok:
        raise OSError('No se pudo guardar el cauce.')
    data = b64encode(png).decode('ascii')
    (HERE / 'rio_1984.js').write_text(
        '// Generado por preparar_rio.py a partir del primer mosaico.\n'
        f'window.RIO_1984 = "data:image/png;base64,{data}";\n',
        encoding='utf-8',
    )


if __name__ == '__main__':
    main()
