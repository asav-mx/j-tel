# Ficha de Handoff — Diagnóstico: ¿por qué la verificación no fue automática? (solo lectura)

**Repo:** `j-tel` — este archivo: `docs/Ficha-Handoff-Diagnostico-Automatico.md`. Entra por PR.
**Fecha:** 21 de julio de 2026
**Agente:** Claude Code en Devin — **modelo Sonnet** (es lectura y reporte, no toca lógica).
**Autoridad:** `docs/marco-limpio/Marco-Limpio-J-Telemetry-MAESTRO.md` y `docs/marco-limpio/Anexo-Estado-J-Telemetry.md`.

---

## Por qué existe esta ficha

El Marco dice: **"El sistema es decisivo y automático."** Pero hoy (21 jul) los servicios del contrato del Campus salían crudos/mal hasta que Asav ejecutó una re-verificación **a mano** desde J-Staff. Eso es un síntoma: algo del ciclo automático NO corrió como debe. Antes de arreglar nada, hay que saber CUÁL de dos cosas pasó:

- **Hipótesis A — La política no re-encola:** el servicio se verificó automáticamente en su momento, pero con la ventana vieja congelada (antes del cambio de margen a +45). Al cambiar la política, nada volvió a disparar la verificación de los servicios afectados. → El hueco es "cambiar la política no re-verifica lo afectado".
- **Hipótesis B — El ciclo automático no corre a tiempo:** el cron/scheduler que dispara la verificación no se ejecutó, falló, o va tarde. → El hueco es "el motor automático no se está ejecutando cuando debe".

Son bugs distintos con arreglos distintos. Esta ficha **NO arregla** — solo produce el reporte que dice cuál es.

## Qué NO es esta tarea (límites duros)

- **Solo lectura.** No escribe en `saveFact`, no re-verifica, no cambia el scheduler, no modifica ninguna configuración.
- **No llama a Umbrella.**
- **No copia de `jrz-drone-os`.**
- No propone el arreglo en código — solo describe el hallazgo. El arreglo será su propia ficha después, con la causa ya confirmada.

---

## Tarea única — Reporte de diagnóstico (SOLO LECTURA)

**Rama:** `diag/verificacion-automatica`

Investigar y reportar, para el contrato del Campus (y comparando con otro contrato si ayuda):

### 1. ¿Cómo se dispara hoy la verificación automática?
- Localizar el mecanismo que corre la verificación sin intervención humana (cron job, scheduled function, worker, trigger, cola). Documentar: dónde vive, con qué frecuencia debería correr, y cómo sabe qué servicios verificar.
- ¿Existe siquiera un disparador automático, o hoy la verificación depende de que alguien abra algo / llame un endpoint? (Esto solo ya responde mucho.)

### 2. Para los servicios de hoy (2026-07-21, Campus):
- Por cada servicio: ¿cuándo se creó el hecho de cumplimiento?, ¿cuándo se verificó por última vez?, ¿el disparo fue automático o manual (re-verificación de J-Staff)?
- ¿Cuántos tenían hecho ANTES de la re-verificación manual de Asav, y cuántos aparecieron/cambiaron SOLO por ella?
- Comparar la hora en que el servicio quedó "listo para verificar" (deadline + ventana) contra la hora en que realmente se verificó. ¿Hay retraso sistemático?

### 3. La pregunta clave — ¿qué pasa al cambiar la política?
- Cuando se guarda un cambio de política de contrato (como el margen a +45), ¿se dispara ALGO que re-verifique o re-encole los servicios cuya ventana cambió? Rastrear el código que maneja el guardado de política y ver si notifica/encola algo.
- Si NO se dispara nada → Hipótesis A confirmada.

### 4. Veredicto del diagnóstico
- Un resumen claro en 3–5 líneas: ¿es A, es B, o es una mezcla? Con la evidencia que lo sustenta (rutas de código, tiempos observados).
- Si es mezcla, cuál pesa más.
- **NO proponer solución todavía** — solo el diagnóstico. La ficha de arreglo vendrá después, ya sabiendo la causa.

---

## Reglas de trabajo (Devin — obedece lo ESCRITO)

- Rama `diag/verificacion-automatica`. Todo por PR. Asav revisa; Devin no hace merge.
- Es SOLO LECTURA: si en algún momento la investigación requiere modificar algo para "probar" → DETENTE, no lo hagas, reporta lo que encontraste hasta ahí.
- Si el mecanismo automático no se encuentra donde se espera, o no existe → repórtalo como hallazgo, no lo construyas.
- Puede correr en paralelo a `feat/variantes-trazado` (otra rama, otra área — scheduler vs motor de match). No tocar archivos de esa rama.

## Prohibido

- Escribir en `saveFact`, re-verificar, tocar el scheduler o cualquier config.
- Proponer/implementar el arreglo (esta ficha solo diagnostica).
- Llamar a Umbrella. Consultar `jrz-drone-os`.
