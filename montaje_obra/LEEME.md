# El territorio respira — montaje editable

Abre `index.html` en Chrome o Edge y pulsa **Reproducir**. Conserva
`montaje_obra`, `material_timelapse` y `cerebro.png` en sus posiciones actuales.
La página puede abrirse como archivo local. **Proyectar** oculta los controles.
Espacio pausa o reanuda, y Esc vuelve a los ajustes.

## Cómo se encadenan los lugares

**Obra completa** dura 1 min 30 s y se centra en Madre de Dios. El selector
**Escena** también permite revisar el montaje de Madre de Dios por separado.

| Inicio | Lugar | Qué se revela |
| --- | --- | --- |
| 0:00 | Madre de Dios | El paisaje cambia a lo largo del timelapse. |
| 0:52 | Expansión | La zona dañada crece sobre el último mosaico. |
| 1:15 | Cierre | Sube el contraste, el daño se pierde en negro y la resonancia se funde con el cauce de 1984. |
| 1:30 | Espera | Queda solo el cauce de 1984, con un fondo tenue. |

En modo manual, una pasada iniciada con **Reproducir** vuelve a empezar
después de 4 segundos de espera. Con cámara, vuelve a empezar si aún detecta
un rostro. Si el encuadre está vacío, el cauce queda en espera hasta que llegue alguien.
El sonido de espera se activa tras pulsar **Proyectar**, **Reproducir** o
activar el modo de presencia. **Reiniciar** sortea un patrón nuevo desde
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
3. En **Tiempo → Duración del timelapse**, cambia cuánto permanece cada año
   en pantalla. El valor debajo del control indica los segundos por año.
   En **Obra completa**, el encabezado
   del panel indica a qué escena corresponden los ajustes de imagen y tiempo.
4. Ajusta la entrada y el fundido de la resonancia por separado. En **Sonido**,
   **Volumen de fondo** regula el aire mecánico y **Acumulación desde** decide
   en qué porcentaje del recorrido empiezan a acercarse los soplos. En
   **Obra completa**, los controles de sonido afectan a la secuencia entera.
   **Intervalo final** controla cuánto se superponen en la pausa final.
   **Irregularidad** modifica la separación y **Variación de duración** cambia
   cuánto duran los soplos posteriores al primero. Desmarca **Fondo y soplos
   que se acumulan** para recuperar el soplo fijo. **Probar otra pista** permite
   escuchar un archivo local durante esa sesión. **Amplitud estéreo** da a los
   soplos un ligero desplazamiento a izquierda y derecha. Al acumularse se
   acercan al centro. En 0 %, quedan centrados. **Fondo en espera** ajusta el
   aire tenue que acompaña al río entre pasadas.
   **Pitido al cierre** ajusta el pico de un tono agudo que empieza casi
   imperceptible y queda expuesto cuando se apagan los soplos. **Degradación
   digital** mezcla gradualmente una versión de menor resolución del fondo y
   los soplos. En 0 %, el control correspondiente desactiva el efecto. Ambos
   controles pertenecen a la mezcla de fondo y soplos.
5. En **Filtros**, cambia la saturación, el brillo y el contraste finales.
   **Ver al máximo para ajustar** los aplica de inmediato. Usa **Empieza en** y
   **Duración del fundido** para decidir cuándo empieza el desgaste y cuánto
   tarda en alcanzar esos valores. En **Textura de televisión**, el grano
   fino cambia continuamente y las bandas dan un salto con cada mosaico.
   Su intensidad va de **Grano inicial**
   a **Grano antes de la expansión**. Durante el crecimiento sigue subiendo
   hasta **Intensidad final**. Cada nivel admite de 0 a 100 %. El grano se
   apaga al comienzo del cierre. **Viñetado** oscurece los bordes
   progresivamente durante el desgaste.
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
| Duración del cierre y espera entre pasadas | `FUNCION.cierre.duracion`, `FUNCION.cierre.espera` |
| Intensidad del movimiento con la presencia | **Imagen → Paralaje** o `FUNCION.paralaje` |
| Sonido compartido durante toda la obra | `FUNCION.sonido` |
| Rampa de volumen desde el inicio hasta el cierre | `sonido.nivelInicial` |
| Intensidad del pitido y de la degradación digital | `sonido.pitido`, `sonido.degradacion` |
| Grano inicial, antes de la expansión, al final e intervalo | `textura.granoHistorico`, `textura.granoAntesExpansion`, `textura.grano`, `textura.intervalo` |
| Volumen de fondo y punto donde empieza la acumulación | `sonido.fondo`, `sonido.desde` |
| Soplos y variaciones | `sonido.volumen`, `sonido.intervalo`, `sonido.intervaloFinal`, `sonido.irregularidad`, `sonido.variacion` |
| Desgaste del paisaje | `filtros.entrada`, `filtros.fundido`, `filtros.saturacion`, `filtros.brillo`, `filtros.contraste`, `filtros.vinetado` |

Los tiempos se expresan en segundos y las posiciones en porcentajes del
encuadre. En X e Y, 50 es el centro. Subir X mueve a la derecha y subir Y hacia
abajo. `mri.entrada` se cuenta desde el inicio de su escena. La entrada de
`FUNCION.sonido` se cuenta desde el inicio de la obra completa. El primer
soplo conserva su duración de 1,85 segundos y puede entrar hasta 2,6 segundos
después del tiempo configurado. La acumulación se guía por el recorrido de la obra.

## Probar la presencia

- **Ensayar presencia** activa el control con el cursor. Entra en la imagen
  para comenzar y muévete de lado a lado. Hacia abajo
  simula que te acercas. A medida que se revela la resonancia, la cercanía
  refuerza una zona concreta y el movimiento lateral desplaza esa zona.
- **Activar cámara** pide permiso al navegador. Orienta la cámara para que
  vea al espectador de frente y con luz suficiente. Al salir del encuadre,
  el panel vuelve a **Esperando rostro** y la obra termina su pasada actual.
  Si vuelve a ver un rostro durante la espera, inicia otra pasada.
- La cámara se procesa en el navegador. No se graban imágenes ni se pide
  acceso al micrófono. El mapa y el crecimiento se desplazan juntos. La
  resonancia se mueve un poco más para dar sensación de profundidad.
  El movimiento se aquieta durante el cierre. La detección facial usa
  [Pico](https://github.com/nenadmarkus/picojs) con los [pesos del autor](https://github.com/nenadmarkus/pico/tree/7d550c78b2c31a4e1dfc5bcdfe9da013297b5cc8/rnt/cascades).

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

Los años corresponden al material histórico. Consulta cómo crear otra secuencia
por coordenadas en la [guía del material satelital](../material_timelapse/LEEME.md).
Conservar la acreditación del [material de origen](../material_timelapse/LEEME.md).
