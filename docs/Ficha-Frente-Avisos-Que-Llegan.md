# Frente — que los avisos que importan lleguen a alguien

**Qué es.** Que un aviso de plataforma llegue a un humano, se pueda comprobar que
llegó, y que las cicatrices viejas dejen de tapar a las nuevas.

**Por qué existe, con su fecha.** El 5 de septiembre de 2026 Umbrella cortó la
transmisión. El sistema lo detectó **a los treinta y cuatro minutos**, escribió su
incidente, y después **nadie del otro lado durante cinco días**. Lo que falló ese
día no fue el proveedor: fue el tablero.

**Decisión de Asav, 10 de septiembre de 2026: entra como frente propio.**

---

## Lo medido, con su fecha

> **Corte de medición: 10 de septiembre de 2026, 19:10Z**, sobre `ingest_alerts`
> en producción, con la conexión de solo lectura. Ninguna escritura.

| Qué | Medido |
|---|---|
| Filas en `ingest_alerts` | **816**, desde el 14 de julio de 2026 |
| Sin resolver | **798 de 816** — el 97.8% |
| `archive_error` | **796**, y **ninguna resuelta jamás** |
| Ritmo de `archive_error` desde el corte | **144 al día**, una cada diez minutos |
| El incidente del corte (`watermark_lag`) | abierto **2026-09-05T15:55:40Z** · **sigue abierto** |
| Los tres `watermark_lag` anteriores | abiertos y **resueltos en horas** (12 ago, 26 ago, 31 ago) |
| `heartbeat_stale` | 16, **15 resueltas** — el mecanismo de cierre sí funciona |

---

## Las dos mitades, y son problemas distintos

### 1 · Un incidente abierto cinco días se ve igual que uno abierto cinco minutos

**El mecanismo funcionó.** `watermark_lag` se abrió a los 34.2 minutos del corte,
con su umbral al lado —«Archivador callado 34.2 min (umbral 30 min)»— y su correo
salió por el canal, que está bien construido: se resuelve antes de tocar la base,
la fila se escribe sólo si el correo salió, y un fallo del canal contesta 503 para
que Vercel lo marque.

Lo que no existe es **el segundo aviso**. Un incidente abierto no vuelve a
notificar nunca, así que el sistema dijo su frase una vez, el 5 de septiembre a
las 15:55, y se calló. Los tres incidentes anteriores se cerraron solos en horas,
así que la forma «se abre y se cierra» nunca se había puesto a prueba con algo que
durara.

**La falla no es de detección y conviene no confundirlo**, porque el arreglo
cambia: detectar más seguido no sirve de nada. Lo que falta es que **la edad de un
incidente abierto sea ella misma un hecho que escale.**

Es la misma forma del hallazgo del #372, con otro sujeto: ahí una vuelta de 8 h 20
min era «dos pedazos que no se pueden unir sin inventar el de en medio». Aquí un
incidente de cinco días es un estado que nadie declaró que fuera aceptable.

### 2 · Las cicatrices viejas entierran a las nuevas

`archive_error` no se resuelve nunca. No es que se resuelva tarde: **no hay ningún
camino en el código que la cierre**, mientras `heartbeat_stale` y `watermark_lag`
sí lo tienen. Así que la tabla acumula, y desde el corte acumula a **144 filas al
día**.

Contra ese fondo, el incidente que importaba —el único `watermark_lag` del corte—
es **una fila entre ciento cuarenta y cinco de ese día**. Y quien abra la pantalla
de verificación hoy ve 796 renglones idénticos que dicen lo mismo.

**Un tablero donde el 97.8% de los renglones está sin resolver no es un tablero:
es un registro.** La diferencia práctica es que a un registro nadie le pregunta si
hay algo nuevo.

Y hay un agravante que se ve al lado del #361: ese PR arregló que el mensaje de
`archive_error` conservara su causa, y funcionó — hoy dice
`No se obtuvo token de Umbrella GPS: User name or password error`, que es la frase
exacta. **La causa se salvó y aun así nadie la leyó.** Un mensaje bien redactado en
un renglón que nadie abre no informa a nadie.

---

## Lo que este frente NO es

**No es construir el canal.** Ya existe, está bien hecho y pasó por el skill de
interfaz. Lo que falta no es por dónde sale un aviso.

**No es bajar el umbral ni avisar más seguido.** El aviso salió a tiempo. Avisar
más seguido con la misma forma produce más filas en la misma tabla que nadie abre,
que es exactamente la mitad 2 del problema.

**No es un tablero nuevo.** Antes de dibujar otra pantalla hay que arreglar que la
que existe se pueda leer.

---

## Las preguntas que este frente tiene que contestar, y ninguna está decidida

1. **¿Cuándo un incidente abierto vuelve a hablar?** Y si escala de destinatario
   con la edad, o sólo repite. Hay que escoger un ritmo que no se vuelva ruido:
   repetir cada diez minutos convierte el incidente en la cicatriz siguiente.
2. **¿Quién cierra `archive_error`, y con qué regla?** Que la ingesta vuelva no es
   lo mismo que que este error concreto deje de ocurrir.
3. **¿Se puede comprobar que un aviso llegó a un humano?** Hoy no hay dónde
   mirarlo: `ingest_alerts` registra que se abrió el incidente, no que alguien lo
   recibió ni que alguien lo vio. **Esa afirmación es hoy incomprobable**, y
   mientras lo sea, «las alertas funcionan» es una suposición. Ver
   `canal-avisos-solo-produccion`: las llaves de Resend no están fuera de
   producción, así que esto tampoco se cierra desde una sesión local.
4. **¿Qué hace la pantalla de verificación con 796 renglones iguales?** Agrupar por
   causa, o esconder lo resuelto, o las dos. Es decisión de interfaz y pasa por el
   skill.

---

## Dónde toca

`apps/web/src/app/api/cron/alertas/route.ts` (la entrega) ·
`apps/web/src/lib/alertas/decision.ts` (las clases y sus umbrales) ·
`apps/web/src/lib/alertas/datos.ts` (`aplicarIncidentes` y `resolveOpen`, que es
donde vive la asimetría entre las clases que cierran y la que no) ·
`apps/web/src/app/jstaff/verificacion/page.tsx` (los 796 renglones) ·
`packages/services/src/archiver.ts` (quien escribe `archive_error`).

**No pide migración**: `ingest_alerts` ya tiene `resolved_at`, `severity` y
`metadata`. Lo que falta no son columnas, es qué se hace con ellas.

---

## La lección, que es más grande que este frente

> **Un instrumento que mide bien y no le llega a nadie mide para nadie.**

Todo el trabajo del Tramo JB fue sobre no afirmar de más. Este frente es el mismo
cuidado apuntado al otro lado: **el sistema supo la verdad, la escribió correcta y
a tiempo, y la verdad se quedó dentro.** No hubo ninguna afirmación falsa. Hubo
cinco días de una afirmación verdadera que nadie recibió, y el costo fue el mismo
que si hubiera mentido.

Ver [`Ficha-Escalera-Estados-Publico.md`](Ficha-Escalera-Estados-Publico.md) para la
otra mitad de esta idea: el #378 dejó escrito que **callarse lo que el sistema sí
midió también le miente a quien espera**. Aquí el receptor somos nosotros.
