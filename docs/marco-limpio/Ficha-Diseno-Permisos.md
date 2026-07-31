# Ficha — Diseño de permisos: rol × alcance

**Fecha:** 31 de julio de 2026 · **Estado:** diseño, pendiente de confirmar §2.3
**Gobierna:** Pieza 4 del `Marco-Limpio-J-Telemetry-MAESTRO.md`. Si algo aquí
choca con el Marco, el Marco gana.

Esta ficha existe porque el PR #134 tropezó con una pregunta que no estaba
resuelta: la guardia preguntaba *"¿perteneces a la cuenta?"* cuando debía
preguntar *"¿tu alcance cubre estos datos?"*. Antes de seguir cerrando puertas,
hay que saber quién debe poder abrir cuáles.

---

## 1. La fórmula

> **Permisos = rol × alcance.**
> El **rol** dice *qué puede hacer*. El **alcance** dice *sobre qué datos*.
> El mismo rol con distinto alcance da permisos distintos.

Separar esas dos cosas es lo que mantiene el sistema limpio. Un coordinador de
transporte y un admin corporativo pueden hacer lo mismo — lo que cambia es
sobre cuántas plantas.

---

## 2. Los alcances

### 2.1 Los cinco alcances

| Alcance | Cubre | Quién lo usa |
|---|---|---|
| `cuenta` | Toda la cuenta | Admin corporativo · Admin carrier |
| `campus` | Un grupo de plantas | Usuario de planta en operación compartida |
| `planta` | Una planta sola | Usuario de planta con transporte propio |
| `contrato` | Un contrato específico | Carrier segmentado por cliente (§4.2) |
| `flota` | Un subconjunto de unidades | Reservado — sin caso de uso hoy |

### 2.2 El hallazgo del campus — por qué el alcance mínimo no siempre es la planta

**Cómo opera el mercado, en real:** plantas chicas bajo el mismo corporativo
**juntan recursos y comparten transporte** para bajar costo. Un camión del Campus
Santos Dumont lleva gente de las tres plantas en el mismo viaje.

Consecuencia de diseño, y es el punto fino de toda esta ficha:

> **Cuando el transporte es compartido, el servicio no pertenece a una planta —
> pertenece al campus.** No existe "el viaje de la Planta 20": existe el viaje del
> campus, que recoge gente de las tres.

Por eso el alcance útil de un usuario de una planta del campus **es el campus**,
no su planta. No es un permiso de más: es que **su operación de transporte es el
campus.** Pedirle que solo vea "lo de su planta" no tiene referente — ese dato no
existe todavía.

**Esto NO viola la ley de "una planta jamás ve otra planta".** Esa ley protege
entre **operaciones distintas**: Planta 47 (transporte propio) y Campus Santos
Dumont son dos operaciones y no se ven entre sí. Dentro de una operación
compartida, el dato del transporte es de todos los que lo comparten — porque
literalmente lo es.

**Lo que hoy no se comparte, porque no existe:** el dato del pasajero. Cada
planta sabe qué trabajador suyo va en qué ruta, y eso vive fuera del sistema, en
el desmadre de hojas y coordinación que J-Telemetry viene a resolver.

**Cuando llegue el dato de pasajero, la línea se mueve:** el viaje sigue siendo
del campus, pero **cada planta ve solo sus propios pasajeros**. Ahí sí el alcance
se afina por planta dentro del campus. Hoy no, porque no hay qué separar.

### 2.3 ⚠ Pendiente de confirmar

La lectura de §2.2 asume que **un usuario de la Planta 20 (dentro del campus) SÍ
debe ver todos los servicios del campus**, porque son suyos también.

**Asav: confirmar.** Si la respuesta fuera que no —que debe ver solo algo
recortado— hay que definir *qué* recorte, porque hoy no hay campo que lo
sostenga.

### 2.4 Compartir entre plantas, configurable

Mencionado como deseable: **una opción en la interfaz para que dos plantas
compartan información** aunque no compartan campus. No entra hoy; queda anotado
como configuración futura, no como excepción horneada.

---

## 3. Roles del lado cliente

### 3.1 Los dos niveles

**Admin corporativo** — alcance `cuenta`. Ve todas las plantas y campus de su
cuenta. Administra los usuarios de su cuenta. **Es el único que cruza entre
plantas**, y solo dentro de lo que está bajo él.

**Usuario de planta operadora** — alcance `planta` o `campus` según §2.2. Ve solo
su operación.

### 3.2 Los roles funcionales — y la decisión que simplifica el arranque

El Marco lista cuatro roles funcionales del cliente: coordinación de rutas (POC),
cumplimiento y penalizaciones (HR), inspecciones (HSE), y contrato y escalaciones
(Procurement).

**Decisión de producto (Asav, 31 jul):** al arrancar, **el rol funcional NO
cambia permisos — solo cambia a quién le llega cada aviso.**

Razón práctica y honesta: **Procurement no va a entrar a la aplicación.** Le va a
pedir el dato a RH o al supervisor de transporte. Construir permisos finos por rol
funcional sería diseñar para un usuario que no existe.

**Consecuencia:** en el primer paso, **el permiso efectivo del lado cliente se
determina casi solo por el alcance.** Eso simplifica enormemente la
implementación y no cierra ninguna puerta — los roles funcionales quedan
declarados y listos para que, cuando alguien de verdad los necesite distintos, se
configuren sin migración.

**Requisito que sale de aquí:** si Procurement no entra a la app pero necesita el
dato, **la información tiene que ser exportable.** Eso no es un permiso, es una
función — y no existe hoy. Ver §6.

### 3.3 La escalación

Distintos temas van a distintos roles. La escalera tipo Honeywell:
`aviso — supervisor — gerente — HR — Procurement — terminación`.

**Configurable por contrato**, no horneada. Es lo que conecta el rol funcional con
la plomería de alertas ya construida.

---

## 4. Roles del lado carrier

### 4.1 Los cinco roles

| Rol | Qué hace |
|---|---|
| **Admin carrier** | Ve toda su flota y operaciones; administra sus usuarios |
| **Coordinador** | Organiza rutas, turnos, unidades, dispositivos y choferes |
| **Despacho** | Monitoreo en vivo — **opcional**, puede no existir: el sistema lo hace solo. Ese es el punto del producto |
| **Mantenimiento** | Bitácora e inspecciones |
| **Chofer** | Parqueado — ver §5 |

### 4.2 La segmentación por cliente — configurable, no fija

Un carrier sirve a **varios clientes** (Juárez Bus atiende Tecma, Honeywell y
otros). La pregunta era si su gente ve todos los contratos o solo algunos.

**Decisión de producto (Asav, 31 jul):** **configurable en la interfaz.** Depende
de cómo opere cada carrier — algunos tienen un coordinador por cliente, otros uno
solo para todo.

Implementación: el alcance `contrato` ya existe para esto. Por defecto, un
usuario de carrier tiene alcance `cuenta` (ve todo lo suyo); si el carrier lo
configura, se acota a uno o varios contratos.

**Lo que nunca cambia:** un carrier jamás ve otro carrier, y el cliente jamás ve
la operación interna del carrier. Eso no es configurable.

---

## 5. Lo parqueado

**Chofer.** Se crea el rol, **sin permisos activos.** Hoy no entra a la
aplicación. `jrz-pass` queda **fuera de alcance por decisión de Asav** — no se
considera por ahora.

**Pre-nómina.** Idea anotada: vincular los viajes con la nómina del carrier. No se
diseña hoy; se deja el rol creado para configurarlo después sin migración.

**Alcance `flota`.** Existe en el esquema, sin caso de uso. No se construye hasta
que aparezca uno.

---

## 6. Lo que hace falta y no existe

**Exportar.** Sale directo de §3.2: si Procurement y otros roles de escalación no
entran a la aplicación, alguien tiene que poder **sacar el dato** y mandárselo.
Hoy no hay forma. Es un frente propio, y ahora tiene una razón medida detrás.

**Administración de usuarios.** El Marco dice que el admin corporativo
"administra los usuarios de su cuenta" y el admin carrier los suyos. **Esa
pantalla no existe.** Sin ella, dar de alta usuarios es trabajo manual de J-Staff.

**El mapeo de identidad.** `clerk_user_id` hoy guarda cadenas del seed
(`tecma_admin`), no los identificadores que emite Clerk. Sin ese mapeo, una
sesión real trae cero membresías. Es el Paso 2 de auth-rbac y **bloquea todo lo
demás de esta ficha.**

---

## 7. El orden de construcción

1. **El mapeo de identidad** (Paso 2 de auth-rbac). Sin esto nada de lo demás se
   puede probar con usuarios reales.
2. **La guardia por alcance, no por cuenta.** Arreglar lo que tumbó el #134: que
   pregunte *"¿tu alcance cubre estos datos?"*. Aquí entra el campus de §2.2.
3. **Proteger las páginas** (`/cliente`, `/jstaff`) y el **expediente por id**,
   que siguen abiertos.
4. **Administración de usuarios**, para que el admin corporativo dé de alta a su
   gente sin pasar por J-Staff.
5. **Escalación configurable**, enganchada a la plomería de alertas ya construida.
6. **Exportar.**

Los roles funcionales finos (§3.2) **no entran en ninguno de estos pasos** — se
quedan como etiquetas hasta que alguien los necesite distintos.

---

## 8. Las leyes que no se tocan

1. **Permisos = rol × alcance.** Qué puede hacer y sobre qué datos son cosas
   separadas.
2. **Una planta jamás ve otra planta** — entendido como **operaciones distintas**
   (§2.2). El campus es una operación, no una excepción.
3. **Un carrier jamás ve otro carrier.**
4. **El cliente jamás ve la operación interna del carrier.**
5. **Las cuentas son privadas.** Nadie cruza entre cuentas, salvo J-Staff por la
   compuerta de soporte, respetando datos personales y sin alterar la verdad.
6. **Toda acción sensible queda en el ledger** — quién hizo qué y cuándo.
7. **Roles, alcances y escalaciones son configurables** — no vienen fijos.
8. **La guardia falla cerrado.** Si no puede resolver la identidad o el alcance,
   niega el paso. Una guardia que se cae y deja pasar no es una guardia.
