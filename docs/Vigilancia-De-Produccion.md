# Quién vigila producción

**Qué es esta hoja.** La lista de lo que avisa cuando algo se cae, **qué mira cada
uno y qué no mira ninguno**. Existe porque el vigilante más nuevo vive **fuera del
repo** —en UptimeRobot— y lo que no está escrito aquí se da por inexistente: alguien
lo apaga sin saber que existía, o lo construye otra vez.

**Última actualización: 25 de septiembre de 2026**, al dar de alta el vigilante
externo.

---

## Los tres, y por qué son tres

La regla que los ordena es la **Ley 4** (`DESPUES.md`, «El vigilante vive dentro de
lo vigilado»): *un vigilante no puede compartir ningún componente con lo vigilado.*
Se aprendió el **28 de julio de 2026**, cuando una rotación de contraseña dejó los
crones sin base durante **13 horas** y nadie se enteró, porque el que vigilaba era
también un cron de Vercel y se cayó con todo lo demás.

| | Dónde vive | Cada cuánto | Qué mira | Cómo avisa |
|---|---|---|---|---|
| **UptimeRobot** | Fuera de todo lo nuestro | **5 min** | Que **`https://ontoy.app`** y **`https://www.j-telemetry.com`** contesten | **Correo y teléfono de ASAV** — el correo, visto llegar el 25-sep (abajo) |
| **Vigilante de salud** | GitHub Actions | 15 min | `/api/salud`: GPS con menos de 20 min de atraso, archivador con menos de 30 | Issue en el repo |
| **Heartbeat de ingesta** | Cron de Vercel | — | Que sigan entrando posiciones | Escribe `ingest_alerts` en la base |

**El de abajo es el que la Ley 4 prohíbe usar solo**: vive dentro de lo que vigila y
escribe su alerta en la misma base que puede estar caída. Sigue sirviendo como dato,
no como aviso.

**Y el de arriba cierra el agujero del canal.** `DESPUES.md` lo decía así: *«si
Vercel se cae, el correo tampoco sale»* — porque nuestro correo sale de producción
(ver `project_canal_avisos_solo_produccion`). El aviso de UptimeRobot **no pasa por
nada nuestro**: sale de ellos al teléfono de ASAV. Es el único de los tres que puede
gritar cuando todo lo demás está apagado.

---

## Qué NO cubre, y es la mitad que importa

**Un 200 no dice que la app sirva.** Es la trampa que este repo ya pagó, escrita en
`Trampas-De-Medicion.md`: `/api/salud` **devolvió 200 durante toda una caída de la
cara cliente**, porque leía con listas explícitas de columnas y las pantallas piden
la tabla entera. UptimeRobot mira menos todavía — que la dirección conteste — así que
**verde en UptimeRobot no significa «todo bien»**: significa «el servidor contestó».

Lo que ninguno de los tres vigila hoy, dicho con nombre para que no se suponga:

- **Que las pantallas dibujen.** Nadie abre una ruta y comprueba que enseñe camiones.
- **Las direcciones que no están en la tabla**: `juarezbus.digital` (que redirige),
  `ontoy.app/rutas`, `/validador`, ni ninguna API. Si el redirector muriera, los tres
  siguen en verde.
- **Que el dato sea cierto.** Ninguno compara un veredicto contra la realidad; para
  eso está el árbitro, que es otra cosa.
- **Al propio UptimeRobot.** Si su cuenta caduca o alguien borra el monitor, **el
  silencio vuelve a ser indistinguible de la salud** — que es exactamente la falla
  del 28 de julio, una capa más arriba. Aplazado a propósito (`DESPUES.md`,
  «vigilancia del propio vigilante»), y por eso está escrito aquí.
- **`/api/salud` dice «sano» con servicios sin veredicto.** Sigue abierto desde el
  PR 3 del OOM; el 200 de ese endpoint no es una garantía tan ancha como suena.

## El aviso se vio llegar — 25 de septiembre de 2026

**Un instrumento no está probado hasta que se ve llegar su aviso a un humano.** Es la
lección que `salud.yml` aprendió dos veces —la segunda estuvo **nueve días muda**, con
117 corridas y cero avisos— y por eso ese workflow tiene `simular_codigo`: se provoca
un aviso a propósito y se mira si llega.

**Con UptimeRobot ya se hizo, y las dos mitades funcionan.** ASAV apuntó el monitor a
una dirección que da 404, esperó un ciclo y **llegó «Monitor is DOWN: ontoy.app» a su
correo**; después devolvió la URL buena. O sea: la caída **se detecta** y el aviso
**sale**, que son las dos cosas distintas que casi nunca se prueban juntas.

**Lo que se vio llegar fue el correo.** Del aviso al **teléfono** no hay constancia
todavía, y se escribe así en vez de darlo por bueno: el canal del teléfono es
precisamente el que tiene que funcionar cuando el correo no se puede abrir.

**Cómo se repite** (cuando cambie el monitor, el contacto o la cuenta): apuntar el
monitor un minuto a una dirección que conteste 404 —`https://ontoy.app/prueba-de-aviso-no-existe`—,
esperar un ciclo de 5 minutos, ver entrar el aviso, y devolver la URL. El «up» de la
vuelta también cuenta: comprueba que el aviso de recuperación existe.

**Pausar el monitor NO sirve para esto, y era lo que decía este renglón**: pausar sólo
deja de medir, no manda «down». Probándolo así no llega nada, y eso se lee como que el
aviso está roto cuando puede estar perfecto — un falso negativo en la única prueba que
existe para saber si el vigilante grita. **Y el botón de notificación de prueba del
contacto tampoco basta:** comprueba que el correo y el teléfono reciben, no que la
caída se detecte. Detectar y avisar son dos cosas, y ésta es la lección de `salud.yml`
escrita una vez más.
