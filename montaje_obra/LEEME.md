# El territorio respira — montaje editable

Abre `index.html` en Chrome o Edge y pulsa **Reproducir**. Conserva
`montaje_obra`, `material_timelapse` y `cerebro.png` en sus posiciones actuales.
La página puede abrirse como archivo local. **Proyectar** oculta los controles.
Espacio pausa o reanuda, y Esc vuelve a los ajustes.

## Cómo se encadenan los lugares

**Obra completa** dura 3 min. El selector **Escena** permite revisar también cada
lugar por separado. En la obra completa, la barra recorre los tres lugares
y los botones debajo del video permiten saltar a cada uno.

| Inicio | Lugar | Qué se revela |
| --- | --- | --- |
| 0:00 | Río Pariamanu | Tras 2022 crecen claros separados alrededor de los meandros. |
| 0:51 | Camanti | La expansión sigue las ramificaciones del valle y la forma cerebral empieza a reconocerse. |
| 1:45 | Madre de Dios | La resonancia se hace más visible y los soplos se superponen. |
| 2:37 | Cierre de Madre de Dios | La expansión más extensa crece sobre el último mosaico. |

Los lugares entran y salen con un fundido breve. El fondo y los soplos forman
una sola pista a lo largo de la obra. **Reiniciar** sortea un patrón nuevo desde
el principio. Pausar, reanudar o mover la barra conserva el patrón de esa pasada.
En **Capas**, elige **Mapa + crecimiento** para revisar la expansión por
separado con su grano visual. **Solo mapa** deja los mosaicos históricos.
**Montaje completo** activa también la resonancia, el sonido y los filtros
del paisaje.

## Probar cambios en la página

1. En **Imagen**, activa **Mostrar para ajustar**. Mueve la resonancia con sus
   controles Horizontal y Vertical. También puedes cambiar su tamaño y opacidad.
   La vista de ajuste se desactiva al reproducir o proyectar.
2. Mueve el mapa con sus propios controles. La exportación incluye margen para
   conservar el tamaño del paisaje del encuadre original. Si el desplazamiento
   supera el margen, el mapa se acerca automáticamente para cubrir el borde.
3. En **Tiempo**, cambia la duración del recorrido, la espera inicial
   o la pausa final del lugar que estás viendo. En **Obra completa**, el encabezado
   del panel indica a qué escena corresponden los ajustes de imagen y tiempo.
4. Ajusta la entrada y el fundido de la resonancia por separado. En **Sonido**,
   **Volumen de fondo** regula el aire mecánico y **Acumulación desde** decide
   en qué porcentaje del recorrido empiezan a acercarse los soplos. En
   **Obra completa**, los controles de sonido afectan a la secuencia entera.
   **Intervalo final** controla cuánto se superponen en la pausa final.
   **Irregularidad** modifica la separación y **Variación de duración** cambia
   cuánto duran los soplos posteriores al primero. Desmarca **Fondo y soplos
   que se acumulan** para recuperar el soplo fijo. **Probar otra pista** permite
   escuchar un archivo local durante esa sesión.
5. En **Filtros**, cambia la saturación, el brillo y el contraste finales.
   **Ver al máximo para ajustar** los aplica de inmediato. Usa **Empieza en** y
   **Duración del fundido** para decidir cuándo empieza el desgaste y cuánto
   tarda en alcanzar esos valores. **Grano de la expansión** ajusta cuánta
   textura visual habrá al final. Aparece con el escenario artístico y
   conserva cada patrón durante un intervalo, igual que el timelapse.
   Al reproducir o proyectar se desactiva la vista de ajuste.
6. Para guardar los números, pulsa **Descargar ajustes.js**. Reemplaza el archivo
   `ajustes.js` de esta carpeta con la copia descargada y recarga la página. Para
   conservar un audio de prueba, copia también el audio al proyecto y cambia su
   ruta en `FUNCION.sonido.archivo` para toda la obra o en `sonido.archivo`
   para un lugar. Pon `procedural` en `false` y quita `intervalo` si es una
   pista continua.

## Cambiar directamente el código

El archivo a editar es **`ajustes.js`**. `montaje.js` contiene el reproductor.
`estilo.css` contiene la apariencia y `index.html` contiene los controles.

| Quiero cambiar… | Campo de `ajustes.js` |
| --- | --- |
| Posición y zoom del paisaje | `mapa.x`, `mapa.y`, `mapa.zoom` |
| Posición, tamaño o transparencia de la resonancia | `mri.x`, `mri.y`, `mri.tamano`, `mri.opacidad` |
| Cuándo aparece y cuánto tarda en revelarse | `mri.entrada`, `mri.fundido` |
| Duración total | Suma de `tiempo.esperaInicial`, `tiempo.recorrido` y `tiempo.pausaFinal` |
| Orden de los lugares y duración de cada fundido entre ellos | Orden en `ESCENAS` y `FUNCION.fundido` |
| Sonido compartido durante toda la obra | `FUNCION.sonido` |
| Rampa de volumen desde el inicio hasta el cierre | `sonido.nivelInicial` |
| Intensidad final e intervalo del grano | `textura.grano`, `textura.intervalo` |
| Volumen de fondo y punto donde empieza la acumulación | `sonido.fondo`, `sonido.desde` |
| Soplos y variaciones | `sonido.volumen`, `sonido.intervalo`, `sonido.intervaloFinal`, `sonido.irregularidad`, `sonido.variacion` |
| Desgaste del paisaje | `filtros.entrada`, `filtros.fundido`, `filtros.saturacion`, `filtros.brillo`, `filtros.contraste` |

Los tiempos se expresan en segundos y las posiciones en porcentajes del
encuadre. En X e Y, 50 es el centro. Subir X mueve a la derecha y subir Y hacia
abajo. `mri.entrada` se cuenta desde el inicio de su escena. La entrada de
`FUNCION.sonido` se cuenta desde el inicio de la obra completa. El primer
soplo conserva su duración de 1,85 segundos y puede entrar hasta 2,6 segundos
después del tiempo configurado. La acumulación se guía por el recorrido de la obra.

## Probar la presencia

- **Ensayar presencia** activa el control con el cursor. Entra en la imagen
  para comenzar, muévete de lado a lado y sal para pausar. Hacia abajo
  simula que te acercas. A medida que se revela la resonancia, la cercanía
  refuerza una zona concreta y el movimiento lateral desplaza esa zona.
- **Activar cámara** pide permiso al navegador. Deja el encuadre vacío por
  tres segundos tras concederlo. Usa una cámara fija, luz estable y apunta
  hacia el público. La detección compara siluetas con la vista inicial del
  espacio vacío. Cuando se pierde la silueta por unos dos segundos, la obra
  queda en pausa. Si ya acabó, vuelve al principio para la próxima visita.
- La cámara se procesa en el navegador. No se graban imágenes ni se pide
  acceso al micrófono. En **Proyectar**, el movimiento se aplica a mapa,
  crecimiento y resonancia juntos. Para recalibrar, apaga y vuelve a activar
  la cámara con el espacio vacío.

## Ajustar el crecimiento final

En cada ficha, `crecimiento.espera` indica los segundos que
transcurren desde 2022 hasta que comienza la expansión. `crecimiento.duracion`
y `crecimiento.opacidad` controlan cuánto tarda y cuánto se ve.
`crecimiento.maduracion` indica cuánto tarda el color de cada punto en
intensificarse después de que llegue la expansión. Ajusta `tiempo.pausaFinal`
si necesitas más segundos después de llegar a 2022.
`textura.intervalo` permite fijar los segundos entre patrones. Si se omite,
el grano toma el intervalo entre mosaicos de ese lugar.

`preparar_dano.py` compara 2000 y 2022 en una cuadrícula de 320 × 180.
Dentro de la franja central, usa los píxeles claros recientes como semillas.
El crecimiento se propaga de vecino en vecino con un coste irregular y
estable. Cada lugar tiene una ficha en `PLACES`, con sus polígonos,
umbrales, coste máximo y semilla. Ejecuta el script desde `arte` para
regenerar las texturas y los mapas de llegada.

```powershell
.\venv\Scripts\python.exe .\montaje_obra\preparar_dano.py
```

El tramo final es un escenario artístico. Los mosaicos RGB aportan las
formas de partida y el crecimiento es sintético.

## Añadir otro lugar

Duplica la ficha completa dentro de `window.ESCENAS` y cambia `nombre`, `video`,
`anios` y `credito`. Las rutas son relativas a `index.html`. Reencuadra el MRI
con los controles. Puedes conservarlo y compartir la pista de respiración, o
darle a la ficha sus propios `mri.archivo` y `sonido.archivo`. Si `anios` se
omite, no aparece un año. Úsalo solo para timelapses con un fotograma por año
de duración uniforme. Los lugares se suman a la obra completa según su orden
en `ESCENAS` y aparecen también por separado. Quita `mapa.margen` si el MP4 nuevo ya tiene el
encuadre final y no incluye paisaje adicional alrededor.

El selector incluye Madre de Dios, Río Pariamanu y Camanti. Los años
corresponden al material histórico. Consulta cómo crear otra secuencia
por coordenadas en la [guía del material satelital](../material_timelapse/LEEME.md).
Conservar la acreditación del [material de origen](../material_timelapse/LEEME.md).
