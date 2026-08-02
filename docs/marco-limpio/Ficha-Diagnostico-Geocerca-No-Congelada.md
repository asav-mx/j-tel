# Ficha de Diagnóstico — El árbitro juzga contra configuración viva, y el hecho guarda otra cosa

**Gobierna:** el `Marco-Limpio-J-Telemetry-MAESTRO.md` y la compuerta de salida de Ola 2 del `PLAN-v1.md`.
**Estado:** hallazgo verificado contra el código y contra las llegadas ya selladas.
**Reemplaza** a la primera versión de esta ficha, titulada *"Veintiuna rutas esperan llegada en una geocerca llamada VOID"*, **que estaba mal fundada** — ver §1.

---

## 1. Retracción: qué decía esta ficha, y por qué estaba mal

La versión anterior afirmaba:

> Veintiuna rutas esperan la llegada en una geocerca llamada `VOID`, a ocho kilómetros del destino real. Sobre ellas el árbitro sella 8.6% de cumplidos contra 51.4% de sus rutas hermanas. **333 servicios no cumplidos sobre una premisa falsa.**

**Es falso.** El árbitro nunca juzgó contra VOID.

Lo que se midió bien: 357 hechos sellados tienen `expected_geofence_id` apuntando a una geocerca llamada `VOID`, de rol `otro`. Lo que se dio por hecho sin comprobarlo: que ese campo describía la geocerca que el motor aplicó.

No la describe. `verification.ts` juzga contra `profile.geofence` —la geocerca **viva** del perfil de servicio— y por separado copia `occurrence.expectedGeofenceId` dentro del hecho. Cuando las dos difieren, el hecho guarda una etiqueta que no se usó.

**La prueba que lo tumba:** de los 24 `cumplido` etiquetados VOID, se tomó el punto de evidencia más cercano en tiempo a `observed_arrival_at` y se probó contra cada polígono por separado.

| Dónde cayó la llegada | Hechos |
|---|---|
| Dentro de `VOID` | **0** |
| Dentro de `Tecma Planta 47` | **18** |
| En ninguna de las dos (efecto de borde) | 6 |

Y las fechas lo confirman: los 357 se sellaron entre el **2026-07-20 y el 2026-08-01**, todos posteriores al **2026-07-15 06:00**, que es cuando el generador diario empezó a escribir `Tecma Planta 47` — o sea, cuando el perfil ya estaba corregido.

**Entonces el "333 servicios acusados sobre una premisa falsa" no existió.** Los 333 se juzgaron contra el destino correcto. Lo que estaba mal era mi lectura de un campo.

Se deja escrito y no se borra, por lo mismo que la vez anterior: **el registro de un error de razonamiento vale más que su borrado**, y este se cometió justo después de escribir en el skill que hay que probar el instrumento contra hechos ya sellados. Se probó el instrumento geométrico y no se probó la interpretación del campo.

---

## 2. Lo que sí queda en pie, y es de otra clase

> **El árbitro juzga contra configuración viva y mutable.** La geocerca que aplica es la que el perfil tiene **hoy**, no la que regía cuando el servicio ocurrió. Y el campo que sí está congelado dentro del hecho —`expected_geofence_id`— no es el que se usó.

Las dos mitades de la ley del hecho congelado están cruzadas: **lo que se congela no se usa, y lo que se usa no se congela.**

### Por qué importa

- **Una edición de configuración cambia juicios pasados.** Si mañana alguien corrige la geocerca de un perfil, cualquier re-verificación de un servicio de hace tres semanas se hará contra el polígono nuevo. El resultado cambia sin que nada registre que la regla cambió. Es exactamente lo que la ficha del expediente ya decidió para el radio: *el que estaba vigente cuando se selló, no el de hoy.*
- **`contract_policy_snapshot` sí se congela.** Umbrales, tolerancias y rigor viajan dentro del hecho, precisamente para que el auditado pueda reconstruir con qué regla se le juzgó. **La geocerca no.** Es el mismo argumento y le falta la misma pieza — y la geocerca es la frontera de la evidencia (Ley 4), no un parámetro menor.
- **El campo que existe engaña.** `expected_geofence_id` tiene nombre de garantía y no la da. Ya hizo su primera víctima: esta ficha.

### El caso concreto que lo destapó

| | |
|---|---|
| Ocurrencias con `expected_geofence_id` ≠ geocerca del perfil | **546** |
| De ellas, ya selladas | 357 |
| Futuras, sin sellar | 189 (2026-08-03 → 2026-08-13) |
| Perfiles afectados | 21 |
| Creadas | todas en un solo lote, 2026-07-14 entre 04:43 y 04:48 |

El generador diario **copia bien**: lee `profile.geofenceId` al generar. Las 546 salieron de una carga única del 2026-07-14, minutos después de crear los 21 perfiles; el perfil se corrigió a `Tecma Planta 47` antes del 07-15 y las ocurrencias ya generadas se quedaron con la etiqueta vieja.

**Ninguna de las 189 futuras va a juzgarse mal**, porque el motor no lee ese campo. Van a juzgarse contra `Tecma Planta 47`, que es lo correcto. Lo que hay que arreglar no es el resultado: es que el dato guardado diga la verdad.

---

## 3. Lo que NO explica este hallazgo

Sigue abierto por qué los perfiles de `Tecma Planta 47` sellan **24 cumplidos de 357 (6.7%)** contra los de `Campus`, **255 de 462 (55.2%)**.

No es la geocerca. Lo medido es que son **dos contratos distintos con políticas distintas**:

| | Campus (27 perfiles) | Tecma Planta 47 (21 perfiles) |
|---|---|---|
| Umbral de ruta | 60 | 60 |
| **Umbral de corredor** | **50** | **60** |
| **Ancho del corredor** | **150 m** | **120 m** |
| Rigor declarado | `kml_full` | `destino_only` |
| Tolerancia | 5 min | 5 min |

El contrato de Planta 47 es más estricto en el corredor y más angosto. **Eso es una diferencia medida, no una causa establecida** — no se aisló, y este documento ya cometió una vez el error de nombrar causa sin aislarla. Queda como la siguiente pregunta a investigar, no como conclusión.

---

## 4. Nada que corregir al vuelo

- **No se toca ningún hecho sellado.** Los 357 se juzgaron contra el destino correcto; no hay nada que re-verificar.
- **No se mueve ninguna geocerca.** VOID no se usó para juzgar.
- Lo único a decidir es de qué clase es el arreglo: si `expected_geofence_id` debe corregirse en las 189 futuras (dato guardado que hoy miente), y sobre todo si el hecho debe **congelar el polígono** como congela la política.

---

## 5. Lo que abre

**¿Debe la geocerca viajar congelada dentro del hecho, igual que `contract_policy_snapshot`?**

Es la pregunta grande y es de motor. Un hecho sellado tiene que poder reconstruirse solo: hoy no puede, porque su frontera de evidencia vive en una fila editable que nadie versiona.

**¿Debe existir el campo `expected_geofence_id` si nadie lo lee?** Un campo con nombre de garantía que no la da es peor que su ausencia — es la forma más barata de que alguien concluya lo que yo concluí. La regla del skill aplica igual a los datos que a las pantallas: **cuando se puede no guardar un dato que miente, no se guarda.**

**¿Cómo se sabe que un campo dejó de usarse?** El comentario de `bulkSetGeofenceForPlant` dice, correctamente, que *"el motor lee la geocerca viva del perfil al verificar"*. Esa línea es la única señal en todo el repo de que `expected_geofence_id` quedó huérfano, y está en un método que no lo menciona.
