# Material satelital para la obra

- `timelapse_1984-2022.mp4`: tramo histórico, sin interfaz ni rótulos. Tiene
  39 mosaicos anuales, a medio segundo por año. Dura 19,5 segundos.
- `territorio_2000.png`, `territorio_2015.png`, `territorio_2022.png`: tres
  referencias del mismo encuadre. 2000 sirve para ver la etapa anterior a la
  expansión visible en el sector derecho; 2015 y 2022 muestran etapas posteriores.
- `comparacion.jpg`: hoja con ocho años para decidir el tramo de la obra.
- `encuadre.json`: centro de la vista compartida y límites del recorte propuesto.

Todos los archivos principales usan el mismo recorte fijo de 1920 × 1080,
centrado en la vista compartida (−12.92888, −70.18091). El encuadre del visor
puede variar con el tamaño de la ventana; este recorte queda fijo para montaje.

Se prepararon a partir de los videos geográficos públicos que sirven al visor.
Son imágenes RGB para uso visual, no GeoTIFF originales ni una clasificación
automática del impacto de la minería. No se añadió crecimiento futuro, fechas
intermedias artificiales ni una interpolación entre años.

Crédito para el montaje: **Google Earth Timelapse (Google, Landsat, Copernicus)**.
Material del visor bajo [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Contiene datos Copernicus Sentinel modificados (2015–2022). Cambios en esta
entrega: unión de los fragmentos, recorte y recodificación del video.
[Ficha oficial](https://developers.google.com/earth-engine/timelapse/about).

## Probar otros encuadres

Las carpetas `pariamanu` y `camanti` tienen su propio MP4, una comparación
de ocho años y PNG de referencia con el mismo recorte. Las coordenadas del
centro y los límites quedan en el `encuadre.json` de cada carpeta.

Desde `arte`, usa un nombre de carpeta nuevo y cambia la latitud y la longitud
por el centro que quieras probar. Este ejemplo reproduce Pariamanu:

```powershell
.\venv\Scripts\python.exe .\material_timelapse\preparar.py --lugar pariamanu --centro -12.420 -69.387 --zoom 12 --ancho 1280
```

`--zoom 12` usa los mosaicos más cercanos del visor. Con el mismo zoom, un
ancho mayor incluye más terreno. El programa conserva la proporción 16:9 y
guarda el nuevo lugar por separado. Luego duplica una ficha en
`montaje_obra/ajustes.js` y cambia `nombre` y `video`.

La carpeta `fuente` contiene los archivos públicos usados por `preparar.py`.
Con esos archivos presentes, puede volver a ejecutarse desde la carpeta `arte`
con `.\venv\Scripts\python.exe .\material_timelapse\preparar.py`.
