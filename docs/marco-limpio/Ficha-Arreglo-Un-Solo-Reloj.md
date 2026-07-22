# Ficha de Arreglo — Un solo reloj (segunda pasada)

> **Fecha:** 22 de julio de 2026
> **Repo:** `j-tel`
> **Tipo:** ARREGLO con **tres paradas obligatorias**. No avanzar de tramo sin aprobación explícita de Asav.
> **Autoridad:** `Marco-Limpio-J-Telemetry-MAESTRO.md`. Donde choque, gana el Marco.
> **Diagnóstico base:** `docs/marco-limpio/Reporte-Diagnostico-Torre-Cero-Rutas.md` (ya en `main`, PR #56). No re-investigar lo que ahí está confirmado.
> **Modelo:** Sonnet para los tramos 1 y 2. **Tramo 3 requiere Opus** — toca generación de ocurrencias.

---

## Principio rector — leer antes de escribir una línea

El PR `feat/zona-horaria` ("un solo reloj") arregló varios archivos y dejó uno atrás. Ese uno causó este bug.

**No repitas el patrón.** No arregles cinco cadenas de texto — crea **una función** que todas llamen.

El arreglo correcto es:

1. Una función única y exportada, por ejemplo `dayForDateQuery(fechaIso: string): Date`, que devuelva `new Date(\`${fechaIso}T12:00:00.000Z\`)`. Dónde vive: junto a `localDateIso`, en el mismo módulo canónico — tú decides el lugar exacto y lo justificas.
2. **Todos** los call sites la llaman. Cero construcción manual de fechas para consulta por día.
3. Comentario en la función explicando por qué mediodía UTC y no medianoche: el cambio de día UTC cruza la tarde civil en Juárez.

Si el arreglo termina con `T12:00:00.000Z` escrito cinco veces, está mal hecho.

---

## Regresión — obligatoria, va en el Tramo 1

Este bug era **invisible para los tests** porque corren en una máquina en hora de Juárez. En Vercel (UTC) fallaba; en local pasaba.

Agrega prueba que:
- Fuerce `TZ=UTC` en el entorno de ejecución.
- Verifique que `localDateIso(dayForDateQuery('2026-07-22'), JTTEL_TZ) === '2026-07-22'`.
- Cubra al menos una fecha en horario de verano y una en invierno (el desfase cambia).

Sin esta prueba, el bug regresa. Es la parte más importante de la ficha, no un extra.

---

## 🛑 TRAMO 1 — La torre (sin parada, avanza directo)

**Archivo:** `apps/web/src/lib/monitoreo-data.ts:171`

Reemplazar la construcción manual por la función nueva.

**Verificación obligatoria antes de reportar:**
- Monitoreo, Campus Santos Dumont, 2026-07-22, Primer Turno → debe mostrar **14 rutas**, no 0.
- `compare-verify-dry` → **0 cambios en veredictos**. Monitoreo no escribe hechos, pero pruébalo.
- Suite completa en verde, corrida con `TZ=UTC`.

Reporta los tres resultados y **sigue al Tramo 2**.

---

## 🛑 TRAMO 2 — Las pantallas (PARADA OBLIGATORIA antes de cambiar nada)

**Archivos:** `apps/web/src/views/jornada-unit.tsx:33`, `apps/web/src/lib/date-range.ts:116-117`, `apps/web/src/views/unit-compliance.tsx:68-107`

**Antes de tocar una línea, mide y repórtame:**

La pantalla de **Cumplimiento** es donde el cliente revisa veredictos. Si lleva tiempo mostrando el día equivocado, eso es un hallazgo con consecuencia — alguien pudo tomar decisiones viéndola.

1. Con `TZ=UTC`, para Campus Santos Dumont y para Planta 47: ¿qué rango de fechas resuelve `unit-compliance.tsx` hoy para cada preset (hoy / ayer / 7d / rango manual)? Reporta `from` y `to` reales.
2. ¿Cuántas ocurrencias devuelve con el rango actual y cuántas devolvería con el rango corregido? Números, no descripciones.
3. ¿La pantalla muestra **cero** para el día pedido, o muestra los datos del **día anterior etiquetados como el pedido**? Son dos gravedades distintas. La segunda es peor.
4. Mismo análisis para `jornada-unit.tsx:33`, que el diagnóstico marcó como "enmascarado". Confirma que sigue enmascarado o que no.

**Deténte ahí.** No cambies nada hasta que Asav apruebe. Cuando apruebe, aplicas la función nueva a los tres archivos y verificas con los mismos números de antes/después.

---

## 🛑 TRAMO 3 — Generación de ocurrencias (PARADA DURA — esto puede haber creado datos torcidos)

**Archivos:** `apps/web/src/app/api/cliente/servicios/route.ts:62-63` → `generateForProfile`, y `packages/db/src/repositories/index.ts:1972, 1983`.

**No escribas código en este tramo. Solo mide.**

Este es el único camino que puede tocar la verdad. Los tramos 1 y 2 son pantallas: se ven mal y se arreglan. Si aquí las ocurrencias se crearon con el día corrido, hay **datos ya nacidos torcidos**, y arreglar el código hacia adelante no endereza lo que ya existe. De esas ocurrencias cuelgan hechos.

**Contesta con evidencia, en español simple:**

1. ¿El `service_date` con que se crea una ocurrencia sale de una fecha construida con el patrón malo, o de otra vía? Traza el camino completo, línea por línea.
2. El diagnóstico dice que `repositories/index.ts:1972,1983` es "aritmética pura, no pasa por `localDateIso`". **Verifícalo, no lo asumas.** ¿En algún punto de esa aritmética se convierte un `Date` a fecha civil?
3. ¿Hay ocurrencias en la base cuyo `service_date` no corresponda al día de la semana que su perfil tiene programado? Ese sería el síntoma de generación corrida. Repórtalo con conteos.
4. El cron `renew-occurrences` corre a las `0 6 * * *`. En UTC eso son las **medianoche de Juárez**, justo el borde peligroso. ¿Qué fecha usa para generar?

**Deténte ahí. Punto final del tramo.** El arreglo de este tramo — si hace falta — va en ficha aparte con aprobación explícita, porque puede implicar corregir datos existentes, y eso toca cosas de las que cuelgan hechos.

---

## 🛑 Límites inviolables (toda la ficha)

- **Prohibido tocar `saveFact`, el motor, el ledger, o cualquier hecho existente.** El arreglo es de código hacia adelante. Ningún veredicto pasado se reescribe.
- **Prohibido crear, borrar o modificar datos** — ocurrencias, perfiles, turnos, rutas. Ni siquiera "para probar".
- **Prohibido cambiar umbrales, políticas o lógica de verificación.** Esto es zona horaria, nada más.
- **Prohibido meter nombres específicos al código.** Santos Dumont y la 47 son dónde se midió, no casos especiales.
- Si en cualquier momento el arreglo obligaría a tocar un hecho, **deténte y avisa**. No lo resuelvas tú.

---

## Ancla en el Marco

- *"La verdad se calcula una vez y se guarda. Nadie recalcula su propia verdad."* Este arreglo no recalcula nada — corrige qué día se consulta.
- *"Los cambios de política aplican hacia adelante."* Mismo criterio aquí: código hacia adelante, historia intacta.
- **`localDateIso` es la función canónica para "qué día es".** Está documentado en el código: *"no duplicar"*. La función nueva de esta ficha es su pareja para el otro lado — construir la fecha de consulta — y debe quedar igual de canónica.

---

## Reglas de trabajo

- `git fetch origin` primero. Rama nueva desde `origin/main`.
- **Una rama, un PR.** Los tres tramos van en la misma rama; el PR se abre al final.
- Suite completa **con `TZ=UTC`** en cada tramo.
- **No mergees.** El merge lo hace Asav, con el check de Vercel en verde.
- Al cerrar: actualiza el Anexo de Estado en la misma rama.
