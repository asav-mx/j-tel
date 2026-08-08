# Ficha — Pendiente por evidencia

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Continúa** la `Ficha-Pendiente-Por-Evidencia` anterior (PR #104), que definió el estado y su lógica. Esta define **la pantalla con la piel nueva**.

**Reviste:** `cliente/planta/[plantId]/pendiente-por-evidencia` · `cliente/campus/[groupId]/pendiente-por-evidencia`.

> **Por qué esta línea existe:** sin ella, contar cuántas pantallas tienen
> diseño obliga a leer las trece fichas y a interpretar. Con ella el conteo se
> rehace solo. La ruta va **en el encabezado y con acentos graves**, para que
> un `grep` la encuentre. Ver `PLAN.md` §8.

---

## 1. La pantalla más delicada del producto

Es donde el sistema **admite que no sabe**. Todo lo demás afirma; esta declara un límite.

Y tiene que lograr algo difícil: **que el ámbar no se lea como "casi rojo"**. Un pendiente no es un incumplimiento en trámite — es la constancia de que el instrumento no alcanzó a ver.

---

## 2. La declaración de límite va primero

Antes de cualquier dato, en una caja con borde ámbar bajo el encabezado:

> **El sistema no vio lo suficiente para juzgar estos servicios.**
> No cuentan como incumplimiento **ni como cumplido**. La evidencia no alcanzó el mínimo que el contrato pide para emitir un resultado, y forzar un veredicto sobre datos incompletos sería inventarlo.

**Sin esa frase arriba, un gerente lee "pendiente" como "falla" y le reclama al carrier algo que no pasó.** Es la lectura equivocada más probable, y por eso se contesta antes de que ocurra.

**Titular:** el conteo — *"Tres servicios sin resultado."*

---

## 3. Banda de estado

Abiertos · el más próximo a cerrar (en días, con su fecha) · **cuántos se resolvieron solos este mes** · mínimo de cobertura del contrato.

El tercero importa: *"se resolvieron solos, al llegar el archivo"* enseña que el pendiente **no es un callejón sin salida**.

---

## 4. Una tarjeta por servicio

### 4.1 Cabecera
Ruta · fecha, turno, unidad y deadline en mono · a la derecha, el plazo con su fecha exacta y la nota **"plazo de demostración"** (ver §7).

### 4.2 Tres medidas, cada una junto a su umbral
Cobertura (mínimo 80.0%) · hueco mayor (tolerable 10:00) · última señal (con su distancia al destino).

*No lleva "puntos recibidos (de cuántos esperados)" — ver §7: ese denominador no existe como dato real, y esta pantalla no fabrica uno.*

### 4.3 Barra de cobertura contra el umbral — **regla de color**

Tres piezas, y el reparto de color es el punto:

- **Lo observado (48.9%): acero sólido.** Es medición.
- **Lo que faltó para llegar al mínimo: ámbar rayado.** Esa carencia es la razón del estado.
- **La línea del umbral (80%): ámbar.** Marca la exigencia del contrato.

Con su leyenda debajo: *señal observada · lo que faltó para poder juzgar*.

**Pintar la barra completa de ámbar confunde el dato con el fallo.** La cobertura no es un veredicto: es lo que el instrumento alcanzó a ver.

### 4.4 Tira de la ventana — **con su propio título**
`La ventana del servicio · dónde hubo señal y dónde no`

Una barra horizontal del inicio de la ventana al deadline: tramos con señal en **acero**, apagones en **ámbar punteado**. Con su leyenda.

**Es el mismo servicio visto en el tiempo, no en total.** Ahí se ve si fue señal débil pareja o dos apagones grandes — y eso apunta a causas distintas.

### 4.5 Acciones
`Abrir expediente →` · `Ver la ruta` · y a la derecha, la nota: *"si la telemetría archivada llega completa, este servicio se verifica solo."*

**Cuando un patrón sea evidente, la nota lo dice:** *"dos días seguidos en la misma ruta y la misma unidad."* Es un hecho observable, no una acusación.

---

## 5. Estado vacío — el día bueno
*"Ningún servicio quedó sin resultado."* Tranquilo, con el conteo de lo verificado en el periodo. **No es una pantalla vacía: es la meta cumplida.**

---

## 6. Cierre de la pantalla

> **Un pendiente no es un incumplimiento en espera.** Es la constancia de que el instrumento no alcanzó a ver. Puede terminar en cumplido o en no cumplido cuando llegue la evidencia; también puede quedarse sin resolver.
>
> **Qué pasa al cerrarse el plazo** es una regla del contrato, no del sistema.

Y al pie: *"ámbar es su color propio, no un rojo atenuado: no hay falta declarada aquí."*

---

## 7. Auditoría de datos

*Requisito de PLAN-v1 §0.*

**Confirmado en el schema:**
- `evidenceStatus` con su enum, `evidenceWindowStart` / `End` en la tabla de ocurrencias.
- `evidence_points` guarda los puntos observados — base de la cobertura y de la tira de ventana.
- `pendiente_evidencia` existe como estado de cumplimiento.
- `evidenceMinCoveragePct` y `evidenceMaxGapMinutes` viven en la política del contrato.

**Respondido — investigación previa a construir:**

1. **¿Se persiste el hueco mayor, o se calcula al vuelo?** **Se calcula al vuelo, no se persiste.** El algoritmo real (`assessEvidenceCoverage`, `packages/verification/src/index.ts:613-675`) ordena los timestamps de `evidence_points` dentro de la ventana, arma anclas entre puntos consecutivos y suma como cubierto cada tramo cuyo gap sea ≤ `evidenceMaxGapMinutes`. La cobertura es **tiempo cubierto con huecos aceptables** (`coveragePct = coveredMs / windowMs × 100`), no un conteo de puntos — así que el hueco mayor y la tira de §4.4 se derivan de `evidence_points` en cada carga de la pantalla, tal como anticipaba esta pregunta.

2. **Puntos esperados — la medida "214 de ~437 esperados".** **No existe ese dato, y no debe fabricarse.** Ni `evidence_points` ni la política del contrato guardan una frecuencia nominal de reporte GPS por dispositivo o contrato — nada en el sistema define "cada cuántos segundos debería reportar una unidad". El motor de verificación tampoco lo necesita: mide cobertura de tiempo (punto 1), no puntos-recibidos-entre-puntos-esperados. Fabricar un "~437 esperados" implicaría inventar un intervalo nominal que no tiene respaldo en el dominio — exactamente lo que esta pantalla existe para no hacer. **Se omite el denominador**: §4.2 queda con tres medidas (cobertura, hueco mayor, última señal), no cuatro.

3. **El plazo de cierre.** Sigue siendo la decisión pendiente de PLAN-v1 §4. **Va en modo demostración, declarado**, igual que en la Oficina. Nunca un plazo que parezca acordado.

4. **"Se resolvieron solos este mes".** Sigue por confirmar con desarrollo: si no se puede contar cuántos pendientes pasaron a resultado al llegar telemetría archivada, ese renglón de la banda no se construye.

**Si un dato no existe, ese bloque no se muestra. No se inventa el número.**

---

## 8. Lo que NO lleva

- **Rojo.** No hay falta declarada aquí
- **Lenguaje de culpa.** Ni del carrier ni del GPS: el instrumento reporta que no vio, y no dicta de quién es la causa
- **Un plazo que parezca acordado** cuando no lo está
- **Un denominador de "puntos esperados" que no existe en el dominio** — ver §7
- **Botones para "forzar" un resultado.** Si la evidencia no alcanza, no hay veredicto que emitir — esa es toda la pantalla
