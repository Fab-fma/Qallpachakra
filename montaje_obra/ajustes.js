// Edita este archivo y recarga index.html. No hace falta tocar montaje.js.
// Los tiempos se miden en segundos desde que empieza cada escena.
// Posición X/Y: 0–100 % del encuadre; (50, 50) es el centro.
// Para añadir otro lugar, duplica este bloque dentro de la lista y cambia sus archivos.
const sonidoBase = {
  archivo: 'primer_soplo.wav', procedural: true,
  entrada: 4, volumen: 65, fondo: 28,
  intervalo: 8, intervaloFinal: .65, desde: 58,
  irregularidad: 38, variacion: 20, nivelInicial: 55,
};
const filtrosBase = { entrada: 28, fundido: 28, saturacion: 62, brillo: 88, contraste: 100 };
const resonanciaBase = { archivo: '../cerebro.png', entrada: 44, fundido: 15, opacidad: 21 };
const credito = 'Google Earth Timelapse (Google, Landsat, Copernicus) · CC BY 4.0';
const notaFuente = 'Contiene datos Copernicus Sentinel modificados (2015–2022).';

// Los lugares se proyectan en el orden de ESCENAS. El audio de la obra es continuo.
window.FUNCION = {
  fundido: 1.6, // Segundos a cada lado del corte.
  sonido: {
    ...sonidoBase, entrada: 6, intervalo: 9, desde: 58, irregularidad: 52, variacion: 24,
    intervaloFinal: .45, estiramientoFinal: .86, picoEnCierre: 18,
  },
};

window.ESCENAS = [
  {
    nombre: 'Río Pariamanu',
    video: '../material_timelapse/pariamanu/timelapse_1984-2022.mp4',
    anios: [1984, 2022],
    credito, notaFuente,
    mapa: { x: 48, y: 53, zoom: 100, margen: 1.12 },
    tiempo: { esperaInicial: 4, recorrido: 34, pausaFinal: 13 },
    mri: { ...resonanciaBase, x: 66, y: 54, tamano: 110, entrada: 36, fundido: 5, opacidad: 5 },
    filtros: { ...filtrosBase, entrada: 31, fundido: 10, saturacion: 87, brillo: 95 },
    crecimiento: { zona: 'pariamanu', espera: 2, duracion: 8, maduracion: 4, opacidad: 74 },
    textura: { grano: 19 },
    sonido: { ...sonidoBase, desde: 68 },
  },
  {
    nombre: 'Camanti · Cusco',
    video: '../material_timelapse/camanti/timelapse_1984-2022.mp4',
    anios: [1984, 2022],
    credito, notaFuente,
    mapa: { x: 50, y: 50, zoom: 100, margen: 1.12 },
    tiempo: { esperaInicial: 2, recorrido: 35, pausaFinal: 17 },
    mri: { ...resonanciaBase, x: 52, y: 52, tamano: 105, entrada: 26, fundido: 10, opacidad: 12 },
    filtros: { ...filtrosBase, entrada: 24, fundido: 14, saturacion: 76, brillo: 92 },
    crecimiento: { zona: 'camanti', espera: 2, duracion: 11, maduracion: 6, opacidad: 85 },
    textura: { grano: 22 },
    sonido: { ...sonidoBase, desde: 56 },
  },
  {
    nombre: 'Madre de Dios',
    video: '../material_timelapse/con_margen/timelapse_1984-2022.mp4',
    anios: [1984, 2022], // Un fotograma anual por año, todos de igual duración.
    credito, notaFuente,
    mapa: { x: 34, y: 55, zoom: 100, margen: 2560 / 1920 },
    tiempo: { esperaInicial: 2, recorrido: 47, pausaFinal: 26 },
    mri: { ...resonanciaBase, x: 61, y: 57, tamano: 122, entrada: 34 },
    filtros: { ...filtrosBase, entrada: 22, fundido: 28 },
    // Empieza después de llegar a 2022, sobre el último mosaico.
    crecimiento: { zona: 'madre', espera: 3, duracion: 20, maduracion: 7, opacidad: 98 },
    textura: { grano: 25 }, // Grano final. intervalo: 1.2 fija el intervalo en segundos.
    sonido: { ...sonidoBase, intervaloFinal: .45, estiramientoFinal: .86, picoEnCierre: 18 },
  },
];
