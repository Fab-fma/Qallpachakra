"""Calcula el crecimiento artístico para los tres encuadres RGB."""
from base64 import b64encode
from heapq import heappop, heappush
from pathlib import Path
import json

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'material_timelapse'
WIDTH, HEIGHT = 320, 180
TEXTURE_SIZE = (1280, 720)

# Limita las semillas a las cicatrices centrales. Los ríos principales quedan fuera.
MADRE = [
    (.58, .59), (.595, .49), (.612, .39), (.653, .30), (.685, .26),
    (.717, .25), (.744, .206), (.81, .186), (.813, .29), (.785, .38),
    (.793, .49), (.743, .566), (.777, .585), (.850, .62), (.877, .672),
    (.820, .675), (.764, .647), (.716, .643), (.666, .653), (.635, .622),
    (.581, .626),
]
PARIAMANU = [
    [(.56, .343), (.595, .343), (.619, .354), (.651, .355), (.656, .402), (.57, .408)],
    [(.749, .553), (.775, .535), (.819, .557), (.825, .599), (.863, .634), (.904, .625),
     (.899, .687), (.824, .694), (.787, .656), (.736, .636)],
]
CAMANTI = [
    [(.28, .21), (.35, .20), (.39, .42), (.45, .442), (.476, .481), (.528, .437),
     (.568, .439), (.579, .552), (.471, .573), (.38, .55), (.299, .535), (.311, .452),
     (.35, .417), (.324, .332)],
    [(.225, .534), (.291, .543), (.273, .599), (.252, .644), (.277, .723),
     (.23, .797), (.2, .762), (.241, .685), (.208, .632)],
]
PLACES = {
    'madre': dict(folder='con_margen', polygons=[MADRE], luma=130, change=34, area=7,
                  max_cost=19, seed=31, filename='dano_textura.png'),
    'pariamanu': dict(folder='pariamanu', polygons=PARIAMANU, luma=125, change=32, area=4,
                      max_cost=8, seed=52, filename='dano_pariamanu.png'),
    'camanti': dict(folder='camanti', polygons=CAMANTI, luma=104, change=25, area=5,
                    max_cost=11, seed=73, filename='dano_camanti.png'),
}
NEIGHBORS = [
    (-1, 0, .94), (1, 0, .94), (0, -1, 1.08), (0, 1, 1.08),
    (-1, -1, 1.42), (-1, 1, 1.42), (1, -1, 1.42), (1, 1, 1.42),
]


def load_year(folder, year):
    image = cv2.imread(str(SOURCE / folder / f'territorio_{year}.png'))
    if image is None:
        raise FileNotFoundError(f'Falta el mosaico {year} de {folder}.')
    image = cv2.resize(image, (WIDTH, HEIGHT), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB).astype(np.float32)


def rgb_luma(image):
    return image @ np.array([.299, .587, .114], dtype=np.float32)


def seeds_from_images(before, after, polygons, minimum_luma, minimum_change, minimum_area):
    contours = [(np.array(polygon) * (WIDTH, HEIGHT)).round().astype(np.int32) for polygon in polygons]
    area = cv2.fillPoly(np.zeros((HEIGHT, WIDTH), np.uint8), contours, 1)
    luma = rgb_luma(after)
    red, green, blue = np.moveaxis(after, -1, 0)
    recent = luma - rgb_luma(before)
    bright = (luma > minimum_luma) & (red >= green - 5) & (green >= blue + 6) & (recent > minimum_change)
    _, labels, stats, _ = cv2.connectedComponentsWithStats((area & bright).astype(np.uint8))
    kept = stats[:, cv2.CC_STAT_AREA] >= minimum_area
    kept[0] = False
    return kept[labels]


def arrival_cost(seeds, cost, bounds, max_cost):
    arrival = np.full((HEIGHT, WIDTH), np.inf)
    arrival[seeds] = 0
    queue = [(0., int(y), int(x)) for y, x in np.argwhere(seeds)]
    while queue:
        current, y, x = heappop(queue)
        if current != arrival[y, x]:
            continue
        for dy, dx, step in NEIGHBORS:
            ny, nx = y + dy, x + dx
            if not (0 <= ny < HEIGHT and 0 <= nx < WIDTH and bounds[ny, nx]):
                continue
            next_cost = current + step * (cost[y, x] + cost[ny, nx]) * .5
            if next_cost < max_cost and next_cost < arrival[ny, nx]:
                arrival[ny, nx] = next_cost
                heappush(queue, (next_cost, ny, nx))
    return arrival


def build_place(folder, polygons, luma, change, area, max_cost, seed, filename):
    before, after = load_year(folder, 2000), load_year(folder, 2022)
    seeds = seeds_from_images(before, after, polygons, luma, change, area)
    if not seeds.any():
        raise ValueError(f'El recorte de {folder} no produjo semillas de crecimiento.')
    rng = np.random.default_rng(seed)
    broad = cv2.resize(rng.random((30, 49)), (WIDTH, HEIGHT), interpolation=cv2.INTER_CUBIC)
    fine = cv2.resize(rng.random((88, 150)), (WIDTH, HEIGHT), interpolation=cv2.INTER_LINEAR)
    texture = np.clip(.69 * broad + .31 * fine, 0, 1)
    cost = 0.49 + 1.8 * texture ** 2 + .80 * (1 - fine) ** 3
    # En Madre de Dios el recorte incluye dos corredores fluviales grandes.
    bounds = rgb_luma(after) > 31
    if folder == 'con_margen':
        bounds[:32] = False
        bounds[124:] = False
    arrival = arrival_cost(seeds, cost, bounds | seeds, max_cost)
    spreading = np.isfinite(arrival) & ~seeds
    times = np.full((HEIGHT, WIDTH), 255, np.uint8)
    times[spreading] = (8 + 238 * arrival[spreading] / max_cost).astype(np.uint8)

    # La expansión se calcula a baja resolución y la textura conserva detalle fino.
    detailed = cv2.resize(rng.random((242, 430)), TEXTURE_SIZE, interpolation=cv2.INTER_CUBIC)
    grain = rng.random(TEXTURE_SIZE[::-1])
    tone = np.clip(.22 * cv2.resize(broad, TEXTURE_SIZE) + .32 * cv2.resize(fine, TEXTURE_SIZE)
                   + .31 * detailed + .15 * grain, 0, 1)
    colors = np.stack([112 + 141 * tone, 77 + 148 * tone, 43 + 139 * tone], axis=-1)
    opacity = np.clip((tone - .28) / .40, 0, 1) ** .83
    taper = np.clip((max_cost - np.minimum(arrival, max_cost)) / min(2.4, max_cost / 4), 0, 1)
    opacity *= cv2.resize(taper * spreading, TEXTURE_SIZE)
    visual = np.dstack([colors, 255 * opacity]).astype(np.uint8)
    visual[visual[:, :, 3] == 0] = 0
    if not cv2.imwrite(str(HERE / filename), cv2.cvtColor(visual, cv2.COLOR_RGBA2BGRA)):
        raise OSError('No se pudo guardar la textura de expansión.')
    print(f'{folder}: {seeds.sum()} semillas y {spreading.sum()} celdas de expansión.')
    return dict(texture=filename, times=b64encode(times.tobytes()).decode('ascii'))


def build():
    data = dict(width=WIDTH, height=HEIGHT, places={key: build_place(**profile) for key, profile in PLACES.items()})
    (HERE / 'dano_datos.js').write_text(
        '// Generado por preparar_dano.py a partir de los mosaicos 2000 y 2022.\n'
        'window.DANO_DATOS = ' + json.dumps(data, separators=(',', ':')) + ';\n',
        encoding='utf-8',
    )


if __name__ == '__main__':
    build()
