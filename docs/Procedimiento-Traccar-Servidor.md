# Procedimiento — levantar el servidor de Traccar (Compás)

**Qué es.** Los pasos exactos para poner en pie el servidor contra el que van a
hablar los equipos Teltonika. Escrito el **11 de septiembre de 2026**, antes de
que la máquina exista, para que el día que exista no se improvise nada.

**Estado: ESCRITO, NO CORRIDO.** Ni un solo comando de este documento se ha
ejecutado. No hay servidor todavía. Lo que sigue es un plan verificable, no un
registro de lo que pasó — y cuando se corra, se anota aquí mismo qué salió
distinto.

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

⚠ **El 8082 NO se abre, y es a propósito.** Traccar nace con el usuario
`admin` y contraseña `admin`. Un panel de administración con la credencial de
fábrica expuesto a internet se encuentra solo, y en minutos. Por eso el paso 3
lo publica en `127.0.0.1` — desde fuera de la máquina no existe.

Para entrar al panel, desde tu portátil, un túnel:

```bash
ssh -i ~/.ssh/compas_traccar -L 8082:127.0.0.1:8082 <usuario>@<IP>
```

Y con eso abierto, en el navegador: `http://localhost:8082`.

**Lo primero que se hace ahí dentro, antes que nada:** cambiar la contraseña de
`admin`. Y después crear el usuario que va a usar el repo, con su propio token.

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

⚠ **Y conviene decirlo aquí:** el día que eso se encienda, el proveedor pide
sesión contra `/api/session` en cada corrida. Si el certificado no es válido o
el nombre no resuelve, va a fallar **ruidosa** y con su causa en
`ingest_alerts` — que es como está diseñado. No es un misterio si pasa.

---

## Lo que este procedimiento NO cubre

- **Respaldos de la base de Traccar.** No hay ninguno configurado por estos
  pasos. La base de J-Tel está en Neon con los suyos; ésta no.
- **TLS y el nombre público.** Paso 8, fase aparte.
- **Cuánta máquina hace falta.** No medido. Se sabrá mirando, no suponiendo.
- **Qué pasa cuando entren las 80+ unidades.** Estos pasos levantan un servidor
  y prueban uno. El salto a ochenta es otra conversación, y la primera pregunta
  de esa conversación es el consumo medido en el paso 7.
