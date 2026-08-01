# Ficha — La cara del producto: homescreens, subdominios y coherencia

**Fecha:** 31 de julio de 2026
**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
Si algo aquí choca con ellos, ellos ganan.

---

## 1. Por qué este frente existe

Hoy la primera pantalla de J-Telemetry es **un selector de cuentas** — una
herramienta de trabajo interna que sirve para brincar entre Tecma, Juárez Bus y
J-Staff mientras se construye.

Eso está bien para construir y está mal como producto. Quien entra no ve *su*
plataforma: ve un tablero de control ajeno donde tiene que escogerse a sí mismo.

**Aclaración de encuadre, y es importante:** no hay "producto" y "demo" por
separado. Es una sola cosa, funcionando con datos reales, y lo que se construye
es lo que se enseña. Por eso este frente **no es maquillaje para presentaciones**
— es el producto tomando su forma.

---

## 2. La decisión que ordena todo: puertas, no tableros

Los homescreens de este frente son **puertas bien hechas**, no tableros con
cifras.

**Por qué.** Un tablero con números **muestra juicio**, y el árbitro todavía se
está afinando (Ola 2). Si el homescreen de una planta dice *"94% de cumplimiento
este mes"* y la semana entrante ese número cambia porque se afinó el motor, **el
producto se contradice a sí mismo delante de su cliente.**

> Un producto honesto no pinta cifras que sabe que se van a mover.

**Lo que sí lleva cada homescreen:** identidad de quién entró, y un directorio
limpio y bien diseñado a lo que ya existe y funciona.

**Lo que llega después (Ola 3, con el árbitro afinado):** los números vivos, el
resumen del día, las alertas recientes. **La estructura queda; el contenido llega
cuando sea confiable.** No hay que rehacer nada — se llenan las mismas puertas.

---

## 3. Los tres homescreens

Cada cara llega **a su casa**, no al selector. El selector actual se conserva
como herramienta interna (ver §6).

### 3.1 Cliente

**Quién llega:** admin corporativo o usuario de planta/campus.

**Lo primero que tiene que quedar claro:** *dónde estoy parado.* El nombre de la
cuenta y, cuando el alcance es de planta o campus, **cuál** — porque en Tecma la
diferencia entre Planta 47 y Campus Santos Dumont es la diferencia entre dos
operaciones distintas (ver `Ficha-Diseno-Permisos.md` §2.2).

**Puertas a lo que ya existe y funciona:**
- Cumplimiento
- Cierre del turno
- Pendiente por evidencia
- Monitoreo
- Configuración del contrato (oficina)
- Historia de la política

**Regla de alcance:** si el usuario tiene una sola planta o campus, entra directo
ahí — no se le pide escoger entre una opción. Si tiene varias (admin
corporativo), se le muestran las suyas y **solo las suyas**.

### 3.2 Carrier

**Quién llega:** admin, coordinador o mantenimiento del carrier.

**Lo primero:** su nombre, y que esta es **su** operación.

**Puertas:**
- Historial de flota
- Alta de flota
- Recorrido
- Cumplimiento contractual
- Mantenimiento

**Ley que no se rompe:** un carrier jamás ve otro carrier. Y **el cliente jamás
ve la operación interna del carrier** — nada de esta cara sale hacia allá.

### 3.3 J-Staff

**Quién llega:** el operador de la plataforma.

Ya existe (`/jstaff`) y funciona. **Lo que necesita es coherencia visual con las
otras dos**, no rediseño. Se deja como está en estructura.

**Distinción que no se pierde:** J-Staff es cara interna. Es el único lugar donde
viven el tablero de diagnóstico y las tripas del motor. Un cliente jamás ve esta
superficie.

---

## 4. Los subdominios

**Definidos en `docs/Brief-Identidad-J-Tel.md`** (documento marcado superseded,
pero esta sección sigue vigente y así está declarado en su encabezado):

| Subdominio | Para quién |
|---|---|
| `j-tel.io` | Landing pública |
| `portal.j-tel.io` | Cliente — **el alcance lo decide el rol, no la URL** |
| `carrier.j-tel.io` | Transportista |
| `staff.j-tel.io` | Consola interna |

### 4.1 ⚠ El dominio no está comprado

**`j-tel.io` todavía no se ha adquirido.** Consecuencia práctica:

- **Se diseña y se deja el código listo**, de modo que apuntar los subdominios sea
  configuración y no obra.
- **No se enciende nada** hasta que el dominio exista.
- El landing sigue viviendo en `/landing` y la raíz sigue siendo el selector
  interno, tal como se decidió al construirlo.

**Esto no bloquea los homescreens**, que son el trabajo real de este frente. El
enrutamiento por subdominio es la capa de encima.

### 4.2 La regla que no se puede romper

> **El subdominio es una puerta, no un permiso.**

Que alguien llegue por `portal.j-tel.io` **no lo convierte en cliente**. Quién es
y qué alcance tiene lo decide su membresía, siempre — la URL solo lo lleva a la
puerta correcta.

Si esto se invierte, se abre el agujero más obvio de todos: escribir otra URL
para ser otra persona. **La guardia sigue siendo la de `auth-rbac`, sin
excepciones por subdominio.**

---

## 5. El pase de coherencia visual

Sobre lo que **ya existe**, no sobre lo que falta. Que el producto se sienta uno,
no doce pantallas construidas en días distintos.

Gobierna el skill `j-telemetry-ui`. Los puntos a revisar:

- **Encabezados y navegación** — misma forma, mismo lugar, en las tres caras.
- **Vacíos** — aplicar la regla de los tres estados vacíos ya en el skill:
  arranque, vacío legítimo, y vacío roto. Ninguno se parece a los otros.
- **Los tres colores de resultado** — verde, ámbar y rojo **solo** para
  resultados. Estados operativos en acero y tenue. Ya hay pantallas que lo
  respetan; el pase es para las que no.
- **Instantes y duraciones** — fechas completas donde sirven de evidencia;
  duraciones como duraciones (`2 h 14 min`), nunca con formato de hora.
- **Todo número con su lectura al lado** — un número sin su umbral es medio dato.

**Lo que este pase NO es:** un rediseño. Es alinear lo existente al skill que ya
gobierna.

---

## 6. Lo que no se toca

**El selector de cuentas actual se conserva.** Es la herramienta con la que se
construye y se opera hoy, y sigue siendo necesaria mientras el bypass de
desarrollo esté vivo. **Deja de ser la puerta principal; no deja de existir.**

**Ninguna pantalla de juicio nuevo.** Expedientes, tendencias, preventivo y mapas
de resultados siguen esperando a la Ola 2, por la misma razón de §2.

**El árbitro no se toca en este frente.** Ni una línea de `packages/verification`.

---

## 7. Orden de construcción

1. **Homescreen de cliente** — la cara con más superficie y la que más gana.
2. **Homescreen de carrier.**
3. **Coherencia de J-Staff** con las otras dos.
4. **Pase de coherencia visual** sobre lo existente.
5. **Enrutamiento por subdominio** — código listo, apagado hasta que exista el
   dominio.

Los pasos 1 a 4 son **tramo verde**: no tocan motor, no tocan veredictos, no
escriben en producción. El paso 5 toca configuración de despliegue y va aparte.

---

## 8. La compuerta de salida

Este frente cierra cuando:

- Cada cara llega **a su casa** y no al selector de cuentas.
- Un usuario de planta ve **su** planta o campus, y nunca los de otra operación.
- Las tres caras se sienten **el mismo producto**.
- **Ninguna pantalla muestra un número de juicio que aún se pueda mover.**

Y lo que hace que valga la pena: cuando esto cierre, **enseñar J-Telemetry deja
de requerir explicaciones.** Quien entra, entiende dónde está y qué puede hacer.
