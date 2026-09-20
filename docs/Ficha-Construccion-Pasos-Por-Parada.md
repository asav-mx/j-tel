# Ficha de construcción · El detector de pasos por parada (Marco 9.2 / 9.11)

**Qué es.** El eslabón 2 de la cadena del arranque, y **el frente grande**. La Pieza 9 ratificó el 19-sep que el paso por parada es ley (9.2) y **dejó su detección abierta a propósito (9.11)**. No hay una sola tabla de pasos en ninguna migración de este repo: el eslabón 2 no es conectar cables, es decidir qué cuenta como un paso y después construirlo.

**Esta ficha no decide sola.** Trae ocho preguntas con su recomendación y su costo. **Las ocho son de Asav** — cada una fija qué va a poder afirmar el sistema, y una detección mal escogida produce números correctos que mienten (Marco §D).

**Para cuándo.** Los dos días de prueba son del **22 al 25 de septiembre**. Si la detección se decide el lunes, se construye contra esos días; si no, los días de prueba miden movimiento y no cumplimiento.

**Proceso:** rama propia. **Migración y motor: PR, aviso con el número, y esperar.** El merge es de Asav.

---

## 1 · El hecho físico, y por qué hace difícil lo que parece fácil

Un camión pasa por una parada. El GPS no lo dice: el GPS deja puntos sueltos y de ahí hay que deducirlo.

**La cadencia manda sobre todo lo demás.** Medido en este repo con la flota vieja: la densidad cayó de ~40 s entre pings a ~73 s el 28 de julio. A 40 km/h, eso son **440 m entre punto y punto en el mejor caso y ~810 m en el peor**. Una parada urbana está a 300–500 m de la siguiente.

La consecuencia es la que decide la decisión A: **un detector de radio —«entró a 50 m de la parada»— se salta paradas enteras** a esa cadencia, y las salta en silencio. No produce un error: produce un cero.

**La cadencia real de los FTC927 no está medida.** Es un pendiente con nombre del plan vigente («la cadencia de reporte por tipo de servicio»), y **medirla es el primer paso de este frente**, antes de escribir el detector. Se mide sobre `telemetry_points` de los 4 aparatos instalados.

## 2 · Las ocho decisiones

### A · ¿Qué cuenta como un paso?

1. **Radio alrededor de la parada** — «hubo un punto a menos de N metros». Simple, y se salta paradas cuando el muestreo es grueso.
2. **Cruce sobre el trazado** — la unidad se proyecta sobre el trazado (la geometría punto-a-segmento que ya existe y que ya usa el pegado de paradas); la parada tiene su propia abscisa sobre ese mismo trazado; hay paso cuando la proyección **cruza** esa abscisa entre dos puntos consecutivos. No se salta ninguna parada mientras la unidad vaya en ruta, porque el cruce ocurre aunque no haya un punto cerca.
3. **Detención cerca de la parada** — hubo paso si el camión se detuvo ahí. Es lo que de verdad le importa al pasajero y es el más frágil: un semáforo a 30 m de la parada es una detención, y un camión que no abre puertas porque va lleno **sí pasó**.

- *Recomendación:* **(2), el cruce.** Es coherente con todo lo que ya se construyó —la llegada se calcula proyectando sobre el trazado, no sobre las paradas, y así está escrito en `circuit_stops`— y es el único que sobrevive a 800 m entre pings.
- *Lo que (2) cuesta:* la **hora** del paso cae entre dos pings y hay que interpolarla. Ver la decisión C.

### B · ¿Y si la unidad se sale del corredor?

Ya hay ley para eso: fuera del corredor **no se publica** (`corridor_tolerance_meters`, 150 m por defecto). Un camión desviado no está pasando por sus paradas.

- *Recomendación:* no se generan pasos con la unidad fuera del corredor, y el tramo queda **declarado como hueco**, no como cumplimiento ni como falta. Un hueco dicho es un dato; un cero callado es una mentira.

### C · La hora interpolada, ¿es medición o es invento?

Ésta es la pregunta del Marco, no de ingeniería. Si el cruce ocurre entre un ping de las 7:04:10 y otro de las 7:04:50, el paso «fue» a las 7:04:31 por regla de tres.

- *Recomendación:* se guarda la hora interpolada **y se guarda al lado la incertidumbre** —los segundos entre los dos pings que la encierran—, y la pantalla nunca enseña un minuto exacto cuando la incertidumbre lo desmiente. Con 40 s entre pings, «7:04» es honesto; con 800 m entre pings, «pasó entre 7:04 y 7:06» es lo único honesto.
- *La alternativa dura:* no interpolar, y guardar sólo el intervalo. Más honesto y más incómodo de dibujar.

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

## 3 · La forma que saldría de las recomendaciones

```
circuit_stop_passes
  id
  circuit_id
  stop_id
  stop_version_id      -- la parada como estaba (decisión F)
  unit_id
  sentido              sentido_circuito NOT NULL
  passed_at            TIMESTAMPTZ NOT NULL   -- interpolada (decisión C)
  uncertainty_seconds  INTEGER NOT NULL       -- los segundos que la encierran
  prev_point_id / next_point_id               -- la evidencia, no el resumen
  detector_version     TEXT NOT NULL          -- para apilar (decisión H)
  detected_at          TIMESTAMPTZ NOT NULL
```

Lo que **no** lleva: veredicto. En esta etapa nada se sella (9.3).

## 4 · Lo que esta ficha NO construye

- **El árbitro del circuito** (9.12): sólo tras semanas de medición con servicio real.
- **El ausentismo** (9.5): necesita la asignación del chofer, y jamás se infiere del GPS.
- **La terminal** donde esto se ve (eslabón 4).
- **La atribución a un chofer**: los pasos son de la unidad. Ligarlos a una persona espera los beacons (eslabón 7), y el beacon es evidencia declarada, no prueba.

## 5 · Lo primero que hay que medir, antes de escribir una línea

1. **La cadencia real de los FTC927** sobre `telemetry_points`: mediana y p90 de segundos entre puntos, por aparato, en horario de servicio. Decide si (1) el radio era siquiera viable y qué incertidumbre va a cargar cada paso.
2. **La distancia entre paradas** de Oasis–Centro, en cuanto estén capturadas. Con la cadencia al lado, dice cuántas paradas se saltaría cada método — con números, no con opinión.
