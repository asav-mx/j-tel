# Ficha — El sensor de cadencia, y lo que enseñó al encenderlo

**Fecha de medición: 11 de agosto de 2026** · **Alcance:** solo lectura, con
`jtel_readonly` —comprobado ese día: **42 tablas, 42 legibles, cero
escribibles**—. **No se selló nada, no se re-verificó nada, ningún hecho cambió
de versión.** Todos los conteos excluyen `is_demo` por los dos lados: solo Tecma.

**Marcas:** 🟢 verificado · 🔵 reportado por otro documento · 🟡 inferencia.

**Qué es:** la primera pieza del frente de los sensores (§«Los sensores: ver el
instrumento, no solo el veredicto»), **partida a propósito**. El tablero de
J-Staff no está aquí: espera al rediseño de pantallas y a D7. Lo que está aquí
es la **medición**, que es lo único que la precondición de C19 necesita de
verdad.

---

## 1. Por qué se partió el frente, y qué NO cubre esta mitad

La precondición dice: **los sensores antes de tocar C19.** Su razón está escrita
— si la cobertura mejora y no hay sensores, no se puede saber si fue el arreglo
o el proveedor moviendo la densidad otra vez.

**Eso lo da la serie medida, no el tablero.** Un tablero no aporta atribución;
aporta **aviso temprano**, que es el otro propósito del frente —«nadie se
enteró» durante once días—. Sólo el primero bloquea C19.

Y construir el tablero hoy sería piel dos veces: 🔵 J-Staff son **nueve rutas y
cero fichas de diseño**, hay un rediseño en curso, y **D7 bloquea pantallas**.
Es la misma razón por la que la etiqueta de C20 quedó en espera.

> ⚠ **Lo que esta mitad NO hace, dicho para que nadie lo suponga: no avisa.**
> Detectar y avisar son dos cosas (regla 16). Mientras el tablero no exista, la
> vigilancia es humana: **cada PR que toque la cobertura corre esto al abrir y
> al cerrar**, y las dos corridas se guardan. Ése es el costo aceptado al
> partir el frente, y se aceptó por escrito.

**Dónde vive:** `packages/db/src/medir-cadencia.ts` ·
`pnpm --filter @jtel/db medir-cadencia [desde] [hasta]`.

---

## 2. El eje, que es parte del resultado

El guion imprime tres cifras y **sólo una responde «¿cambió el aparato?»**:

| Cifra | Qué es | Por qué no basta / por qué sí |
|---|---|---|
| `puntos` | El total del día | Es la que cita §5.1 del PLAN, y por eso se imprime: para poder empalmar. **Se mueve con cuántos servicios hubo**, así que no acusa al aparato |
| `pts/apar` | El total entre los aparatos vistos | Quita el tamaño de la flota. **No quita cuántas horas corrió cada uno** |
| **`hueco`** | **Mediana de segundos entre dos puntos consecutivos del mismo aparato en el mismo viaje** | **Ésta es la que hay que mirar.** No depende de cuántos servicios hubo, ni de cuántos aparatos, ni de cuánto corrió cada uno |

Se imprimen las tres a propósito: una cifra «buena» sin las que la componen es
el caso 6 de §D del Marco —quien lee no puede reconstruir el número—.

**El p90 va al lado de la mediana** porque juntos distinguen dos cosas que la
mediana sola no: **bajar el ritmo** (suben las dos) de **volverse irregular**
(sube el p90 y la mediana no).

### La medida que se probó y se descartó — y el descarte vale más que la cifra

La primera versión medía **puntos por hora de ventana**. Se ve razonable y está
confundida: 🟢 **la ventana de evidencia es derivada (C5), así que se mueve
sola.** El Campus del 10 de agosto lo destapó — puntos normales (121 559),
puntos por aparato normales (2 251) y la «cadencia» **34 % abajo**. No había
mandado menos nadie: **se había alargado el denominador.**

> **Una medida cuyo denominador es otra pieza en movimiento no mide el aparato:
> mide la resta de las dos.** El hueco entre puntos no tiene denominador que se
> mueva.

Se registra porque el número confundido **ya estaba impreso y se veía bien**.
Lo atrapó mirar la salida contra lo que las otras columnas decían, no una
prueba — que es la regla de §D del Marco aplicada a un instrumento en vez de a
una pantalla.

---

## 3. Lo medido — C19 sale más nítida de lo que estaba

🟢 **Planta 47, mediana del hueco, por día de servicio:**

| Periodo | Días | Hueco (mediana) | p90 |
|---|---|---|---|
| 9 → 28 de julio | **13 días de servicio** | **60.0 s, exacto, todos** | **120.0 s** |
| 30 de julio → 11 de agosto | 9 días de servicio | **37–42 s** | **60.0 s** |

🟢 **El Campus, en el mismo periodo: 36–45 s de mediana y p90 60.0 s, de punta a
punta.** Plano, como decía la ficha — y **ya estaba donde Planta 47 llegó
después**.

> 🟢 **Y esto afina C19 en vez de repetirla: no es «~1.5× más puntos».** Planta
> 47 venía emitiendo **un punto por minuto exacto** —mediana 60.0 s, y un p90 de
> 120 s que dice que uno de cada diez se perdía— y pasó a **un punto cada ~40
> segundos**, con el p90 cayendo a 60. **Convergió a la cadencia que el Campus
> ya tenía.**
>
> 🟡 **Eso refuerza «fue del proveedor o de los dispositivos» y acota la
> forma:** un 60.0 exacto sostenido trece días y un salto a otro valor estable
> tienen forma de **valor configurado**, no de deriva. Lo que costaría pasarlo a
> 🟢 no está de nuestro lado: es el proveedor diciendo qué cambió el 29 de julio.

### Dos días que no caben en el rango de §5.1, y son la mejor defensa del eje

§5.1 dice **«61–68 k del 9 al 24 de julio»** para Planta 47. 🟢 **Dos de esos
doce días de servicio caen fuera, y no son duplicados** (no aparecen en la tabla
de §4):

| Día | Puntos | Aparatos | pts/apar | **Hueco** |
|---|---|---|---|---|
| 9 jul | **99 318** | 52 | 1 910 | **60.0 s** |
| 20 jul | **40 440** | 53 | 763 | **60.0 s** |
| *(los otros diez)* | 60–68 k | 51–53 | 1 140–1 303 | **60.0 s** |

> 🟢 **El total se movió 2.5× entre esos dos días y la cadencia fue idéntica en
> los doce: 60.0 s.** Lo que cambió no fue cuánto mandaba el aparato sino
> **cuánto de la ventana alcanzó a cubrir**. Es exactamente el argumento del
> eje, medido: **un rango construido sobre `puntos` no acota el muestreo**, y
> quien lea «61–68 k» como «así emitía el aparato» está leyendo una afirmación
> que el dato no sostiene.

No es un error de §5.1 —la cifra que cita es correcta y su fila dice de dónde
sale—: es que **esa cifra no era la que respondía la pregunta**, y hasta hoy no
había otra.

### C15, descartada como sospechosa

El handoff pedía descartarla primero si algo salía distinto al corte del 6 de
agosto. 🟢 **Queda descartada, y por construcción:** C15 cambió **cómo se agrupa**
la evidencia (`imei` → `unitId ?? imei`), y todo lo de arriba **cuenta filas y
compara marcas de tiempo** — ninguna de las dos cosas pasa por esa agrupación.
Las diferencias con §5.1 quedan explicadas por los duplicados (§4) y por el eje
(justo arriba).

---

## 4. Lo que el sensor destapó al encenderlo — puntos de evidencia repetidos

El hueco salió **0.0 s** en tres días. Una mediana de cero significa que más de
la mitad de los pares consecutivos comparten instante. Se midió:

🟢 **195 028 filas sobrantes de 5 013 844 (3.89 %)** entre el 1 de julio y el 11
de agosto, concentradas en cinco días:

| Contrato | Día | Puntos | Sobrantes | % | Máx. repeticiones |
|---|---|---|---|---|---|
| Campus | 7 jul | 14 508 | 7 254 | **50.0 %** | x2 |
| Campus | 8 jul | 14 820 | 7 410 | **50.0 %** | x2 |
| Campus | 17 jul | 126 380 | 3 121 | 2.5 % | x2 |
| Planta 47 | **27 jul** | 92 199 | 49 815 | **54.0 %** | **x4** |
| Planta 47 | **29 jul** | 237 114 | 127 428 | **53.7 %** | **x3** |

🟢 **Son copia exacta, no dos observaciones:** de **126 722 grupos** repetidos
(viaje + imei + instante), **126 722 tienen el mismo lugar y la misma unidad**.
Cero con lugar distinto. Cero con unidad distinta.

🟢 **Y la fuente está limpia:** `telemetry_points` —la memoria de la que se
copia— tiene índice único `(imei, recorded_at)`, con el comentario «Deduplica:
un mismo equipo no puede tener dos puntos en el mismo instante», y **cero
repetidos en la ventana**. 🟢 **`evidence_points` no tiene ese índice** — sólo
`(trip_id, recorded_at)`, y no es único.

> **La defensa está escrita en la tabla de la que se copia y no en la que el
> árbitro lee.** El camino de la aplicación limpia antes de copiar
> (`verification.ts:897`), pero **ese borrado es condicional** (`!reuseEvidence`)
> y el `insert` no tiene `onConflict`. Es la forma de C13 otra vez: la puerta
> buena cerrada, y el hueco donde nadie miró.

### Qué le hace esto a C19, con precisión

🟢 **El cambio sostenido NO son duplicados.** Del 30 de julio al 11 de agosto
hay **cero sobrantes**, y ahí es donde vive el hueco de 37–42 s. **C19 se
sostiene.**

🟢 **Pero el 29 de julio —el día en que C19 está anclada— es 53.7 % duplicado.**
Sus 237 114 puntos no son 237 114 observaciones distintas. Las cinco cifras de
§5.1 (93 · 97 · 99 · 108 · 110 k) corresponden al **30 de julio → 5 de agosto**,
así que **los valores ya excluían el 29**; lo que incluía ese día era el rótulo
del rango. El eje otra vez.

🟢 **Y el 27 y 28 de julio son exactamente los dos días de C3** —los 28
pendientes por cobertura—, que resultan ser también los de más evidencia
duplicada y los del hueco más raro.

🟡 **Si esto movió algún veredicto, no se sabe, y el costo de saberlo no es
bajo:** exige correr el motor con y sin deduplicar, que es **simulación** y vive
en D4 / Tramo 6, no aquí. Lo que hace que la pregunta valga: `routeMatchPct` va
**ponderada por TF-IDF** (C17), y una ponderación sobre un conjunto con 54 % de
repeticiones exactas no es obviamente invariante.

### Contra las 21 causas de §5.1: no es ninguna

Se comprobó antes de llamarlo hallazgo, que es la regla que costó el episodio de
T4. **No aparece en §5.1, ni en el reporte de los 71, ni en las fichas.** Las
vecinas son **C3** (el archivador y sus reintentos) y **C17** (la ponderación),
y no es ninguna de las dos. **Se propone como C22 — decisión de Asav**, que es
quien decide si entra a la ficha y con qué prioridad.

---

## 5. Sobre la serie y su permanencia

🟢 **Hoy la serie se reconstruye entera sin haber guardado nada**, porque no hay
purga por antigüedad de `evidence_points`.

⚠ **Pero no es permanente, y conviene decirlo antes de apoyarse en ello:** los
puntos de un viaje **sí se borran al re-verificarlo** sin `keepEvidence`
(`verification.ts:897`), y se vuelven a copiar de la memoria. Una tanda de
re-verificación puede reescribir el pasado de esta serie. **Ése es el argumento
de fondo para que la Pieza 2 del frente —que el hecho sellado cargue su propia
densidad— exista**, y es Tramo 4.

---

## 6. Lo que esta ficha NO hizo

- **No selló ni re-verificó nada.** Ningún hecho cambió de versión.
- **No tocó producción.** Solo lectura, verificada antes de medir.
- **No propone el arreglo de C19**, ni valores de umbral, ni qué hacer con los
  195 028 sobrantes. Eso es decisión de Asav con esto enfrente.
- **No mide si los duplicados movieron un veredicto.** Requiere simulación.
