"""Reúne el material visual anual del visor de Google Earth Timelapse.

Los archivos del visor son videos geográficos de 39 fotogramas. Aquí se
reconstruye el mismo rectángulo de píxeles para todos los años. El resultado es
material visual RGB del visor, no una exportación GeoTIFF de Earth Engine.
"""
from __future__ import annotations

from argparse import ArgumentParser
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from datetime import date
import json
from math import asinh, atan, degrees, pi, radians, sinh, tan
from pathlib import Path
from urllib.request import urlopen

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
SOURCE = 'https://storage.googleapis.com/earthengine-timelapse/2023/earth/20230206'
LAT, LON = -12.92888, -70.18091  # Centro de la vista compartida.
ZOOM, TILE = 11, 512
WIDTH, HEIGHT = 1920, 1080
FIRST, LAST = 1984, 2022
REFERENCES = (2000, 2015, 2022)
CONTACT = (1984, 1995, 2000, 2005, 2010, 2015, 2019, 2022)
OUTPUT_FPS, HOLD = 24, 12  # Medio segundo por año; sin interpolar.
ATTRIBUTION = 'Google Earth Timelapse (Google, Landsat, Copernicus)'


def crop_geometry():
    world = TILE * 2 ** ZOOM
    cx = (LON + 180) / 360 * world
    cy = (1 - asinh(tan(radians(LAT))) / pi) / 2 * world
    left, top = round(cx - WIDTH / 2), round(cy - HEIGHT / 2)
    right, bottom = left + WIDTH, top + HEIGHT
    xs = range(left // TILE, (right - 1) // TILE + 1)
    ys = range(top // TILE, (bottom - 1) // TILE + 1)
    lon = lambda x: x / world * 360 - 180
    lat = lambda y: degrees(atan(sinh(pi * (1 - 2 * y / world))))
    bounds = dict(west=lon(left), south=lat(bottom), east=lon(right), north=lat(top))
    return left, top, xs, ys, bounds


def download_tile(tile):
    x, y = tile
    target = HERE / 'fuente' / f'{ZOOM}_{x}_{y}.webm'
    if target.is_file():
        with target.open('rb') as cached:
            if cached.read(4) == b'\x1aE\xdf\xa3':
                return target
    url = f'{SOURCE}/{ZOOM}/{x}/{y}.webm'
    last_error = None
    for _ in range(2):
        try:
            with urlopen(url, timeout=16) as response:
                payload = response.read(8_000_001)
            if not payload.startswith(b'\x1aE\xdf\xa3') or len(payload) > 8_000_000:
                raise ValueError(f'Archivo inesperado: {url}')
            target.write_bytes(payload)
            print(f'Descargado {target.name}', flush=True)
            return target
        except (OSError, ValueError) as error:
            last_error = error
    raise RuntimeError(f'No se pudo obtener {url}') from last_error


def contact_sheet(frames, output):
    sheet = Image.new('RGB', (1260, 870), '#131b17')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 19)
    small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 14)
    for i, (year, frame) in enumerate(frames.items()):
        x, y = 20 + (i % 3) * 414, 20 + (i // 3) * 272
        draw.text((x, y), str(year), font=font, fill='#efe9db')
        sheet.paste(frame, (x, y + 30))
    draw.text((20, 840), ATTRIBUTION, font=small, fill='#c7cec6')
    sheet.save(output / 'comparacion.jpg', quality=94)


def main(output=HERE):
    output.mkdir(exist_ok=True)
    (HERE / 'fuente').mkdir(exist_ok=True)
    left, top, xs, ys, bounds = crop_geometry()
    tiles = [(x, y) for y in ys for x in xs]
    with ThreadPoolExecutor(max_workers=5) as pool:
        paths = list(pool.map(download_tile, tiles))
    print(f'Fuente: {len(paths)} archivos del visor.', flush=True)
    out_video = output / 'timelapse_1984-2022.mp4'
    pending = output / 'timelapse_en_proceso.mp4'
    comparisons = {}
    with ExitStack() as stack:
        readers = []
        for path in paths:
            reader = cv2.VideoCapture(str(path), cv2.CAP_FFMPEG, [cv2.CAP_PROP_N_THREADS, 1])
            stack.callback(reader.release)
            if (not reader.isOpened() or int(reader.get(cv2.CAP_PROP_FRAME_COUNT)) != LAST - FIRST + 1
                    or not np.isclose(reader.get(cv2.CAP_PROP_FPS), 5)):
                raise RuntimeError(f'Secuencia anual inesperada en {path.name}')
            readers.append(reader)
        writer = cv2.VideoWriter(str(pending), cv2.CAP_MSMF, cv2.VideoWriter_fourcc(*'H264'),
                                 OUTPUT_FPS, (WIDTH, HEIGHT))
        stack.callback(writer.release)
        if not writer.isOpened():
            raise RuntimeError('No se pudo abrir el codificador H.264 de Windows.')
        mosaic = np.empty((len(ys) * TILE, len(xs) * TILE, 3), np.uint8)
        px, py = left - xs.start * TILE, top - ys.start * TILE
        for year in range(FIRST, LAST + 1):
            for (x, y), reader in zip(tiles, readers):
                ok, frame = reader.read()
                if not ok or frame.shape != (TILE, TILE, 3):
                    raise RuntimeError(f'Falta el año {year} en {x}, {y}.')
                dx, dy = (x - xs.start) * TILE, (y - ys.start) * TILE
                mosaic[dy:dy + TILE, dx:dx + TILE] = frame
            crop = np.ascontiguousarray(mosaic[py:py + HEIGHT, px:px + WIDTH])
            if year in REFERENCES:
                if not cv2.imwrite(str(output / f'territorio_{year}.png'), crop):
                    raise RuntimeError(f'No se pudo guardar la imagen de {year}.')
            if year in CONTACT:
                small = cv2.resize(crop, (392, 220), interpolation=cv2.INTER_AREA)
                comparisons[year] = Image.fromarray(cv2.cvtColor(small, cv2.COLOR_BGR2RGB))
            for _ in range(HOLD):
                writer.write(crop)
    verify = cv2.VideoCapture(str(pending))
    try:
        if (int(verify.get(cv2.CAP_PROP_FRAME_COUNT)) != (LAST - FIRST + 1) * HOLD
                or not np.isclose(verify.get(cv2.CAP_PROP_FPS), OUTPUT_FPS)
                or not verify.read()[0]):
            raise RuntimeError('El MP4 no pasó la verificación de lectura.')
    finally:
        verify.release()
    pending.replace(out_video)
    contact_sheet(comparisons, output)
    (output / 'encuadre.json').write_text(json.dumps({
        'fuente': SOURCE, 'credito': ATTRIBUTION,
        'fecha_de_preparacion': str(date.today()),
        'centro_vista_compartida': {'latitud': LAT, 'longitud': LON},
        'bordes_wgs84': bounds, 'proyeccion': 'EPSG:3857',
        'ancho_px': WIDTH, 'alto_px': HEIGHT, 'zoom_de_fuente': ZOOM,
        'anios_video': [FIRST, LAST], 'anios_png': list(REFERENCES),
        'segundos_por_anio': HOLD / OUTPUT_FPS,
        'nota': 'Recorte fijo centrado en el enlace; sin menus, rotulos ni interpolacion añadida.',
    }, indent=2, ensure_ascii=False), encoding='utf-8')
    print('Video, imágenes de referencia y comparación listos.', flush=True)


if __name__ == '__main__':
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--margen', action='store_true', help='Añade cobertura alrededor del mismo encuadre.')
    parser.add_argument('--lugar', help='Nombre de la carpeta del nuevo encuadre.')
    parser.add_argument('--centro', type=float, nargs=2, metavar=('LAT', 'LON'))
    parser.add_argument('--zoom', type=int, choices=range(10, 13), default=12)
    parser.add_argument('--ancho', type=int, default=1280, help='Ancho nativo en píxeles; múltiplo de 32.')
    args = parser.parse_args()
    if args.lugar or args.centro:
        if (args.margen or not args.lugar or not args.centro
                or not args.lugar.replace('-', '').replace('_', '').isalnum()
                or args.lugar.lower() in {'fuente', 'con_margen'}):
            parser.error('Usa --lugar (letras, números, guiones) y --centro LAT LON juntos.')
        if not (320 <= args.ancho <= 2560) or args.ancho % 32:
            parser.error('--ancho debe ser múltiplo de 32 entre 320 y 2560.')
        LAT, LON = args.centro
        ZOOM = args.zoom
        WIDTH, HEIGHT = args.ancho, args.ancho * 9 // 16
        if not (-85 < LAT < 85 and -180 < LON < 180):
            parser.error('Coordenadas fuera del visor.')
        OUTPUT_FPS, HOLD = 2, 1
        main(HERE / args.lugar)
    elif args.margen:
        WIDTH, HEIGHT = 2560, 1440
        OUTPUT_FPS, HOLD = 2, 1  # Los mismos 0.5 s por año, sin fotogramas duplicados.
        main(HERE / 'con_margen')
    else:
        main()
