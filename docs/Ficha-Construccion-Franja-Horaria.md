# Ficha de construcción · La promesa por franja horaria (Marco 9.1c)

**Qué es.** El eslabón 1 de la cadena del arranque. Hoy la promesa de un circuito es **un solo número para todo el día** —`circuits.declared_frequency_minutes`— y el Marco dice otra cosa desde el 19-sep: la tabla publicada puede prometer frecuencias distintas por franja («cada 10 min de 6 a 9; cada 20 el resto del día»), y **lo medido se compara contra la promesa vigente de esa franja, nunca contra un promedio del día** (9.1c). Juzgar la hora pico con la tabla del valle es la afirmación falsa del alcance (Marco §D).

**Estado: construida.** Migración 0044, dominio en `@jtel/domain`, repositorio en `@jtel/db`, probado de punta a punta contra la desechable. Falta la pantalla de captura (fuera de esta ficha, ver §5) y conectarla al eslabón 2.

**Proceso:** rama propia. Migración en Neon antes del merge. Checks verdes no son aprobación. **El merge es de Asav** — esto es base de datos.

---

## 1 · Las tres decisiones, ratificadas por Asav el 20-sep-2026

**1 · La promesa es un conjunto, no una franja suelta.** «Se lee completa, y la pregunta que importa es qué prometíamos tal día. Versionar por renglón permite una promesa Frankenstein mezclando versiones.» La vigencia vive en `circuit_promise_tables` — la tabla que agrupa —, y **no** en cada franja: `circuit_promise_bands` no lleva `valid_from`/`valid_to` propios. Corregir una sola franja cierra la versión entera y abre otra completa.

**2 · Sí distingue día.** «Mínimo entre semana / sábado / domingo. El domingo no se parece al martes, y medir domingo contra la tabla de entre semana es afirmación falsa (§D). El modelo lo soporta aunque Oasis-Centro arranque con una sola tabla.» Enum `tipo_de_dia_circuito`, tres valores, nunca siete. Los festivos no entran: son un calendario, y un calendario es otra pieza.

**3 · El horario de servicio manda.** «Una franja fuera de él se rechaza al capturar, con su razón en pantalla — nunca se ignora en silencio. Y si queda parte del horario sin franja, eso es "sin promesa declarada" para esa parte del día, dicho así: no se rellena con la franja vecina.» `franjaDentroDelHorario` (en `@jtel/domain`) rechaza al capturar, con contención completa —no traslape—; `promesaEnInstante` declara honestamente que no hay promesa cuando ningún franja cubre el instante, en vez de heredar la de la franja de al lado.

## 2 · Lo que se construyó, y dónde vive

| Pieza | Dónde |
|---|---|
| El enum de tipo de día | `packages/db/drizzle/0044_promesa_por_franja.sql` |
| Las dos tablas (`circuit_promise_tables`, `circuit_promise_bands`) | misma migración, más su reversa |
| `franjaDentroDelHorario`, `validarFranjas`, `promesaEnInstante` | `packages/domain/src/franja-horaria.ts` |
| `tipoDeDiaLocal` (canónico, reusado — no duplicado) | `packages/domain/src/tiempo.ts` |
| `getPromiseTableVigente`, `getPromiseTableAt`, `getPromesaEnInstante`, `savePromiseTable` | `CircuitRepository`, `packages/db/src/repositories/index.ts` |
| Pruebas de dominio (23 casos) | `franja-horaria.test.ts`, `tiempo.test.ts` |
| Pruebas de integración contra la desechable (10 casos) | `promesa-por-franja.integration.test.ts` |

## 3 · Cinco decisiones de construcción que Asav no fijó explícitamente, y quedaron a mi criterio

Documentadas aquí para que se corrijan en un solo lugar si no son las correctas.

**A · El traslape entre franjas se rechaza, igual que estar fuera de horario.** Dos franjas del mismo día y sentido cubriendo el mismo instante volvería ambigua «la promesa vigente en ese instante» — justo lo que 9.1c existe para que nunca lo sea. No es palabra textual de Asav, pero es la misma familia que el candado de «una vigente» que ya sostiene la base en paradas y asignaciones.

**B · Guardar es todo o nada.** Si una sola franja del conjunto que se manda a guardar es inválida (fuera de horario, o se encima), **no se guarda ninguna**: se devuelven las rechazadas para que la pantalla las enseñe y quien captura corrija el conjunto entero. La alternativa —guardar las válidas y avisar aparte de las rechazadas— es defendible y está a una línea de cambiarse si se prefiere.

**C · Las franjas no cruzan medianoche, aunque el horario de servicio sí pueda.** `franjaDentroDelHorario` sí aguanta un horario nocturno (22:00–06:00, como `enHorarioDeServicio`), pero una franja individual que ella misma cruce medianoche se rechaza — se declara como dos. Simplificación de esta primera versión; Oasis–Centro no lo necesita (05:00–23:00).

**D · Sentido `NULL` en una franja se trata como «ambos» al comprobar traslapes.** Una franja sin sentido declarado se encima con cualquier franja del mismo horario, sea cual sea su sentido — porque promete para los dos.

**E · `sentido` en la tabla es el enum `sentido_circuito` que ya existe** (`ida`/`vuelta`), no uno nuevo — reusa lo que el circuito ya declara para trazados y paradas.

## 4 · Lo que esta ficha NO construye

- **La pantalla de captura.** Vive en `/jstaff/circuitos/[id]`, junto al editor que ya existe; no se tocó en este PR.
- **El endpoint / API route** para llamar a `savePromiseTable` desde la pantalla.
- **La historia del horario de servicio del circuito** (`service_start_local`/`service_end_local`). Sigue siendo el pendiente con nombre del plan, y **esta migración nace con vigencia desde el primer día**, exactamente para no heredar ese defecto — es lo que Asav pidió recordar.
- **La tabla publicada en la app del pasajero** (8.2). El dato ya se puede leer (`getPromiseTableVigente`); publicarlo es el eslabón 3.
- **Comparar lo medido contra la franja.** Eso es el eslabón 2 — `getPromesaEnInstante` es la pieza que lo va a alimentar, ya construida y probada.

## 5 · Pruebas hechas (contra la desechable, no supuestas)

1. El ejemplo del Marco —cada 10 de 6 a 9, cada 20 el resto del día— se guarda entero. ✓
2. Todo o nada: una franja fuera de horario tumba el conjunto completo sin guardar nada. ✓
3. Corregir la promesa cierra la vigente (con su motivo) y abre otra — nunca pisa una franja suelta. ✓
4. El candado de la base: dos tablas vigentes del mismo circuito, a mano y sin pasar por el método, revientan. ✓
5. Horario nocturno: una franja de la madrugada se acepta, una del mediodía se rechaza. ✓
6. Los dos CHECK de la base —frecuencia positiva, no cruzar medianoche— muerden aunque se les mande directo, sin pasar por el dominio. ✓
7. La promesa vigente **en un instante pasado** devuelve lo que se prometía entonces, no lo de hoy — la ley central de 9.1c. ✓
8. La hora pico y el valle dan cadencias distintas nunca un promedio del día; un circuito sin promesa capturada dice «sin declarar», no inventa nada. ✓
