# Diccionario J-Telemetry — los términos en cristiano

**Para qué sirve:** para no tener que acordarte. Cuando Devin o un chat use una palabra que no ubicas, búscala aquí.

**Cómo está organizado:** por *dónde te la topas*, no por orden alfabético. Casi siempre sabes en qué pantalla estabas cuando apareció la palabra.

**Regla de fondo:** ninguna de estas cosas es tuya que aprender de memoria. Son herramientas de quien construye. Lo tuyo es decidir. Este documento existe para que decidir no dependa de entender la plomería.

---

## 1. En GitHub — donde revisas y apruebas

Piensa en GitHub como **el archivo de planos de la obra**. Guarda cada versión del proyecto y quién cambió qué.

**Repositorio (o "repo")**
La carpeta completa del proyecto, con toda su historia. El tuyo es `asav-mx/j-tel`. Es el archivero entero, no un archivo.

**`main`**
La versión oficial, la que está viva en producción. Lo que entra a `main` es lo que ven Tecma y Juárez Bus. Por eso nadie escribe directo ahí.

**Rama (branch)**
Una copia de trabajo, apartada, donde alguien construye sin tocar `main`. Como sacar una copia del plano para rayarla sin arruinar el original. Cuando el trabajo está listo, la copia se integra.
*Regla del proyecto: una rama por tarea.*

**Commit**
Un guardado con nombre. "Aquí cambié esto, y esta es la razón." La historia del proyecto es una fila de commits.

**Pull Request (PR)**
La solicitud formal de *"quiero integrar mi rama a `main`, revísala"*. Es la puerta. Todo pasa por ahí para que tú lo veas antes de que sea real.
*El número (#75) identifica ese PR para siempre.*

**Merge (mergear)**
Aprobar el PR e integrar la rama a `main`. **Es el momento en que el cambio se vuelve real.** El botón lo aprietas tú, nunca Devin.

**"Files changed"**
La pestaña del PR que muestra **exactamente qué archivos cambiaron y cómo**. El título de un PR es una promesa; esta pestaña es la evidencia.
*Regla del proyecto: nunca mergear sin abrirla.*

**Diff**
El "antes y después" de un archivo. Lo que ves dentro de "Files changed".

**Push / pull**
Subir tus cambios al archivo compartido / bajar los de los demás. Devin lo hace solo.

**Bot revisor**
Un lector automático que comenta el PR cuando huele algo raro. El tuyo es el de Devin. **Sus comentarios son pistas, no órdenes** — vale la pena leerlos, y a veces se equivoca.

---

## 2. En Neon — donde vive la información

Neon es **tu base de datos**: el almacén donde vive todo lo que el sistema sabe. Plantas, contratos, servicios, veredictos, puntos de GPS.

**Base de datos**
El almacén. Está organizado en **tablas** (como hojas de Excel), cada tabla tiene **columnas** (las etiquetas de arriba) y **filas** (cada renglón: un servicio, un contrato, un veredicto).

**Rama de base de datos**
Neon te deja tener almacenes paralelos. Tienes dos:

| Rama | Qué es | Quién la toca |
|---|---|---|
| `main` | **La real.** Tecma, Juárez Bus, los veredictos vivos. 1.37 GB | Nadie a mano. Sólo el sistema |
| `test` | **La de práctica.** Vacía, mismas repisas | Sólo Devin, para correr pruebas |

*Existen dos porque una prueba de verdad **destruye** para probar: inventa una planta, la usa, la borra. Eso no puede pasar entre tus datos reales.*

**Schema-only**
Se copió la **forma** del almacén (las repisas, las etiquetas) pero no el **contenido**. Por eso `test` pesa 33 MB y `main` 1.37 GB.

**Migración**
Una instrucción que **cambia la forma del almacén**: agrega una tabla nueva, agrega una columna, borra una. Van numeradas (`0012`, `0013`) y se aplican en orden, una sola vez cada una.
*Analogía: si la base de datos es una bodega, una migración es meter un estante nuevo o quitar uno.*

**Migración aditiva vs. de apriete**
- **Aditiva:** sólo agrega. El sistema viejo ni se entera. Segura.
- **De apriete:** quita algo o vuelve obligatorio un campo. **Rompe cualquier código que todavía use lo viejo.** Por eso va *después* de que el código nuevo esté corriendo.

**NOT NULL / nullable**
`NOT NULL` = ese dato es **obligatorio**, no puede ir vacío. `nullable` = puede ir vacío. Volver algo NOT NULL es de apriete: todo lo que antes lo dejaba vacío empieza a fallar.

**TRUNCATE**
Vaciar una tabla completa de un jalón. **Es la instrucción más peligrosa que hay en el proyecto** — es la que hace el comando de siembra, y es la razón de la alerta viva.

**Seed / siembra**
Rellenar una base vacía con datos de ejemplo para poder probar. Útil en `test`. Catastrófico en `main`, porque primero vacía todo.

**Índice**
Un atajo de búsqueda. Como el índice de un libro: no cambia el contenido, sólo hace que encontrar sea rápido.

**Postgres**
El tipo de base de datos que usas. Neon es quien te la hospeda. *(Postgres es el motor; Neon es el taller donde vive.)*

**Drizzle / ORM**
El traductor entre el código y la base de datos. El código habla en palabras (`complianceFacts`), la base habla en SQL (`compliance_facts`). Drizzle traduce.

**SQL**
El idioma de las bases de datos. Cuando ves `SELECT count(*) FROM ...`, eso es una pregunta al almacén. **Preguntar no cambia nada** — puedes hacerlo sin miedo desde el SQL Editor de Neon.

**Protect (rama protegida)**
Un candado de Neon contra borrado o reseteo accidental. Vale la pena prenderlo en `main`.

---

## 3. En Vercel — donde vive el sistema corriendo

**Vercel**
Donde el sistema está encendido y las pantallas existen. Neon guarda; Vercel corre.

**Deploy (despliegue)**
El momento en que el código nuevo empieza a correr de verdad. **Un merge a `main` dispara un deploy automático.** Por eso el orden importa: si el código nuevo necesita una columna que aún no existe, truena.

**Check (el ✓ del PR)**
Una revisión automática antes de mergear. **Verde no siempre significa "probado"** — significa "pasó lo que se le pidió revisar". Vale la pena saber qué cubre.

**Cron**
Una tarea que corre sola cada cierto tiempo, sin que nadie la pida. Los tuyos:

| Cron | Cada cuánto | Qué hace |
|---|---|---|
| `verify` | 1 minuto | Verifica servicios vencidos |
| `archive` | 10 minutos | Guarda tu copia propia del GPS |
| `renew-occurrences` | 1 vez al día | Genera los servicios del día siguiente |
| `ingest-heartbeat` | 5 minutos | Revisa que el GPS siga llegando |
| `gap-backfill` | 1 vez por hora | Rellena huecos de GPS |

**Variable de entorno / `.env`**
Un papelito con datos secretos (contraseñas, direcciones) que el código lee pero que **no vive dentro del código**. Así la contraseña no queda escrita en el repo.

**`DATABASE_URL`**
La dirección + contraseña de la base de datos. `DATABASE_URL` apunta a la real; `DATABASE_URL_TEST` a la de práctica. Que sean distintas es el candado de las pruebas.

---

## 4. Cómo está armado el código

**Monorepo**
Un solo repositorio que guarda varias piezas en vez de tener un repo por pieza. Como un taller con cuartos, no varios talleres.

**Paquete**
Cada cuarto del taller. Los tuyos:

| Paquete | Qué guarda |
|---|---|
| `@jtel/domain` | Las definiciones y las reglas puras (fechas, deadlines, tolerancias) |
| `@jtel/verification` | Las matemáticas del match de trazos |
| `@jtel/services` | **El motor del árbitro.** Aquí vive `verification.ts` |
| `@jtel/db` | El trato con la base de datos |
| `apps/web` | Las pantallas |

**TypeScript**
El lenguaje del proyecto. Su gracia: te obliga a declarar de qué tipo es cada dato, y avisa **antes** de correr si algo no cuadra.

**Tipo (type)**
La declaración de qué forma tiene un dato. *"Esto es un hecho completo"* vs *"esto son tres campos sueltos"*. Cuando el tipo miente, el compilador deja pasar un error que después muerde.

**Función**
Un pedazo de código con nombre que hace una cosa. `archiveAndDeleteFact` = "archiva el hecho y bórralo".

**Test unitario vs. test de integración**
- **Unitario:** prueba una pieza sola, sin base de datos. Rápido.
- **De integración:** prueba contra una base de datos real (la de `test`). Lento pero honesto — es el que atrapa lo que de verdad rompe.

**`grep`**
Buscar una palabra en todos los archivos del proyecto. Cuando quieras saber si algo *de verdad* existe o no, esto es evidencia. Una lectura a ojo, no.

---

## 5. Palabras que Devin usa seguido

| Palabra | En cristiano |
|---|---|
| **Compila / typecheck** | El código no tiene errores de forma. No significa que funcione bien |
| **Build** | Empaquetar el código para que pueda correr |
| **Refactor** | Reacomodar código sin cambiar lo que hace |
| **Hardcodear** | Escribir un valor fijo dentro del código en vez de leerlo de la configuración. **Prohibido en tolerancias y nombres de cliente** |
| **Caso borde (edge case)** | La situación rara que casi nunca pasa pero rompe todo cuando pasa |
| **Race / carrera** | Dos cosas ocurriendo al mismo tiempo que se pisan |
| **Silencioso** | Falla sin avisar. Lo peor que puede pasarle a un sistema |
| **Guarda** | Un candado en el código: "esto se niega a correr si X" |
| **Pre-existente** | Ya estaba roto antes de este cambio |
| **Snapshot** | Una foto congelada del estado de algo |
| **Cascade** | Al borrar algo, se borra automáticamente todo lo que colgaba de ello |

---

## 6. Tu vocabulario — el del código

Lo mismo dicho de dos formas. La columna izquierda es la tuya; la derecha es lo que vas a ver en un diff.

| Tú dices | En el código |
|---|---|
| El hecho / el resultado / el veredicto | `compliance_facts` |
| El libro de actas (versiones anteriores) | `compliance_fact_history` |
| La foto del hecho archivado | `fact_snapshot` |
| El servicio esperado de una fecha | `service_occurrences` |
| El perfil (contrato ya concreto) | `service_profiles` |
| El contrato | `service_contracts` |
| El viaje (la ejecución) | `trips` |
| Los puntos de GPS de ese viaje | `evidence_points` |
| Tu copia propia del GPS (el archivador) | `telemetry_points` |
| La bitácora / el razonamiento interno | `ledger_entries` |
| Las geocercas | `geofences` |
| Cumplido / no cumplido / pendiente | `status` |
| Tarde, temprano, a tiempo | `timing` |
| Re-juicio deliberado | `force` |
| Reintento automático de un pendiente | `retry` |
| Quién pidió el re-juicio | `actorKind` / `actorId` |
| El sello | `materializedAt` / `replacedAt` |

---

## 7. Cómo leer un "Files changed" sin equivocarte

Esto ya nos costó un error, así que vale la pena tenerlo escrito.

**En GitHub, en pantalla:** las líneas que se **agregaron** salen en verde con `+`. Las que se **borraron**, en rojo con `-`.

**Cuando copias y pegas ese texto:** los colores y los signos **se pierden**. Lo viejo y lo nuevo quedan revueltos, uno junto al otro, sin distinguirse. Por eso un pegado puede hacer parecer que algo sigue ahí cuando ya se borró.

**Qué hacer:**
- Para decidir si mergeas: **mira la pantalla de GitHub**, no un pegado
- Para confirmar si algo existe o no en el proyecto: **pide un `grep` y su salida.** Eso sí es prueba

**Lo mínimo que revisas antes de mergear:**
1. ¿Los archivos que aparecen son los que esperabas? ¿Ni de más ni de menos?
2. ¿El check está en verde?
3. ¿Hay comentarios del bot revisor sin contestar?

---

## 8. Las tres preguntas que siempre puedes hacer

No necesitas entender el código para hacer estas, y cortan casi cualquier cosa:

**1. "¿Cómo lo verificaste?"**
Separa lo que alguien *cree* de lo que *comprobó*. Si la respuesta es "lo revisé", no es verificación. Si es "corrí esto y salió esto", sí.

**2. "¿Qué pasa si esto falla a media noche y nadie lo ve?"**
Descubre las fallas silenciosas. La peor no es la que truena — es la que se calla.

**3. "¿Esto se puede deshacer?"**
Si sí, arriésgate y aprende. Si no, párale y piénsalo dos veces. **Lo que borra datos casi nunca se puede deshacer.**

---

*Este documento se actualiza cuando aparezca una palabra nueva que valga la pena. No pretende ser completo — pretende ser suficiente.*
