# Ficha de Handoff — Pre-alerta de anticipación configurable (torre)

**Repo:** `j-tel` — guardar en `docs/Ficha-Handoff-Prealerta-Configurable.md`. Entra por PR.
**Fecha:** 14 de julio de 2026
**Autoridad:** el Marco Maestro es la única fuente de verdad. Donde esta ficha y el Marco choquen, gana el Marco.
**Rama sugerida:** `feat/torre-prealerta-configurable`
**Depende de:** el Bloque A de la torre ya mergeado (PR #29).

---

## El contexto

Al eliminar el umbral hardcodeado `DEADLINE_WARN_MIN` (correcto: nada de constantes), **desapareció la pre-alerta de la torre**: el aviso anticipado de "faltan N minutos para el deadline y aún no aparece unidad en esta ruta".

Ese aviso importa. Es el valor real de una torre de control: **actuar antes de que el servicio se convierta en incumplimiento**, no solo verlo pasar. Sin él, la torre se vuelve un espejo retrovisor.

La solución no es devolver la constante. Es hacerla **configurable por contrato**, como todas las tolerancias del sistema (ley del Marco: los umbrales viven en la política del contrato). Tecma puede quererla en 20 min; Honeywell en 30.

---

## Tarea 1 — Nuevo campo en la política del contrato

Agregar a la política del contrato un campo de anticipación de pre-alerta, p. ej. `monitorPreAlertMinutes`:

- Entero, no negativo.
- Default sugerido: **20** (lo que valía la constante vieja), para no cambiar comportamiento en contratos existentes.
- Vive junto a los demás umbrales de la política (`kmlMatchMinPct`, `kmlCorridorMinPct`, etc.), en el mismo lugar del esquema y del formulario de edición de contrato.

**Editable desde la UI** de política del contrato, con su etiqueta en cristiano: por ejemplo *"Pre-alerta de la torre: minutos antes del deadline para avisar si una ruta aún no tiene unidad identificada"*.

---

## Tarea 2 — La torre usa ese campo (solo servicios abiertos)

En la torre, para ocurrencias **sin hecho** (abiertas — las únicas que la torre estima):

- Un servicio abierto que **aún no tiene unidad identificada** y cuyo `minutesToDeadline <= monitorPreAlertMinutes` (leído de la política de esa ocurrencia) → estado `alerta` con motivo del tipo "sin unidad identificada, faltan N min".
- Si `monitorPreAlertMinutes = 0` en un contrato → la pre-alerta queda apagada para ese contrato (no avisa hasta el vencimiento).

**Recordatorio de la ley del Bloque A:** esto SOLO aplica a ocurrencias abiertas. Una ocurrencia con hecho congelado no recibe pre-alerta ni estado en vivo — se muestra como cerrada. La pre-alerta nunca opera sobre lo ya cerrado.

---

## Pruebas mínimas

- Contrato con `monitorPreAlertMinutes = 20`: servicio abierto, sin unidad, a 15 min del deadline → pre-alerta encendida.
- El mismo servicio a 25 min del deadline → sin pre-alerta todavía.
- Contrato con `monitorPreAlertMinutes = 30`: la pre-alerta se enciende antes (a 30 min), probando que lee la política y no una constante.
- `monitorPreAlertMinutes = 0` → la pre-alerta no se enciende nunca; solo al vencimiento.
- Un servicio ya cerrado (con hecho) nunca dispara pre-alerta, sin importar el valor del campo.
- La torre sigue sin escribir: cero `saveFact`, cero ledger.

---

## Reglas de trabajo

- Una rama; todo por PR; nunca directo a `main`.
- Checks en verde o no hay merge.
- Modo "avanza y detente": parar ante cualquier ambigüedad contra el Marco.
- `git pull --ff-only origin main` antes de arrancar.

## Prohibido

- Reintroducir cualquier umbral hardcodeado (incluido el valor de pre-alerta como constante).
- Que la pre-alerta opere sobre ocurrencias con hecho congelado.
- Que la torre escriba hechos, ledger o veredictos.
- Estados nuevos de cara al cliente: los tres de siempre; la torre no usa ninguno de ellos.
