# Ficha de Handoff — Zona horaria configurable y un solo reloj

**Repo:** `j-tel` — este archivo: `docs/marco-limpio/Ficha-Handoff-Zona-Horaria.md`. Entra por PR.
**Fecha:** 21 de julio de 2026
**Agente:** Claude Code en Devin → **modelo Opus** (toca cálculo de fechas usado por el motor y por los filtros).
**Autoridad:** `docs/marco-limpio/Marco-Limpio-J-Telemetry-MAESTRO.md` y `docs/marco-limpio/Anexo-Estado-J-Telemetry.md`.

---

## Por qué existe esta ficha

**Síntoma observado (21 jul):** el turno arranca 06:00 y la anticipación es de 20 min → el deadline local es **05:40**. Pero el detalle del servicio mostraba "deadline 11:40 a.m." y el hover del mapa mostraba la llegada a las "5:43 a.m.". Los datos eran correctos; **la pantalla mezclaba dos relojes** (UTC en unos lugares, hora local en otros). Eso confunde al operador, al cliente y al carrier — y un veredicto con horas que no cuadran a la vista *parece* mentiroso aunque sea exacto. La confianza del veredicto es el activo del producto.

**Dos problemas de fondo detectados en el código:**

1. **Dos relojes conviviendo.** `apps/web/src/lib/local-time.ts` sí resuelve la fecha civil en zona operativa (`localDateIso`, usado por Monitoreo). Pero `apps/web/src/lib/date-range.ts` calcula el "hoy" y los rangos con `new Date().toISOString()`, que es **UTC**. Consecuencia grave: entre ~18:00 y medianoche hora de Juárez, el sistema ya considera que es el día siguiente. Los turnos vespertinos (Turno B, 18:00) pueden caer en el día equivocado en filtros y reportes.

2. **La zona horaria está hardcodeada.** `JTTEL_TZ = "America/Ciudad_Juarez"` es una constante en el código. Hoy todos los contratos son de Juárez, pero esto viola la regla de producto: **el código nunca conoce nombres específicos; los documentos sí los usan como ejemplo.** Un cliente futuro en otra zona vería horas ajenas. La zona debe ser configuración del contrato, con Juárez como valor por defecto — igual que las tolerancias.

---

## Qué NO es esta tarea (límites duros)

- **No cambia ningún veredicto ni recalcula hechos.** Los hechos congelados no se tocan. Esto es cómo se **calcula el día civil** y cómo se **muestra** la hora, no cómo se juzga.
- **No cambia el almacenamiento.** Los timestamps se siguen guardando en UTC en la base (que es lo correcto). Lo que cambia es la conversión al mostrar y al resolver "qué día es hoy".
- **No toca `evaluateUnitRouteMatch`, ni el motor de match, ni las variantes.**
- **No llama a Umbrella. No consulta `jrz-drone-os`.**

---

## Tareas

### Tarea A — Zona horaria como configuración del contrato

- Agregar `timeZone` (texto, IANA, ej. `America/Ciudad_Juarez`) a la política del contrato, con **valor por defecto la zona actual** para no cambiar comportamiento en los contratos existentes.
- Exponerlo en la UI de política del contrato, junto a las demás perillas, con una nota de ayuda: "todas las horas de este contrato se muestran en esta zona".
- `JTTEL_TZ` deja de ser la fuente de verdad: pasa a ser **solo el default** cuando un contrato no tenga zona definida. Ninguna función debe asumir Juárez.
- Migración: agregar la columna con default; cero cambio de comportamiento.
- **PUNTO DE PARADA 1:** presentar a Asav el esquema y el plan de migración antes de escribir código. Esperar aprobación.

### Tarea B — Un solo reloj: eliminar el cálculo en UTC

- **`date-range.ts` es el foco.** `todayIso()`, `addDaysIso()` e `inCreatedAtRange()` usan `toISOString()` (UTC). Deben resolver el día civil en la **zona del contrato en contexto** (reutilizando el mecanismo que ya existe en `local-time.ts` — **no escribir una segunda implementación**).
- Auditar todo el repo buscando otros usos de `toISOString().slice(0,10)`, `new Date()` sin zona, o formateo de hora sin `timeZone`, y corregirlos para que usen la zona del contrato.
- **Regla:** una sola función resuelve "qué día civil es" y una sola resuelve "cómo se muestra una hora". Nada de conversiones ad-hoc regadas por las vistas.
- **PUNTO DE PARADA 2 (obligatorio):** antes de tocar `date-range.ts`, presentar a Asav: (a) la lista completa de lugares del repo que hoy calculan fecha/hora en UTC, (b) cuáles afectan filtros/reportes y cuáles solo display, y (c) el diff propuesto. Esperar aprobación explícita.

### Tarea C — Mostrar la hora de forma consistente y explícita

- Todas las horas que ve el humano (deadline, ventana, llegada, hover del mapa, tablas, expedientes, el reporte de autopsia) se muestran en la **zona del contrato**, nunca en UTC ni en la zona del navegador.
- Donde haya riesgo de ambigüedad, mostrar la referencia de zona de forma discreta (ej. "05:40 (hora local)").
- Verificar en concreto el detalle del servicio: deadline, "ventana (política)", "ventana usada en este viaje", llegada observada, y el tooltip del mapa deben coincidir entre sí.

---

## Pruebas mínimas

1. Un servicio con turno 06:00 y anticipación 20 min muestra **deadline 05:40** en el detalle, y el tooltip de llegada usa la misma escala. Ningún "11:40 a.m." para ese caso.
2. **Prueba del turno vespertino:** con la hora del sistema simulada a las 19:00 hora de Juárez, `todayIso()` devuelve el día civil de Juárez, NO el día siguiente. Los servicios del Turno B (18:00) caen en el día correcto en los filtros.
3. Cambiar la zona de un contrato de prueba a otra zona → todas sus pantallas muestran las horas en esa zona; los contratos sin cambio siguen igual.
4. **Regresión de veredictos:** correr la verificación antes y después del cambio sobre un día conocido → los veredictos son idénticos. Contar hechos antes/después → idéntico. Ningún `complianceFact` modificado.
5. Los timestamps en base de datos siguen guardándose en UTC (sin cambio de almacenamiento).
6. Búsqueda en el repo: no quedan usos de `toISOString().slice(0,10)` para resolver día civil en rutas de usuario.

---

## Reglas de trabajo (Devin → obedece lo ESCRITO)

- Rama única: `feat/zona-horaria`. Todo por PR. **Asav hace el merge, Devin no.**
- **Dos puntos de parada obligatorios** (Tareas A y B). No avanzar sin OK explícito de Asav en cada uno.
- Ante ambigüedad contra el Marco, o si aparecen más lugares con fechas en UTC de los esperados → DETENTE Y AVISA con la lista.
- Atender comentarios de revisión (Gemini/Devin Review) antes de pedir merge.
- No abrir otra rama en paralelo: se trabaja una tarea a la vez.

## Prohibido

- Cambiar veredictos, recalcular hechos, o tocar el motor de match/variantes.
- Escribir una segunda implementación de resolución de fecha/zona (reutilizar `local-time.ts`).
- Dejar la zona hardcodeada en cualquier función nueva.
- Cambiar el formato de almacenamiento de timestamps (siguen en UTC).
- Llamar a Umbrella. Consultar `jrz-drone-os`.
