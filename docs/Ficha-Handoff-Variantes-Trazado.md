# Ficha de Handoff — Variantes de trazado (multi-KML) por perfil de ruta

**Repo:** `j-tel` — este archivo: `docs/Ficha-Handoff-Variantes-Trazado.md`. Entra por PR.
**Fecha:** 21 de julio de 2026
**Agente:** Claude Code en Devin → **modelo Opus** (toca el motor del árbitro).
**Autoridad:** `docs/marco-limpio/Marco-Limpio-J-Telemetry-MAESTRO.md` y `docs/marco-limpio/Anexo-Estado-J-Telemetry.md`. Donde choquen, gana el Marco.

---

## Por qué existe esta ficha

Hoy cada perfil de ruta tiene UN solo trazado KML oficial. La realidad operativa tiene varios: tráfico, accidentes, obras, y la rotación de empleados hacen que los choferes usen caminos alternos legítimos al MISMO destino. Con un solo trazado, esos servicios reales caen en `no_cumplido` "sin servicio detectado" — falsos negativos que castigan al carrier y ensucian la señal (la autopsia del 13–17 jul encontró que la mayoría de los 55 rojos son de esta familia).

**La solución:** un perfil de ruta = **UN destino (identidad, intocable) + un CATÁLOGO de trazados aceptados (variantes)**. El motor evalúa contra todas las variantes activas y una unidad cumple si sirve la ruta por CUALQUIERA de ellas.

## Conceptos (no confundir)

- **Variante** = trazados alternos que COEXISTEN como válidos hoy (ej. Riveras-B por MEX-45 o por la Panamericana). Cada variante tiene nombre y estado.
- **Versión** = la historia de UNA variante en el tiempo (el trazado cambió → versión nueva; se juzga cada servicio con la versión vigente en su fecha). La infraestructura de versiones YA existe (`kmlVersionId`, `getKmlVersionForDate`) — **reutilizarla, no duplicarla**.
- **Estado de variante:** `activa` (el motor la considera) o `legacy` (histórica; los hechos viejos que la usaron la siguen referenciando, pero el motor ya no la considera para servicios nuevos).

## Leyes que esta ficha NO puede romper

1. **El destino es la identidad de la ruta.** Las variantes comparten SIEMPRE la misma geocerca destino. Una "variante" con otro destino no existe — eso sería el toggle basura de "destino alterno", que además esta ficha DEBE ELIMINAR (ver Tarea D).
2. **Tres veredictos.** Cumplir por variante = `cumplido`, igual que por el trazado principal. No hay "cumplido parcial" ni cuarto estado.
3. **Hechos congelados.** Agregar/retirar variantes aplica SOLO hacia adelante. Ningún hecho pasado se recalcula solo. (El re-juicio explícito vía `reverifyContract` de J-Staff sigue disponible, auditado, a petición.)
4. **Una sola implementación del match.** La evaluación multi-variante envuelve a `evaluateUnitRouteMatch` existente — NO se escribe una segunda lógica de match/corredor/Fréchet/dirección.
5. **Umbrales de la política del contrato** (A, B, corredor, estrictez) — nunca constantes nuevas.
6. **Confidencialidad:** nada de esto expone datos de otra cuenta.

---

## Tareas

### Tarea A — Modelo de datos: catálogo de variantes

Extender el modelo para que un perfil de ruta tenga N variantes de trazado:

- Cada variante: `id`, `nombre` (ej. "Principal", "Alterna Panamericana"), `estado` (`activa` | `legacy`), `origen` (`manual` | `promovida_de_viaje`), `tripId de origen` (nullable), timestamps.
- Cada variante conserva su propio historial de versiones usando el mecanismo de versiones EXISTENTE.
- El trazado único actual de cada perfil se migra como variante "Principal" activa (migración sin pérdida; cero cambio de comportamiento para perfiles de una sola variante).
- **PUNTO DE PARADA 1:** antes de escribir la migración, presentar a Asav el esquema propuesto (tablas/campos) y el plan de migración. Esperar aprobación.

### Tarea B — Motor: evaluación multi-variante

En la verificación (`verifyService` / capa de servicios):

- Para cada unidad candidata, evaluar contra TODAS las variantes `activas` vigentes en la fecha del servicio (versión por fecha), usando la implementación compartida.
- La unidad "sirve la ruta" si pasa A∧B contra AL MENOS UNA variante. Se toma la variante de mejor score como "variante servida".
- El hecho registra `servedVariantId` (qué variante sirvió) → transparencia total: la planta puede ver que hoy se sirvió por la alterna.
- El ledger registra por candidata el mejor match por variante (sin explotar el tamaño: solo la mejor variante por candidata + su score).
- Empates y orden: mismas reglas de desempate existentes (min(A,B) → Fréchet → dirección → llegada), aplicadas sobre el mejor score por variante.
- **PUNTO DE PARADA 2 (obligatorio, motor):** antes de tocar `verifyService`/`saveFact`, presentar a Asav el diff propuesto en pseudocódigo/resumen: qué cambia, qué campos nuevos escribe el hecho, y confirmación de que `evaluateUnitRouteMatch` no se duplica. Esperar aprobación explícita.

### Tarea C — Gestión del catálogo (J-Staff primero)

UI mínima en J-Staff (la aprobación por la planta es la Ficha 3, NO esta):

- Ver el catálogo de variantes de un perfil (mapa con todas, colores distintos, estado).
- Crear variante: (a) subiendo KML, o (b) **promoviendo el trazo de un viaje ejecutado** — seleccionar un trip, tomar su trazo GPS (recortado al servicio, simplificado a waypoints), y guardarlo como variante nueva con `origen: promovida_de_viaje`. Esto materializa la realidad operativa sin dibujar a mano.
- Cambiar estado activa → legacy (con nota; queda en ledger quién y cuándo).
- Todo cambio de catálogo aplica hacia adelante (fecha de vigencia).

### Tarea D — Eliminar el toggle "Permitir destino alterno"

Basura peligrosa heredada (decisión de Asav, 20 jul): quitar el campo de la UI de política y del esquema/uso en el motor si lo hubiera. El destino jamás es alterno. Si algún código lo lee, eliminar esa rama. Documentar en el PR qué se quitó.

---

## Pruebas mínimas

1. Perfil con una sola variante (migrado) → comportamiento idéntico al actual en todos los casos (regresión cero).
2. Perfil con 2 variantes activas; unidad sirve por la alterna → `cumplido`, hecho registra `servedVariantId` de la alterna.
3. Unidad que no pasa A∧B contra NINGUNA variante → `no_cumplido` (sin cambio).
4. Variante en `legacy` → el motor NO la considera para servicios nuevos; hechos viejos que la referencian siguen intactos y legibles.
5. Versionado: servicio de fecha X se juzga con la versión de la variante vigente en X.
6. Promoción desde viaje: el trazo promovido genera una variante evaluable; un servicio posterior que va por ese camino → `cumplido`.
7. El toggle de destino alterno ya no existe en UI ni en motor; los tests que lo referencien se actualizan.
8. Agregar una variante NO modifica ningún `complianceFact` existente (conteo antes/después idéntico).

## Reglas de trabajo (Devin → obedece lo ESCRITO)

- Rama única: `feat/variantes-trazado`. Todo por PR. **Asav hace el merge, Devin no.**
- **Dos puntos de parada obligatorios** (Tareas A y B). No avanzar sin el OK explícito de Asav en cada uno.
- Ante ambigüedad contra el Marco, o si el mecanismo de versiones existente no encaja como se asume → DETENTE Y AVISA.
- Atender comentarios de revisión (Gemini/Devin Review) antes de pedir merge.

## Prohibido

- Duplicar la lógica de match. Cambiar la definición de los tres veredictos. Recalcular hechos pasados. Umbrales hardcodeados. Variantes con destino distinto. Tocar caras de cliente/planta (eso es Ficha 3). Llamar a Umbrella. Consultar `jrz-drone-os`.
