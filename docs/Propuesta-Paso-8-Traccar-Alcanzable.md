# Propuesta — el paso 8: que el repo alcance a Traccar

**Qué decide.** Cómo llega nuestro código, que corre en Vercel, hasta el
servidor de Traccar, **sin exponer el panel de administración**.

**Estado: PROPUESTA. Nada construido, y el punto de parada es antes de
construir.** Escrita el 11 de septiembre de 2026. Hay tres decisiones abajo que
no tomé yo.

Ver [`Procedimiento-Traccar-Servidor.md`](Procedimiento-Traccar-Servidor.md), que
deja el 8082 en loopback a propósito, y [`Ficha-Compas.md`](Ficha-Compas.md).

---

## El problema, en una frase

El runbook deja el panel en `127.0.0.1` porque Traccar nace con `admin/admin`.
Pero **nuestro proveedor llama desde fuera**, desde Vercel, y por HTTPS. Con el
8082 en loopback no lo alcanza.

La tentación obvia es abrir el 8082. Eso expone el panel, que es exactamente lo
que el paso 5 evitó.

---

## La salida, y es más limpia de lo que parece

**El repo no necesita el panel. Necesita tres rutas.**

Eso no es una suposición: es lo que el proveedor llama, y está en
`packages/gps-traccar/src/index.ts`.

| Ruta | Quién la usa |
|---|---|
| `GET /api/session` | `login()` — comprobar la credencial |
| `GET /api/devices` | `getDevices()` y el cruce `deviceId` → IMEI |
| `GET /api/positions` | `getLastLocations()` y `getHistoryLocations()` |

Traccar sirve el panel y la API **en el mismo puerto**: la API en `/api/*` y el
panel en `/`. Así que un proxy delante puede dejar pasar **sólo esas tres rutas**
y contestar 404 a todo lo demás.

**Lo que eso compra, y es la parte que importa:** aunque alguien se robe el
token, por esa puerta **no puede crear usuarios, ni cambiar configuración del
servidor, ni entrar al panel** — esas rutas no existen desde fuera. La superficie
pública deja de ser «Traccar» y pasa a ser «tres lecturas».

Es la misma regla del endpoint público del pasajero: *lo que no debe verse, no se
envía.* Aquí, lo que no debe alcanzarse, no se enruta.

---

## La forma propuesta

```
 Vercel  ──HTTPS 443──>  [ Caddy en la misma máquina ]
                              │  sólo /api/session, /api/devices, /api/positions
                              │  todo lo demás → 404
                              ▼
                         127.0.0.1:8082  (Traccar)

 Asav ──SSH túnel──> 127.0.0.1:8082   ← el panel sigue entrando sólo por aquí

 FTC927 ──TCP 5027──> Traccar          ← sin cambios
```

**Por qué Caddy y no nginx.** Saca y renueva el certificado de Let's Encrypt
solo, sin `certbot` ni cron ni un segundo archivo que se desincroniza. La
configuración cabe en diez líneas, y la mitad de los incidentes de TLS son
renovaciones que nadie vigiló.

**Qué cambia en el cortafuegos:** se abre el **443**, y el **80** sólo porque
Let's Encrypt lo usa para validar y Caddy redirige. El **8082 sigue en
loopback** y el **5027 sigue igual**.

---

## Las tres decisiones que no tomé

### 1 · El nombre

Propongo **`compas.j-telemetry.com`**, un registro `A` hacia la IP de la
máquina.

**Por qué ese dominio y no `juarezbus.digital`:** los nameservers de
`juarezbus.digital` apuntan a Unstoppable Domains y hoy no resuelven a nada.
Colgar de ahí la puerta por la que entra toda la evidencia sería atar un
cimiento a lo único del proyecto que sabemos que no funciona.

**Y por qué un subdominio de infraestructura y no algo con cara de producto:**
esto no es una superficie que nadie vaya a visitar. Un nombre que suene a app
invita a que alguien lo abra.

⚠ **Un registro `A` publica la IP de la máquina.** Es inevitable con esta
forma, y es lo normal. Quien quiera buscarla la encuentra igual escaneando el
5027. La defensa no es esconder la IP: es que sólo haya tres rutas y un puerto
de equipos.

**Lo que necesito de ti:** el registro. `compas` → `A` → la IP. Y confírmame que
el DNS de `j-telemetry.com` lo administras tú y no rompe nada de las apps — un
subdominio nuevo no debería tocarlas, pero no lo verifiqué.

### 2 · Caddy en la máquina, o túnel de Cloudflare

| | Caddy en la máquina **(propongo ésta)** | Túnel de Cloudflare |
|---|---|---|
| Puertos abiertos | 80 y 443 | **ninguno** |
| Quién ve el tráfico | nadie más | **Cloudflare, en claro** |
| Dependencias nuevas | ninguna | una cuenta y un demonio |
| Si se cae | se cae tu máquina | se cae tu máquina **o ellos** |

**Propongo Caddy.** El túnel es más seguro en un solo eje —no hay puertos
abiertos— y a cambio mete a un tercero en el camino de la evidencia, que es
justo el camino que este proyecto existe para no delegar. Con el filtro de
rutas, el eje que el túnel mejora ya está casi cerrado.

Si prefieres el túnel, se cambia sin tocar nada del repo.

### 3 · ¿Un secreto compartido además del token?

Hoy la única credencial de esa puerta sería el token de Traccar. Se puede pedir
además una cabecera con un secreto que Caddy comprueba antes de enrutar: sin
ella, 404 — ni siquiera 401, que ya confirmaría que hay algo detrás.

**A favor:** un token filtrado deja de bastar. Dos secretos en dos lugares
distintos.

**En contra:** son dos secretos que rotar, y el segundo **no vive en la base**
como el token: iría en variable de ambiente de Vercel, o sea otro lugar donde se
puede olvidar. Y el proveedor del repo **hoy no manda cabeceras extra** — habría
que agregarlo, con su prueba.

**No propongo ninguna de las dos.** Con tres rutas de sólo lectura detrás, el
daño de un token filtrado es que alguien lea posiciones de camiones. Real, pero
no catastrófico. **Tú decides si eso amerita el segundo secreto**, y si dices
que sí lo construyo con su prueba.

---

## ⚠ Un hallazgo aparte, que no es del paso 8 y hay que decirlo

**El puerto 5027 es TCP en claro.** Lo que los FTC927 mandan —IMEI, posición,
hora— **viaja sin cifrar** entre el equipo y el servidor. No es un defecto de
este plan: es cómo hablan los equipos por omisión, y era igual con Umbrella.

Lo digo porque el paso 8 va a poner TLS en la puerta de la API, y es fácil
quedarse con la idea de que entonces todo el camino va cifrado. **No va.** La
mitad que viene de la calle, no.

Traccar admite TLS en puertos de equipos, y los Teltonika lo soportan según su
modelo y firmware. **No lo verifiqué para el FTC927 y no lo voy a afirmar.**
Queda anotado como pregunta abierta, no como tarea: cifrar ahí cuesta
configuración por equipo, y con ochenta por delante es una decisión de las
grandes.

---

## Lo que NO cambia en el repo

**Nada.** El proveedor ya está escrito y probado, y habla HTTPS contra el
`baseUrl` que le den. Encender esto es:

1. Guardar `https://compas.j-telemetry.com` como `gps_base_url` del carrier.
2. Guardar el token como su credencial.
3. Mover `gps_provider` a `traccar`.

Sin desplegar, sin migración, sin PR.

---

## El orden, cuando lo apruebes

1. Tú pones el registro `A`.
2. Yo compruebo que resuelve a la IP, **antes de pedir certificado** — Let's
   Encrypt tiene límite de intentos fallidos y quemarlo cuesta una hora de
   espera.
3. Instalo Caddy con el filtro de rutas.
4. Abro 80 y 443. Compruebo que el 8082 **sigue sin contestar** desde fuera.
5. Compruebo las tres rutas desde fuera, y que una cuarta —`/api/users`, por
   ejemplo— **contesta 404**. Ésa es la prueba de que el filtro filtra.
6. Compruebo que la raíz `/` **no sirve el panel**.

**Punto de parada aquí.** No construyo nada hasta que decidas el nombre, Caddy
contra túnel, y el secreto compartido.
