# Ficha de Handoff — Cerrar fugas de inventario de flota (Monitoreo y Jornada)

**Rama:** `fix/fuga-inventario-flota`
**Agente:** Claude Code en Devin → **modelo Opus** (toca estructura de datos y filtros de UI).
**Autoridad:** `docs/marco-limpio/Marco-Limpio-J-Telemetry-MAESTRO.md`. Donde algo choque, gana el Marco.

---

## Por qué existe esta ficha

El PR anterior (`fix/fuga-flota-cara-cliente`) cerró la fuga del **trazo GPS** de flota en el mapa. Pero la auditoría encontró fugas más profundas, de **datos estructurados**, que siguen vivas:

| Dónde | Qué filtra hoy |
|---|---|
| `monitoreo-data.ts` | Lista completa de unidades del carrier (`units[]`) + telemetría de toda la flota |
| `jornada-data.ts` | `unitMap` cargado con TODAS las unidades del carrier + telemetría de todos sus IMEIs |

Esto es peor que el trazo: es el **catálogo completo del inventario** del transportista entregado a su cliente. Ley rota (Pieza 4): *"El cliente jamás ve la operación interna del carrier."*

## La regla de negocio que aplica (decisión de Asav, 21 jul)

Hay que distinguir tres cosas que hoy se confunden:

1. **Unidad observada** — la que de verdad sirvió una ruta de ESA planta. **La planta SÍ la ve**, en vivo y en histórico. Es la verdad operativa y es parte del servicio que paga. Ancla del Marco: *"La unidad observada es la verdad."*

2. **Catálogo declarado** — el conjunto de unidades que el carrier **asigna a ese contrato** (placas, seguros, documentación legal). **La planta SÍ lo ve**, pero es *declarativo*, no realidad de operación: el carrier puede servir con unidades distintas cualquier día. Sirve para inspecciones y cumplimiento legal, no para saber quién anduvo hoy. Ancla del Marco: *"la unidad de referencia es sólo plan"*, y *"un perfil concreta un contrato con … unidades posibles"*.

3. **Inventario completo del carrier** — todas sus unidades, sirvan o no a esta planta. **La planta NUNCA lo ve.** Ni la lista, ni sus etiquetas, ni su telemetría.

**Nota importante:** el concepto de catálogo declarado YA EXISTE en el esquema — `serviceProfileUnits` / `possibleUnits` del perfil de servicio, expuesto por `getPossibleUnitIds`. Hoy se guarda **vacío** (ver comentario en `app/api/cliente/servicios/route.ts`: *"Flota: la asigna el carrier. El cliente no elige ni ve unidades aquí."*). El vehículo existe; falta usarlo. **Reutilizarlo — no inventar un mecanismo nuevo.**

---

## Tareas

### Tarea A — Monitoreo: solo unidades observadas de las rutas de esa planta

En `apps/web/src/lib/monitoreo-data.ts`:

- La lista `units[]` que se devuelve al cliente debe contener **solo las unidades observadas/emparejadas a las ocurrencias de ESE alcance** (planta o campus) en ese turno — no `getUnitsForCarrier` completo.
- La telemetría cargada para el cliente debe limitarse a los IMEIs de esas unidades. Hoy carga toda la flota.
- Si el emparejamiento en vivo requiere evaluar candidatas de toda la flota **por dentro** (es legítimo, es el motor trabajando), ese razonamiento **no puede salir en la respuesta al cliente**: se evalúa internamente y solo se devuelve el resultado.
- **PUNTO DE PARADA 1:** si limitar la telemetría rompe el emparejamiento en vivo (porque el motor necesita candidatas antes de saber cuál ganó), **DETENTE y avisa a Asav** con la explicación. No degrades el monitoreo para tapar la fuga; hay que resolver ambas.

### Tarea B — Jornada: mismo criterio

En `apps/web/src/lib/jornada-data.ts`:

- `unitMap` debe poblarse solo con las unidades observadas de las ocurrencias del alcance, no con `getUnitsForCarrier` completo.
- La telemetría cargada debe limitarse a los IMEIs de esas unidades.

### Tarea C — Catálogo declarado (lo que la planta SÍ puede ver)

Sin construir UI nueva todavía — solo dejar la vía correcta disponible:

- Verificar que `getPossibleUnitIds` / `possibleUnits` del perfil funcione y esté expuesto para la cara cliente.
- Documentar en el código (comentario claro) la distinción de las tres categorías de arriba, para que nadie vuelva a "arreglar" un mapa vacío entregando el inventario.
- **NO** construir todavía la pantalla donde el carrier asigna unidades a un contrato — eso es una ficha aparte. Solo dejar el camino claro y anotado.

### Tarea D — Auditoría de cierre

Buscar en el repo cualquier otro punto donde la cara cliente reciba datos derivados del inventario del carrier: conteos de flota, etiquetas de unidades no observadas, dispositivos, IMEIs, choferes. Reportar hallazgos.

---

## Pruebas mínimas

1. **Monitoreo, cara cliente:** la respuesta contiene solo unidades emparejadas a rutas de ese alcance. Una unidad del carrier que ese turno sirvió a OTRO cliente no aparece por ningún lado (ni en la lista, ni en el filtro, ni en telemetría).
2. **Jornada, cara cliente:** mismo criterio.
3. **Cara carrier:** sigue viendo su flota completa. Sin cambio.
4. **El filtro de "Unidad"** en las vistas de cliente sigue funcionando, pero solo lista unidades observadas de ese alcance.
5. Ningún veredicto cambia. Contar `complianceFact` antes/después — idéntico. Correr `compare-verify-dry` sobre un día conocido — 0 cambios.
6. La respuesta al cliente no revela conteos ni identificadores de unidades no observadas.

---

## Reglas de trabajo (Devin → obedece lo ESCRITO)

- Rama única: `fix/fuga-inventario-flota`. Todo por PR. **Asav hace el merge, Devin no.**
- Es presentación y capa de datos: **no toca el motor de verificación, no cambia veredictos, no toca `saveFact`**, no borra telemetría almacenada.
- **Punto de parada obligatorio en Tarea A** si el emparejamiento en vivo se degrada.
- Si aparecen más fugas de las esperadas en Tarea D — repórtalas, no las arregles todas sin avisar.
- Atender comentarios de revisión antes de pedir merge.

## Prohibido

- Cambiar veredictos o hechos congelados. Borrar telemetría.
- Quitar datos legítimos de la cara carrier o J-Staff.
- Degradar el monitoreo en vivo para tapar la fuga (hay que resolver las dos cosas).
- Inventar un mecanismo nuevo de "unidades del contrato" — reutilizar `possibleUnits`.
- Revelar indirectamente el inventario (conteos, "N unidades disponibles", etc.).
- Llamar a Umbrella. Consultar `jrz-drone-os`.
