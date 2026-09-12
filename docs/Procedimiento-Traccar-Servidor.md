# Procedimiento — levantar el servidor de Traccar (Compás)

**Qué es.** Los pasos exactos para poner en pie el servidor contra el que van a
hablar los equipos Teltonika. Escrito el **11 de septiembre de 2026**, antes de
que la máquina exista, para que el día que exista no se improvise nada.

**Estado: CORRIDO el 11 de septiembre de 2026**, contra `68.183.113.44`
(DigitalOcean, Ubuntu 24.04.4, 1 vCPU, 961 MB). Los pasos 0 a 6 pasaron; el 7
está pendiente de que haya equipos.

Se escribió antes de que la máquina existiera y decía «cuando se corra, se anota
aquí mismo qué salió distinto». Eso es lo que trae ahora la sección **«Lo que
salió distinto»**, al final. **Un renglón de ahí corrige una afirmación falsa de
este documento**, y está marcado.

**De dónde salen los valores.** Puerto, imagen, formato del archivo de
configuración y entradas de PostgreSQL salen de la documentación y del
repositorio de Traccar, no de memoria. Lo que **no** está verificado va marcado
como tal.

Ver [`Ficha-Compas.md`](Ficha-Compas.md) para el contexto y la regla del
firmware.

---

## Antes de empezar

**La llave SSH ya está generada**, el 11 de septiembre de 2026, en la máquina de
Asav:

```
~/.ssh/compas_traccar        ← privada, NO SALE DE AHÍ
~/.ssh/compas_traccar.pub    ← pública, la que se pega al crear la máquina
```

Huella: `SHA256:BQqm9dOHUSD8/lAu4/S+GP6mfaNbrBLTGF7Cd4x00YM`

⚠ **La privada no lleva frase de paso.** Es lo habitual para una llave de
servidor que se va a usar desde guiones, y el precio va dicho: quien tenga el
archivo entra. Si se prefiere lo contrario, se le pone antes de usarla:

```bash
ssh-keygen -p -f ~/.ssh/compas_traccar
```

**Lo que hay que tener a la mano antes del paso 1:**

| Qué | De dónde |
|---|---|
| IP o nombre de la máquina | del proveedor, al crearla |
| Usuario de entrada | normalmente `root` o `ubuntu` |
| Una contraseña larga para la base | se inventa aquí y se guarda en el gestor, **no en este archivo** |

---

## Paso 0 · Entrar, y confirmar dónde estamos

```bash
ssh -i ~/.ssh/compas_traccar <usuario>@<IP>
```

Ya dentro:

```bash
. /etc/os-release && echo "$PRETTY_NAME"
uname -m
free -m | awk '/Mem:/ {print "RAM total: " $2 " MB"}'
df -h / | awk 'NR==2 {print "disco libre: " $4}'
```

**Anota las cuatro salidas.** Sistema, arquitectura, memoria y disco son lo
primero que alguien va a preguntar el día que esto se ponga lento, y después ya
no se sabe cómo estaba al nacer.

⚠ **No medido, y no lo voy a afirmar:** cuánta memoria pide Traccar con 82
unidades reportando cada minuto. Hay quien lo corre en máquinas muy chicas, pero
**no lo he medido y no sé si aplica a este caso.** Si la máquina es pequeña,
esto se sabrá en el paso 7 mirando el consumo, no antes.

---

## Paso 1 · Lo mínimo del sistema

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
```

Docker, por el camino oficial:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo docker --version
sudo docker compose version
```

**Punto de parada.** Si `docker compose version` falla, para aquí. Todo lo que
sigue depende de él y seguir con `docker-compose` viejo produce diferencias que
se pagan después.

---

## Paso 2 · La carpeta y el archivo de configuración

```bash
sudo mkdir -p /opt/traccar/{conf,logs,data}
```

El archivo. **Esta estructura es la del `setup/traccar.xml` del repositorio de
Traccar**, con la base cambiada de H2 a PostgreSQL según su propia
documentación:

```bash
sudo tee /opt/traccar/conf/traccar.xml > /dev/null <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE properties SYSTEM 'http://java.sun.com/dtd/properties.dtd'>
<properties>

    <entry key='database.driver'>org.postgresql.Driver</entry>
    <entry key='database.url'>jdbc:postgresql://postgres/traccar</entry>
    <entry key='database.user'>traccar</entry>
    <entry key='database.password'>PON_AQUI_LA_CONTRASENA</entry>

</properties>
XML
```

Después, con un editor, se reemplaza `PON_AQUI_LA_CONTRASENA` por la de verdad:

```bash
sudo nano /opt/traccar/conf/traccar.xml
sudo chmod 600 /opt/traccar/conf/traccar.xml
```

⚠ **La contraseña queda en claro en ese archivo.** Es como Traccar espera
recibirla y no hay forma de evitarlo sin complicar el arranque. Por eso el
`chmod 600`, y por eso la contraseña **no se reusa** de ningún otro sitio.

**Por qué la base se llama `postgres` en la URL y no `localhost`:** es el nombre
del servicio dentro de la red de Docker Compose del paso siguiente. Desde el
contenedor de Traccar, `localhost` es él mismo.

---

## Paso 3 · La base propia

**Separada de la nuestra, y esto no se negocia.** La base de Traccar es del
proveedor de telemetría: crece con cada punto, la puede vaciar cualquiera
reinstalando, y no tiene nada que hacer cerca de los hechos sellados. La base de
J-Tel sigue en Neon, y el puente del repo lee de Traccar **por su API**, nunca
por su base.

```bash
sudo tee /opt/traccar/docker-compose.yml > /dev/null <<'YML'
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: traccar
      POSTGRES_USER: traccar
      POSTGRES_PASSWORD: PON_AQUI_LA_MISMA_CONTRASENA
    volumes:
      - /opt/traccar/pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U traccar -d traccar"]
      interval: 5s
      timeout: 5s
      retries: 10

  traccar:
    image: traccar/traccar:latest
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      # El panel y la API. A LOOPBACK a propósito — ver el paso 5.
      - "127.0.0.1:8082:8082"
      # El puerto de los Teltonika, y el ÚNICO abierto al mundo.
      - "5027:5027"
    volumes:
      - /opt/traccar/logs:/opt/traccar/logs:rw
      - /opt/traccar/data:/opt/traccar/data:rw
      - /opt/traccar/conf/traccar.xml:/opt/traccar/conf/traccar.xml:ro
YML
```

Misma contraseña que en `traccar.xml`, y el mismo cuidado:

```bash
sudo nano /opt/traccar/docker-compose.yml
sudo chmod 600 /opt/traccar/docker-compose.yml
```

**Por qué no se publica el rango 5000-5300** que trae el ejemplo oficial: su
propia documentación avisa de que el rango completo puede causar problemas de
memoria. Sólo hace falta el **5027**, que es el de `teltonika`, y abrir 300
puertos que nadie usa es superficie regalada.

Arrancar:

```bash
cd /opt/traccar
sudo docker compose up -d
sudo docker compose ps
```

**Punto de parada.** Los dos servicios tienen que decir `running`, y `postgres`
además `healthy`. Si Traccar reinicia en bucle, el log lo dice:

```bash
sudo docker compose logs traccar --tail 50
```

El fallo más probable aquí es la contraseña distinta entre los dos archivos.

---

## Paso 4 · Que las tablas de Traccar existan

Traccar crea su propio esquema al arrancar. Se comprueba, no se supone:

```bash
sudo docker compose exec postgres psql -U traccar -d traccar -c "\dt" | head -20
```

**Lo que debes ver:** una lista con `tc_devices`, `tc_positions`, `tc_users` y
varias más. Si sale vacía, Traccar no llegó a conectar y el log del paso 3 dice
por qué.

---

## Paso 5 · El cortafuegos

```bash
sudo apt-get install -y ufw
sudo ufw allow 22/tcp comment 'ssh'
sudo ufw allow 5027/tcp comment 'teltonika - equipos FTC927'
sudo ufw --force enable
sudo ufw status verbose
```

**Lo que debes ver:** `22/tcp ALLOW` y `5027/tcp ALLOW`, y nada más abierto.

⚠ **El 8082 NO se abre, y es a propósito. Pero la razón NO es la que decía este
documento.**

**Lo que decía, y era falso:** «Traccar nace con el usuario `admin` y contraseña
`admin`». **En la 6.15 no hay ningún usuario.** Comprobado el 11 de septiembre
de 2026 contra el servidor recién levantado: `select * from tc_users` devolvió
**cero filas**, y entrar con `admin`/`admin` da 401.

**Lo que hay en su lugar es peor mientras dura, y por eso el puerto va escondido
DESDE EL ARRANQUE y no «en cuanto se pueda»:**

> Entre el momento en que el contenedor arranca y el momento en que alguien crea
> el primer usuario, **el registro está ABIERTO y sin autenticar**. Un `POST` a
> `/api/users` sin credencial crea una cuenta, y **la primera que se cree queda
> como ADMINISTRADORA**.

O sea la ventana no es «alguien adivina una contraseña de fábrica»: es **quien
llegue primero se queda con el servidor**, sin adivinar nada. Y dura desde el
`docker compose up` hasta que un humano entre por el túnel. Aquí fueron unos
minutos; podrían ser días si la máquina se levanta un viernes.

**Que el puerto esté en `127.0.0.1` desde el paso 3 es lo único que cierra esa
ventana.** No es una precaución que se pueda posponer: publicar el 8082 «un
ratito para configurarlo» es exactamente el agujero.

**Se cierra sola con el primer usuario, y se comprueba.** Después de crearlo, un
segundo `POST` anónimo devuelve `400 · Registration disabled`. Esa comprobación
está en el paso 5b y **no se salta**: es la única forma de saber que la ventana
se cerró.

Para entrar al panel, desde tu portátil, un túnel:

```bash
ssh -i ~/.ssh/compas_traccar -L 8082:127.0.0.1:8082 <usuario>@<IP>
```

Y con eso abierto, en el navegador: `http://localhost:8082`.

---

## Paso 5b · El primer usuario, y comprobar que la puerta se cerró

**Va inmediatamente después del cortafuegos, y antes de cualquier otra cosa.**
Mientras no exista, el servidor es de quien lo pida primero.

La contraseña se genera **en la máquina** y no se teclea ni se pega desde
ningún lado:

```bash
umask 077
head -c 18 /dev/urandom | base64 | tr -d "/+=" | head -c 24 > /opt/traccar/.adminpass

curl -s -X POST http://127.0.0.1:8082/api/users \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Asav\",\"email\":\"admin@compas.local\",\"password\":\"$(cat /opt/traccar/.adminpass)\"}"
```

**Lo que debes ver:** un JSON con `"administrator": true`.

**Y la comprobación que cierra el paso** — sin ella no sabes si la ventana sigue
abierta:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8082/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"prueba","email":"prueba@x.com","password":"loquesea123"}'
```

**Tiene que dar `400`**, con `Registration disabled` en el cuerpo. Si da `200`,
**para**: el registro sigue abierto, acabas de crear una cuenta de más, y hay
que borrarla antes de seguir.

**El usuario del repo va aparte**, creado ya autenticado, para que se pueda
revocar sin perder el acceso de administrador:

```bash
umask 077
head -c 18 /dev/urandom | base64 | tr -d "/+=" | head -c 24 > /opt/traccar/.repopass

curl -s -u "admin@compas.local:$(cat /opt/traccar/.adminpass)" \
  -X POST http://127.0.0.1:8082/api/users -H "Content-Type: application/json" \
  -d "{\"name\":\"compas-repo\",\"email\":\"repo@compas.local\",\"password\":\"$(cat /opt/traccar/.repopass)\",\"administrator\":true}"
```

⚠ **Por qué el usuario del repo es administrador, que es una decisión y no un
descuido.** Un usuario normal de Traccar **sólo ve los aparatos que alguien le
concedió uno por uno**, así que cada alta de mañana tendría un paso más — y un
paso que, olvidado, no da error: el aparato reporta y el repo no lo ve.
Administrador evita esa clase entera de fallo silencioso, y la puerta pública
queda acotada por el filtro de rutas del paso 8, no por los permisos de este
usuario.

---

## Paso 6 · Que de verdad está oyendo

Tres comprobaciones, y hacen falta las tres porque contestan cosas distintas.

**Desde el servidor** — que el proceso escucha:

```bash
sudo ss -ltnp | grep -E '5027|8082'
```

Debe salir el 5027 en `0.0.0.0` y el 8082 en `127.0.0.1`. Si el 8082 aparece en
`0.0.0.0`, para: el paso 3 no se aplicó como está escrito.

**Desde tu portátil** — que el puerto llega desde fuera:

```bash
nc -vz <IP> 5027
```

Debe decir `succeeded`. Y la contraria, que es la que prueba el cortafuegos:

```bash
nc -vz <IP> 8082
```

Debe **fallar**. Un `succeeded` aquí es el panel expuesto, y hay que arreglarlo
antes de seguir.

**Que el protocolo responde, no sólo el puerto.** Que un puerto acepte conexión
no dice que Traccar esté detrás. El decodificador de `teltonika` espera primero
el IMEI y contesta un byte:

```bash
sudo docker compose logs traccar --tail 20 | grep -i teltonika
```

⚠ **No verificado por mí:** la forma exacta del saludo del protocolo para
provocarlo a mano con `nc`. **No la inventé y no la voy a poner aquí.** La
comprobación que vale es la del paso 7 y es con el equipo de verdad.

---

## Paso 7 · El primer equipo, que es la compuerta

**Aquí manda la regla de la ficha de Compás, y va repetida porque es donde se
rompe:**

> **Se prueba UN equipo antes de configurar ochenta. Primero con el firmware de
> fábrica, y sólo si falla se actualiza.**

Se configura un solo FTC927 apuntando a `<IP>:5027`, TCP, protocolo
`teltonika`.

Lo que hay que ver, **en este orden y sin saltarse ninguno**:

| # | Qué | Cómo se ve |
|---|---|---|
| 1 | El equipo conecta | aparece en el panel, en el catálogo |
| 2 | **Llega una posición válida** | `tc_positions` crece, con coordenadas que corresponden a dónde está |
| 3 | Se mueve y sigue llegando | posiciones nuevas con su hora avanzando |

```bash
sudo docker compose exec postgres psql -U traccar -d traccar -c \
  "SELECT id, deviceid, fixtime, latitude, longitude, valid FROM tc_positions ORDER BY fixtime DESC LIMIT 5;"
```

⚠ **El punto 1 NO cuenta como probado.** Un equipo que conecta y no manda
posición es exactamente el modo de falla del que hay reporte con el firmware
nuevo. Aparecer en el catálogo es el síntoma que hace creer que funciona.

**Punto de parada del sprint.** Si el punto 2 no ocurre con el firmware de
fábrica, **entonces** se actualiza el firmware de ese equipo y se repite. Nunca
al revés, y nunca sobre más de un equipo.

---

## Paso 8 · Conectar el repo — FASE APARTE, no es de este documento

Hasta aquí se prueba que **equipo → Traccar** funciona. Que **Traccar → J-Tel**
funcione es otra cosa y pide algo que los pasos de arriba no dan:

**El repo llama desde Vercel, o sea desde fuera, por HTTPS.** Con el 8082 en
loopback —que es como debe estar— nuestro proveedor no lo alcanza. Eso pide un
nombre, un certificado y un proxy delante, y es su propio trabajo con sus
propias decisiones de seguridad.

Lo que ya está listo del lado del repo, y no hay que construirlo:

- `packages/gps-traccar` con los cuatro métodos, 17 pruebas en verde.
- El caso `traccar` registrado en `buildProvider`.
- Las columnas `gps_user_id` y `gps_password_encrypted`, migración `0034`,
  **aplicada en producción el 11 de septiembre de 2026**.

Encender un carrier es mover `carrier_profiles.gps_provider` a `traccar` y
guardarle su credencial. **Sin desplegar nada.**

⚠ **Y conviene decirlo aquí:** el día que eso se encienda, el proveedor
comprueba la credencial en cada corrida. Si el certificado no es válido o el
nombre no resuelve, va a fallar **ruidosa** y con su causa en `ingest_alerts` —
que es como está diseñado. No es un misterio si pasa.

> **El paso 8 ya se construyó, el 11 de septiembre de 2026.** Caddy delante, con
> `compas.j-telemetry.com` y certificado de Let's Encrypt, dejando pasar
> **`/api/devices` y `/api/positions` y nada más**. Son dos y no las tres que
> esta sección anticipaba: el **#387** dejó de usar `/api/session`, y lo que no
> se usa no se abre. Comprobado desde fuera — las dos permitidas dan 200;
> `/api/users`, `/api/server`, `/api/session`, `/api/commands` y la raíz `/` dan
> **404**; y el 8082 sigue sin contestar.

---

## Lo que salió distinto al correrlo

El 11 de septiembre de 2026, contra `68.183.113.44`. Se anota aquí porque este
documento prometía anotarlo.

### 🔴 Una afirmación falsa, corregida

**«Traccar nace con `admin`/`admin`»** — **no en la 6.15.** Nace con cero
usuarios y el registro abierto. El paso 5 trae ahora la corrección entera, con
la ventana que sí existe y por qué el puerto va escondido desde el arranque, y
el paso 5b la cierra y la comprueba.

Vale la pena decir cómo se descubrió: **no mirando el documento, sino
intentando usarlo.** El primer `curl` con `admin`/`admin` dio 401, y de ahí
salió la pregunta correcta.

### Tres desviaciones, cada una con su razón

| Qué | Por qué |
|---|---|
| **2 GB de swap**, añadidos antes del paso 1 | 961 MB sin swap, con una JVM y PostgreSQL al lado, es apretado. No es holgura de lujo: es que un pico no mate al que estaba corriendo |
| **`mem_limit` a los dos contenedores** (320 MB y 512 MB) | Sin límite, cualquiera de los dos se come la máquina y el otro muere. Con límite, el que se pasa muere solo y se reinicia |
| **El registro de Caddy a journald, no a un archivo** | El directorio propio daba `permission denied` bajo su systemd, y un registro que no se puede escribir **tumba el servicio entero al arrancar**. Journald se consulta igual |

### Lo que ya no está «no medido»

**Cuánta máquina hace falta**, con el servidor arriba y vacío:

| | Uso | Límite |
|---|---|---|
| Traccar | 190 MB | 512 MB |
| PostgreSQL | 88 MB | 320 MB |
| Sistema | 618 de 961 MB | — |
| Swap | 18 MB | 2 GB |

⚠ **Eso es CON CERO EQUIPOS.** No dice nada de lo que pasa con ochenta
reportando cada 30 segundos, y no hay que leerlo como si lo dijera. La medición
que vale sigue siendo la del paso 7 con equipos de verdad.

### La comprobación que el paso 6 dejaba abierta, ahora hecha

El documento decía que no sabía provocar el saludo del protocolo a mano y que no
lo iba a inventar. **Se resolvió:** el protocolo `teltonika` espera dos bytes de
longitud seguidos del IMEI en ASCII, y contesta un byte.

```
enviado   : 000f + "000000000000001"   (IMEI falso, desde fuera)
respuesta : 0x00                        -> el decodificador CONTESTÓ y lo rechazó
```

Un `0x00` es la mejor prueba que hay sin equipo: **el puerto no sólo acepta
conexión, hay un decodificador detrás que parsea y decide.** Un `0x01` habría
significado que el IMEI ya existía. Se comprobó después que no quedó ningún
aparato registrado.

---

## Lo que este procedimiento NO cubre

- **Respaldos de la base de Traccar.** No hay ninguno configurado por estos
  pasos. La base de J-Tel está en Neon con los suyos; ésta no. **Sigue sin
  hacerse.**
- **Qué pasa cuando entren las 80+ unidades.** Estos pasos levantan un servidor
  y prueban uno. El salto a ochenta es otra conversación, y la primera pregunta
  de esa conversación es el consumo medido en el paso 7 **con equipos**, no el
  de arriba.
- **El puerto 5027 va en claro.** Lo que mandan los equipos no viaja cifrado.
  Que el paso 8 ponga TLS en la API no cambia eso, y es fácil creer que sí.
