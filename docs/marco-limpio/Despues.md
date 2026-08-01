# Después — lo que decidimos no hacer ahora, y por qué

**Qué es esto:** la fila de lo que quedó fuera del alcance actual **por decisión, no por olvido**.

**Para qué sirve:** cuando algo aparece aquí, ya se discutió. No hay que volver a decidirlo desde cero — solo revisar si ya llegó su momento.

**Qué NO es:** no es el plan de trabajo. Eso es `PLAN-v1.md`. Esto es lo que *no* está en el plan y la razón.

**Cómo se mantiene:** cuando algo de aquí entra a construcción, se mueve a `PLAN-v1.md` y se borra de esta lista. Cuando surge una idea buena que no es de ahora, se anota aquí en vez de perderse en un chat.

---

## 1. Bloquea trabajo que ya está definido

Lo único de esta lista que **no es opcional**: sin esto, algo que ya diseñamos no se puede terminar.

### Destinatarios de correo por rol y contrato
**Bloquea:** Ola 1.b — los correos ya están definidos pero no hay a quién mandárselos.

Hoy no existe forma de resolver *"todos los usuarios con rol X en el contrato Y"*. Los emails viven en Clerk, `userMemberships` no está ligado a `service_contracts`, y `canal.ts` manda a una lista fija por variable de entorno.

*Escrito también en el ítem 1.b de `PLAN-v1.md`. Detalle completo en la ficha de correos.*

---

## 2. Refinamientos del motor

### Aprender la velocidad por unidad, no solo por ruta
El sistema ya deriva la duración esperada del historial de **cada ruta** (`routeDurationPercentile`, `routeDurationMinSamples`, `windowDerivationEnabled`), usando `routeAvgSpeedKmh` solo como respaldo cuando no hay historia.

Lo que no hace: **aprender que una unidad específica es sistemáticamente más lenta** que el resto de la flota.

**Por qué no ahora:** el aprendizaje por ruta ya existe y alcanza para verificar. Por unidad es refinamiento y necesita más historia acumulada.

*Salió de preguntar por qué `routeAvgSpeedKmh` estaba fijo en 20 km/h.*

### Llegada estimada (ETA) en la vista en vivo
Los insumos existen: `waypoints` de la ruta, `polygon` de la geocerca, `latitude`/`longitude`/`speed` en los puntos, y la derivación por historial.

**Condición si se construye:** una ETA es **inferencia, no hecho medido**. Va en acero, se muestra como estimación, y **si la señal está vieja se muestra `—`** en vez de una hora calculada sobre datos rancios.

*En evaluación como PR propio de Carril A, en paralelo al revestimiento de Monitoreo.*

---

## 3. Deuda de la piel

### Los 13 componentes que escriben color a mano
Usan `rgba(...)` y hexes directos en vez de tokens, así que **no responden al cambio de tema**.

**Quedan fuera de la migración a propósito:**
- `escena-ciudad.tsx` — la parvada del landing es excepción, sin tema claro
- Los mapas — conservan fondo oscuro en ambos temas, porque el lienzo es evidencia, no interfaz

**Regla del skill que esto viola:** ningún componente escribe color a mano; si falta un tinte, se agrega token a las dos paletas.

---

## 4. Pantallas sin dibujar

| Pantalla | Depende de |
|---|---|
| Login y onboarding | `auth-rbac` conectado — ya arrancó, es diseñable |
| Inicio y consola de J-Staff | `auth-rbac` |
| Torre del carrier (su propio monitoreo) | `auth-rbac` |
| Expediente del contrato (la 5ª identidad) | nada — se puede diseñar cuando toque |
| Catálogo y alta de unidades | espejo del módulo de choferes |
| Las cuatro rutas: inspecciones, notificaciones, reportes, plantas | ya sabemos qué son; falta diseñarlas |
| Exportaciones | — |
| Móvil | que la versión de escritorio esté construida |

**Móvil, decidido:** la misma información que en computadora, dentro del rol de cada usuario — **no dos productos distintos**. Lo que cambia es la forma: una retícula grande se convierte en lista de días.

---

## 5. Pantallas diseñadas y aprobadas, sin ficha — todas Ola 3

Existen como diseño validado, pero **no se pueden construir hasta que el árbitro sea confiable** (compuerta de Ola 2: ≥90% sostenido dos semanas).

- Cumplimiento (la retícula ruta × día con su cadena macro→micro)
- Expediente del servicio
- Vista de ruta
- Expediente de unidad

**Cuando llegue Ola 3, cada una necesita su ficha con auditoría de datos antes de construirse.**

---

## 6. Módulos completos que esperan

### Choferes
Plano completo en `Plan-Choferes.md`. Ola 3.
**La decisión de la que todo depende:** el modelo de datos de las dos capas —hechos congelados y credenciales purgables— se confirma antes de construir cualquier pantalla del módulo.

### Riel de quejas
Bloqueado por tres cosas: la Pieza 1, el interruptor de consecuencia, y las cláusulas del contrato.

### Consecuencia sobre el pago (enforcement)
Apagado por defecto; se prende **solo cuando las dos partes lo acuerdan**. Parado hasta que el motor de arbitraje sea confiable — la consecuencia amplifica al árbitro, así que el orden correcto es árbitro primero.

---

## 7. Preguntas abiertas para el abogado

- Base y periodo de retención de datos, y redacción del aviso de privacidad
- Distinción responsable / encargado entre el carrier y J-Tel
- Alcance de la reforma LFT para carriers

**Mientras es local, se avanza con supuestos:** el carrier es responsable y J-Tel encargado; nombre y registro se conservan; las credenciales son purgables; el periodo de conservación es **configurable, nunca fijo en el código**.

**Lo no posponible:** la separación de las dos capas de datos del chofer. Esa se diseña bien desde el inicio, con o sin abogado.
