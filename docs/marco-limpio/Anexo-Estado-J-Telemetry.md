# Anexo de Estado — J-Telemetry

**Qué es esto:** una foto del estado del producto para no cargar las decisiones en la cabeza. Cuelga del Marco Maestro (no lo reemplaza). El Marco sigue siendo la fuente de verdad de las leyes; esto solo registra dónde estamos, qué se decidió y qué falta. Se actualiza cuando cambie algo grande.

**Fecha de este corte:** 20 de julio de 2026.

---

## 1. Decisiones tomadas (candidatas a volverse ley del Marco)

Estas ya se decidieron y se están aplicando. Cuando haya calma, valorar cuáles suben a las Piezas del Marco como leyes formales.

- **Margen de evidencia después del deadline = 45 min** (contrato Campus Santos Dumont). Sube la ventana en la que el réferi *busca* la llegada, sin aflojar el veredicto. Una unidad que llega tarde sigue siendo `no_cumplido` si excede la tolerancia; lo único que cambia es que ahora la llegada tardía **se ve** en vez de quedar ciega. Perilla por contrato, no código.
  - *Ancla Marco:* "Cada contrato define su tolerancia… y qué tan estricto se mide la ruta" (Pieza 3). "Sin evidencia ≠ no se cumplió" (Pieza 1-C).

- **Jerarquía de gravedad operativa** (para enforcement, NO para el veredicto):
  1. **No servir la ruta = pecado capital.** Deja trabajadores sin llegar al trabajo. Penalización mayor, puede exceder el valor del servicio (el carrier acaba debiendo). Raro (~2–3% de los viajes).
  2. **Servir tarde = falta menor.** La gente llegó, con retraso. Penalización suave / descuento.
  - Esta jerarquía se refleja en **pago y enforcement**, nunca en el veredicto. El veredicto solo dice cumplió / no cumplió / sin evidencia.

- **Motivo del `no_cumplido` sí se muestra a cliente y planta.** La línea "Llegada tarde (+N min, unidad X)" vs. "Sin servicio detectado" se lee del hecho congelado, nunca se recalcula. Es justicia informativa: un rojo pelón castiga de más; el motivo dice la verdad completa.
  - *Ancla Marco:* "Todos leen este mismo hecho" (Pieza 1-A, Hecho de cumplimiento).

- **Razonamiento interno del carrier jamás sale de J-Staff.** Candidatas evaluadas, geocercas de otros contratos, sugerencias de calibración, y las cubetas de la autopsia: todo eso es interno. El cliente/planta nunca lo ve.
  - *Ancla Marco:* "El cliente jamás ve la operación interna del carrier" (Pieza 4, leyes).

- **Empalme y variante son inferencias, no hechos probados.** El conteo agregado en J-Staff sí (sirve para diagnóstico y para negociar con el cliente). La etiqueta individual pegada a un servicio, solo con confirmación humana — nunca por sospecha automática, para no romper la confianza del veredicto.

- **La autopsia es herramienta de diagnóstico interna (J-Staff), no producto de cara al cliente.** Se corre cuando hay un pico raro de rojos, se lee el diagnóstico, se ajusta la perilla correcta, y se guarda. No es un tablero de uso diario.

- **Todas las tolerancias y umbrales son configurables por contrato, nunca hardcodeados.** La UI guarda el acuerdo; no lo decide. Quien configura es quien paga (la planta), nunca el auditado (el carrier). Los cambios de política aplican solo hacia adelante; jamás reescriben hechos congelados.
  - *Ancla Marco:* "La verdad se calcula una vez y se guarda" (Pieza 1-C).

---

## 2. Hallazgo clave de la sesión

**Autopsia de los 55 `no_cumplido` del Campus Santos Dumont, semana 13–17 jul (135 servicios: 80 cumplido, 55 no cumplido, 0 pendiente):**

| Cubeta | Cantidad | % |
|--------|----------|---|
| Llegada fuera de ventana (tarde real) | 36 | 65% |
| Empalme (una unidad, dos rutas) | 14 | 25% |
| Variante (mismo destino, otra calle) | 5 | 9% |
| Sin servicio detectado | 0 | 0% |
| Hueco de datos | 0 | 0% |
| Basura de GPS (brinco) | 0 | 0% |

**Lectura:** el motor mide bien. Cobertura al 100%, cero servicios fantasma, cero fallas de GPS. **El problema es 100% operativo: el carrier llega tarde y consolida rutas (empalmes).** El réferi está haciendo su trabajo — decir la verdad incómoda. No hubo que aflojar ningún umbral; se diagnosticó la causa real con datos.

**Bandera de salud confirmada:** `sinCoberturaStep0Insuficiente = 0` → ningún `no_cumplido` se coló sin pasar la precondición de cobertura. La precondición está sana.

---

## 3. Estado del trabajo en curso

- **PR #46 — Autopsia de no_cumplidos (reporte de solo lectura):** ✅ mergeado a `main` el 20 jul. Endpoint J-Staff `/api/jstaff/autopsia-no-cumplidos`. Solo lectura; no toca `saveFact`, no llama a Umbrella. Incluye TODO de seguridad anotado (ver deuda 1 abajo).
- **Tarea 3 (contexto "llegada fuera de ventana" en el ledger):** ✅ viva en el motor desde antes. Anota la llegada tardía sin cambiar el veredicto.
- **Herramienta de trabajo:** ahora con **Devin** (Claude Code), no Cursor. Reglas escritas en las fichas (Devin obedece lo escrito): una rama por tarea, todo por PR, merge a `main` solo por Asav.

---

## 4. Pendientes grandes (camino a v1), priorizados

Estos son los frentes abiertos. NO se construyen todos ahora — se vuelven fichas una por una cuando les toque. Orden sugerido:

### Columna A — Determinar bien la verdad (seguir el hilo de hoy)
1. **Motivo bajo el chip rojo** (siguiente ficha): mostrar "Llegada tarde (+N min)" / "Sin servicio detectado" en las caras de cliente, planta y carrier. Solo lectura del hecho; cero motor, cero enforcement. Impacto inmediato: los 55 rojos mudos se vuelven 55 rojos explicados. *(Es la Tarea 4 ya diseñada en la ficha de evidencia de llegada.)*
2. **Cara del carrier — mostrarle su verdad + etiqueta de defensa:** que el carrier vea "tu unidad sí llegó, N min fuera" (leído del ledger), y pueda etiquetar un `no_cumplido` ("sí se hizo, unidad X") para calibración — **nunca cambia el veredicto**. Torre de control de flota completa = fase posterior (segunda cara del producto).
3. **Decisiones de contrato pendientes con Tecma** (decisión de negocio, no código): ¿el empalme cuenta como servido? ¿tolerancia de tardíos? Se capturan en las perillas del contrato. Usar el reporte agregado de la autopsia como evidencia en esa plática.
4. **Seguimiento condicionado** (congelado, esperando datos): si el margen de 45 min no captura suficientes llegadas tardías, evaluar seguir midiendo a la unidad que demostró arrancar la ruta (arranque de KML + dirección coherente), con tope duro = duración máx. de ruta. Toca el árbitro → ficha con parada obligatoria. **No construir hasta que los datos lo justifiquen.**

### Columna B — Infraestructura para producción (deuda estructural)
Esto no bloquea el diagnóstico de hoy, pero SÍ bloquea salir a producción con clientes reales. Ya está **diseñado en la Pieza 4 del Marco**; falta construirlo.

1. **Autenticación / login — DEUDA CRÍTICA.** Hoy J-Telemetry no tiene puerta de entrada: ningún endpoint verifica quién entra; todo corre con un usuario de prueba fijo (`tecma_admin`). Existe `getJStaffMemberships()` en el código pero nadie la invoca. El endpoint de la autopsia quedó con un TODO de seguridad visible. **Aplica a TODOS los endpoints y páginas, no solo la autopsia.** Nada de esto sale a un cliente real sin login.
2. **Autorización por rol × alcance:** que cada cara vea solo lo suyo, en código. Conecta directo con las leyes de confidencialidad. El Marco ya define los roles (Pieza 4); falta implementarlos.
3. **UI de producto v1:** la interfaz actual está bien para pruebas internas, no para cliente. Acabado sobre el motor que ya funciona.

---

## 5. Cómo usar este anexo

- **Cuando termines una pieza:** táchala aquí y, si generó una ley nueva, súbela al Marco.
- **Cuando arranques una ficha para Devin:** que la ficha referencie este anexo y el Marco, no la memoria del chat.
- **Regla que no cambia:** lo que no está escrito (en el Marco o en una ficha), para Devin no existe. Este anexo es para ti; las fichas son para Devin.
