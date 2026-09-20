# Ficha de construcción · El detector de pasos por parada (Marco 9.2 / 9.11)

**Qué es.** El eslabón 2 de la cadena del arranque, y **el frente grande**. La Pieza 9 ratificó el 19-sep que el paso por parada es ley (9.2) y **dejó su detección abierta a propósito (9.11)**. No hay una sola tabla de pasos en ninguna migración de este repo: el eslabón 2 no es conectar cables, es decidir qué cuenta como un paso y después construirlo.

**Esta ficha no decide sola.** Trae ocho preguntas con su recomendación y su costo. **Las ocho son de Asav** — cada una fija qué va a poder afirmar el sistema, y una detección mal escogida produce números correctos que mienten (Marco §D).

> **Decidido por Asav el 19-sep, sobre esta ficha.** Detección **por cruce sobre el trazado** (A-2). La hora interpolada **sí es medición**, con tres condiciones que mandan sobre el resto del documento:
>
> 1. **El paso se guarda como rango, no como instante**, y el ancho del rango es el hueco entre pings.
> 2. **La comparación contra la promesa es banda contra banda:** si el rango cabe dentro de la franja, **sostuvo**; si cae entero fuera, **se agujeró**; si se traslapa, **sin datos** — nunca un veredicto a medias.
> 3. **El hecho guarda su evidencia:** qué dos pings se usaron y qué hueco había, para poder recalcular sin perder el día.
>
> La §3 de abajo ya está reescrita con esto.

**Para cuándo.** Los dos días de prueba son del **22 al 25 de septiembre**. Si la detección se decide el lunes, se construye contra esos días; si no, los días de prueba miden movimiento y no cumplimiento.

**Proceso:** rama propia. **Migración y motor: PR, aviso con el número, y esperar.** El merge es de Asav.

---

## 1 · El hecho físico, y por qué hace difícil lo que parece fácil

Un camión pasa por una parada. El GPS no lo dice: el GPS deja puntos sueltos y de ahí hay que deducirlo.

**La cadencia manda sobre todo lo demás — y ya está medida.**

### Lo que se creía, y de dónde venía

Con la flota vieja de Umbrella, la densidad cayó de ~40 s entre pings a ~73 s el 28 de julio; a 40 km/h eso son **440 m entre punto y punto en el mejor caso y ~810 m en el peor**. Con esos números, un detector de radio —«entró a 50 m de la parada»— se salta paradas enteras y en silencio.

### Lo que miden los FTC927 de Juárez Bus

**Medido en producción el 19-sep**, sólo lectura con `jtel_readonly`, siete días, 05:00–23:00 hora de Juárez, sobre `telemetry_points`:

| Aparato | Puntos (7 d) | Mediana entre puntos | p90 | Huecos > 5 min | Metros entre puntos con el camión andando (mediana / p90) |
|---|---|---|---|---|---|
| TK-FTC927-003 | 1 067 | **6 s** | 54 s | 35 | **61 m** / 112 m |
| TK-FTC927-005 | 290 | **4 s** | 11 s | 6 | **32 m** / 106 m |
| TK-FTC927-008 | 179 huecos | **5 s** | 2 591 s | 24 | **15 m** / 102 m |
| TK-FTC927-004 | 60 | 56 s | 484 s | 9 | — |
| TK-FTC927-001 | 13 | 75 s | 681 s | 3 | — (mudo desde el 14-sep; es el del reclamo) |

**El aparato propio es entre siete y veintisiete veces más fino que Umbrella:** 15–61 m entre puntos con el camión andando, contra 440–810 m. **El argumento con el que se descartó el radio no aplica a este hardware, y conviene decirlo en voz alta en vez de dejar la conclusión en pie por inercia.**

### Por qué el cruce sigue siendo el correcto, por otra razón

Lo que no cambió son **los huecos**: 35 huecos de más de cinco minutos en un solo aparato en una semana. La cadencia fina es el comportamiento del aparato **mientras se mueve y tiene red**; cuando se cae la red o el camión se detiene, el hueco es de minutos u horas (máximos medidos de 35 776 s y 269 880 s).

Un detector de radio **falla justo en el hueco**, y el hueco es donde está la parada — porque la parada es donde el camión se detiene. El cruce sobre el trazado **no se salta ninguna parada** aunque el hueco se trague el tramo completo: el cruce ocurre entre los dos puntos que encierran el hueco, y lo único que se ensancha es el rango de la hora. Que es exactamente lo que la decisión de Asav manda guardar.

### Lo que esta medición destapó, y no estaba en la pregunta

**Hoy no hay volumen porque los camiones no ruedan.** De los 7 aparatos, sólo el 003 dio señal en las últimas horas; 006 y 007 están en bodega (3 y 1 punto en siete días) y el 001 está mudo desde el 14-sep. En movimiento real: **134 puntos al día el 003, 38 el 005, 17 el 008**. Todo `juarez-bus` produjo **1 693 puntos en siete días**.

Con los 8 rodando de verdad —pongamos 10 horas de movimiento al día a un punto cada 5 s— eso sería del orden de **7 000 puntos por unidad por día, ~57 000 al día para la flota, ~1.7 millones al mes**. Hoy la tabla entera lleva 4.47 millones de filas y 1 621 MB, acumulados desde Umbrella. **El arranque multiplica el ritmo de escritura por dos órdenes de magnitud**, y eso toca de lleno dos cosas que ya están anotadas: la lentitud de Servicios especiales y «cuántos GPS aguanta el sistema». No es de esta ficha, pero sale de su medición y no se puede dejar sin decir.

### La pregunta de la cadencia, al revés de como se planteó

El pendiente del plan —«la cadencia de reporte por tipo de servicio»— nació suponiendo que habría que **subirla** para el transporte público. Medido, **ya está por encima de lo que el detector necesita**: 4–6 s contra los 15–20 s que se pensaban pedir. La pregunta real pasa a ser la contraria — **si 4–6 s es más de lo que hace falta, y qué cuesta en SIM y en base** —, y se contesta con el consumo real de los 8 rodando, no antes.

**Lo que este repo no puede contestar:** si el intervalo es configurable desde el aparato. El FTC927 habla protocolo `teltonika` contra Traccar en el puerto 5027 (`docs/Ficha-Compas.md`, `docs/Procedimiento-Traccar-Servidor.md`), y **no hay en este código ningún camino para cambiarle parámetros**: la configuración de un Teltonika se hace del lado del aparato —cable con el configurador, o FOTA WEB—, que es territorio del proveedor. Eso se confirma con Teltonika México, no con una consulta.

## 2 · Las ocho decisiones

### A · ¿Qué cuenta como un paso?

1. **Radio alrededor de la parada** — «hubo un punto a menos de N metros». Simple, y se salta paradas cuando el muestreo es grueso.
2. **Cruce sobre el trazado** — la unidad se proyecta sobre el trazado (la geometría punto-a-segmento que ya existe y que ya usa el pegado de paradas); la parada tiene su propia abscisa sobre ese mismo trazado; hay paso cuando la proyección **cruza** esa abscisa entre dos puntos consecutivos. No se salta ninguna parada mientras la unidad vaya en ruta, porque el cruce ocurre aunque no haya un punto cerca.
3. **Detención cerca de la parada** — hubo paso si el camión se detuvo ahí. Es lo que de verdad le importa al pasajero y es el más frágil: un semáforo a 30 m de la parada es una detención, y un camión que no abre puertas porque va lleno **sí pasó**.

- **✓ DECIDIDO (Asav, 19-sep): (2), el cruce.** Es coherente con todo lo que ya se construyó —la llegada se calcula proyectando sobre el trazado, no sobre las paradas, y así está escrito en `circuit_stops`— y es el único que no se salta una parada cuando el hueco se traga el tramo.
- *Lo que (2) cuesta:* la **hora** del paso cae entre dos pings. Ver la decisión C, también decidida.

### B · ¿Y si la unidad se sale del corredor?

Ya hay ley para eso: fuera del corredor **no se publica** (`corridor_tolerance_meters`, 150 m por defecto). Un camión desviado no está pasando por sus paradas.

- *Recomendación:* no se generan pasos con la unidad fuera del corredor, y el tramo queda **declarado como hueco**, no como cumplimiento ni como falta. Un hueco dicho es un dato; un cero callado es una mentira.

### C · La hora interpolada, ¿es medición o es invento?

Ésta es la pregunta del Marco, no de ingeniería. Si el cruce ocurre entre un ping de las 7:04:10 y otro de las 7:04:50, el paso «fue» a las 7:04:31 por regla de tres.

**✓ DECIDIDO (Asav, 19-sep): es medición, y se guarda como RANGO.** No se guarda un instante con una incertidumbre al lado: **el paso *es* el rango**, y su ancho es el hueco entre los dos pings que lo encierran. Un paso entre las 7:04:10 y las 7:04:50 es «entre 7:04:10 y 7:04:50», no «7:04:31».

La consecuencia es la regla de comparación, y es la parte que evita el veredicto a medias:

| Lo medido contra la franja | Lo que se dice |
|---|---|
| El rango **cabe dentro** de lo prometido | **sostuvo** |
| El rango **cae entero fuera** | **se agujeró** |
| El rango **se traslapa** con la orilla | **sin datos** |

«Sin datos» no es un empate ni un «casi»: es la respuesta honesta cuando el instrumento no alcanza a distinguir. Con 4–6 s entre pings —lo medido— el rango es angosto y casi siempre cae de un lado; con un hueco de cinco minutos, el rango es ancho y **el sistema dice que no sabe**, que es justo lo que tiene que decir.

Y el hecho **guarda su evidencia**: los dos pings y el hueco. Sin eso, mejorar el detector obligaría a tirar los días ya medidos.

### D · ¿Contra qué franja se juzga?

Contra la **franja vigente en el instante del paso** (eslabón 1), no contra la vigente hoy y no contra el promedio del día (9.1c).

- *Recomendación:* sin franja vigente, el paso **se registra igual y queda sin juzgar**. Medir no depende de prometer; juzgar sí.

### E · ¿Qué es una vuelta?

La desviación de frecuencia se mide entre pasos consecutivos por la misma parada. Para eso hay que saber cuándo empieza y acaba una corrida.

- *Recomendación:* **no inventar la vuelta en esta etapa.** Se registran pasos sueltos, y el intervalo se calcula entre pasos consecutivos por la misma parada y el mismo sentido. La vuelta como sujeto propio llega con la terminal del carrier (eslabón 4), que es donde se va a ver.

### F · ¿Qué versión de la parada queda ligada al paso?

Las paradas se mueven (`circuit_stop_versions`). Un paso de hace un mes es un paso por **la parada que estaba entonces**.

- *Recomendación:* el paso guarda `stop_version_id`, no sólo `stop_id`. Es la misma lección de «congelar las unidades posibles con el hecho», que ya es pendiente con nombre por no haberla aplicado a tiempo.

### G · ¿En vivo o por lote?

- *Recomendación:* **por lote**, sobre `telemetry_points`, corriendo detrás del recolector. En vivo obliga a acertar a la primera y no deja recalcular cuando la detección mejore. Por lote se puede volver a correr sobre los mismos días —que es justo lo que van a necesitar los días de prueba.
- *Lo que el lote cuesta:* la terminal no dice «ahora». El bloque «Ahora» de 9.2b puede salir de la posición viva, que ya existe, sin esperar al detector.

### H · ¿Re-detectar reemplaza o apila?

Si el detector mejora y se vuelve a correr sobre el 23 de septiembre, ¿qué pasa con lo que dijo la primera vez?

- *Recomendación:* **apilar, no pisar** — el principio recurrente de la casa. Y conectarlo con la idea sin decidir del re-sellado que ya está anotada: si esto se decide aquí a la ligera, se decide de hecho para el árbitro del 9.12.

## 3 · La forma, con las decisiones de Asav dentro

```
circuit_stop_passes
  id
  circuit_id
  stop_id
  stop_version_id      -- la parada como estaba (decisión F)
  unit_id
  sentido              sentido_circuito NOT NULL

  -- EL PASO ES UN RANGO (decisión C). No hay `passed_at`: el instante no
  -- existe, y darle una columna propia invita a leerlo como si existiera.
  paso_desde           TIMESTAMPTZ NOT NULL   -- el ping de antes del cruce
  paso_hasta           TIMESTAMPTZ NOT NULL   -- el ping de después
  CHECK (paso_hasta >= paso_desde)

  -- LA EVIDENCIA, no el resumen: con esto se recalcula sin perder el día.
  ping_previo_id       UUID NOT NULL → telemetry_points(id)
  ping_siguiente_id    UUID NOT NULL → telemetry_points(id)
  hueco_segundos       INTEGER NOT NULL       -- el ancho, ya calculado

  detector_version     TEXT NOT NULL          -- para apilar (decisión H)
  detected_at          TIMESTAMPTZ NOT NULL
```

**El ancho se guarda calculado además de derivable.** `paso_hasta - paso_desde` lo da, y tenerlo como columna es lo que permite filtrar «enséñame sólo los pasos con hueco menor a un minuto» sin pelearse con el plan de la consulta — que en esta casa ya costó caro una vez.

Lo que **no** lleva: veredicto. En esta etapa nada se sella (9.3). La comparación banda contra banda se calcula al leer, contra la franja vigente en `paso_desde`.

**Y un tipo que Postgres ya trae:** `tstzrange` haría el rango nativo, con operadores de contención y traslape (`@>`, `&&`) que son literalmente las tres filas de la tabla de la decisión C. Vale la pena evaluarlo contra las dos columnas sueltas al construir; lo que no cambia es que el paso es un rango.

## 4 · Lo que esta ficha NO construye

- **El árbitro del circuito** (9.12): sólo tras semanas de medición con servicio real.
- **El ausentismo** (9.5): necesita la asignación del chofer, y jamás se infiere del GPS.
- **La terminal** donde esto se ve (eslabón 4).
- **La atribución a un chofer**: los pasos son de la unidad. Ligarlos a una persona espera los beacons (eslabón 7), y el beacon es evidencia declarada, no prueba.

## 5 · Lo que falta medir

1. ~~La cadencia real de los FTC927.~~ **Medida el 19-sep** — está en la §1.
2. **La distancia entre paradas de Oasis–Centro**, en cuanto estén capturadas. Con la cadencia al lado dice, con números, cuánto va a medir el rango típico de un paso: a 61 m entre puntos y paradas cada 300–500 m, el rango de casi todos los pasos va a ser de segundos, no de minutos.
3. **El consumo real de SIM de los 8 rodando**, para contestar la pregunta invertida de la cadencia. Se mide con el servicio andando, no antes.
