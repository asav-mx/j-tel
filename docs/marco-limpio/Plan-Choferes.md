# Plan — Módulo de Choferes

**Gobierna:** el `Marco-Limpio-J-Telemetry-MAESTRO.md` y el skill `j-telemetry-ui`.
**Ola:** 3 — después de que el árbitro sea confiable y con `auth-rbac` puesto.
**Cara:** carrier (el transportista administra a sus choferes; la planta ve lo mínimo).

Este documento es **el plano**, no la construcción. Define qué es un chofer en el sistema, qué se guarda de él, quién lo ve y cómo se da de baja. Las pantallas salen de aquí, cada una con su ficha.

---

## 1. La ley que ordena todo el módulo

**El GPS identifica unidades, no personas.**

El rastreador va en el camión. Sabe dónde está el camión, no quién lo maneja. Por lo tanto:

> **El chofer es declarado, no medido.**

Esto no es un detalle de implementación: es la frontera que separa lo que el sistema *sabe* de lo que el sistema *le dijeron*. Un veredicto se sostiene en lo medido. La identidad del chofer es un dato administrativo que el carrier aporta, no una prueba que el sistema levantó.

**Consecuencia de diseño:** en ninguna pantalla el chofer aparece como parte de la evidencia de un veredicto. Se puede mostrar *quién manejó según el carrier*, nunca *quién manejó según el sistema*.

---

## 2. Las dos capas de datos — la distinción que no se puede colapsar

Un chofer tiene dos clases de información, y **se guardan por separado a propósito**:

### Capa 1 — Hechos (se congelan, no se borran)
Lo que quedó escrito en un servicio ya sellado: *"el 23 de julio, según el carrier, esta unidad la manejó R. Medina."* Ese hecho es parte del acta de ese día. **Se congela con el servicio y sobrevive a todo** — aunque el chofer renuncie, aunque pida que borren sus datos.

Guarda: el nombre tal como estaba declarado ese día, y la referencia al servicio.

### Capa 2 — Credenciales (se pueden purgar)
El expediente vivo del chofer: licencia, teléfono, foto, contacto, documentos. Esto **es borrable** — cuando el chofer se va, o cuando la ley obliga, esta capa se limpia sin tocar la Capa 1.

**Por qué la separación es no-negociable:** si las dos capas fueran una, borrar a un chofer que se fue destruiría la historia de los servicios que cubrió. Y conservar todo para siempre violaría la protección de datos. La única salida es que **el hecho conserve el nombre congelado, y las credenciales vivan aparte y se puedan purgar.**

---

## 3. Alta mínima viable

Para dar de alta a un chofer se necesita **solo dos cosas**:

- **Nombre**
- **Número de licencia**

Todo lo demás —foto, teléfono, contacto de emergencia, documentos— es opcional y se llena después. La foto, cuando se incluye, vive en la **Capa 2 (purgable)**.

**Por qué mínimo:** el carrier tiene que poder registrar a un chofer en treinta segundos el día que lo contrata, sin un formulario de veinte campos. La riqueza del expediente se construye con el tiempo, no en el alta.

---

## 4. Qué ve la planta — tres niveles

La planta **no administra choferes** — son del carrier. Pero en algunos contratos necesita ver algo. Tres niveles, y el contrato decide cuál aplica:

| Nivel | La planta ve | Cuándo |
|---|---|---|
| **Nombre en sus servicios** | quién manejó, solo en los servicios de esa planta | el mínimo, por defecto |
| **Historial en su planta** | los servicios que ese chofer cubrió *para ella* | si el contrato lo acuerda |
| **Historial completo** | todo el historial del chofer | **nunca automático** — es una solicitud que el carrier aprueba |

**La regla de fondo:** el historial completo de un chofer es del carrier. Una planta que quiere verlo **lo pide, y el carrier decide.** No es un permiso que se prende: es una solicitud con dos partes.

**Configurable por contrato, con el default en el mínimo.**

---

## 5. Asignaciones — cómo se liga un chofer a una ruta

Un chofer se asigna a rutas. El modelo es **un solo tipo de registro**, no varios:

- **Fija:** sin fecha de fin. El chofer cubre esa ruta indefinidamente.
- **Por periodo:** con rango de fechas. Cubre esa ruta del día X al día Y.

**Las excepciones se superponen, no cierran la fija.** Si el chofer titular de una ruta falta un día y otro lo cubre, esa cobertura del día es una excepción *encima* de la asignación fija — la fija no se cancela ni se parte. Cuando pasa el día de la excepción, la fija sigue vigente como si nada.

**Por qué así:** el modelo de "cerrar y reabrir" genera huecos y confusión sobre quién era titular. Una capa de excepciones sobre una base estable refleja cómo funciona de verdad la operación.

---

## 6. Las pantallas del módulo

Cada una necesita su propia ficha antes de construirse. El plano de qué es cada una:

### 6.1 Catálogo de choferes
La lista de todos los choferes del carrier. Estado (activo, de baja), ruta o rutas que cubre, y su alta rápida.

### 6.2 Expediente del chofer
La vida del chofer, con la **misma forma que los otros expedientes** (servicio, ruta, unidad): cabecera de identidad, navegación entre hermanos, pestañas, historial.

- **Las dos capas visibles como tales:** los hechos (servicios que cubrió, congelados) y las credenciales (expediente vivo, editable).
- Enlaza a las rutas que cubre y a las unidades que manejó.
- **Sin resultado propio.** Como la unidad: el chofer no cumple ni incumple; lo hacen los servicios. La pantalla lo dice.

### 6.3 Alta del chofer
El formulario mínimo del §3. Nombre y licencia obligatorios; el resto, después.

### 6.4 Asignaciones (calendario)
Dónde se ve quién cubre qué ruta, con las fijas y las excepciones superpuestas (§5). Vista de calendario.

### 6.5 Baja del chofer — **el momento delicado**
Cuando un chofer se va, aquí se **purga la Capa 2** (credenciales) y se **conserva la Capa 1** (hechos congelados).

La pantalla tiene que dejar clarísimo qué se borra y qué queda:

> Se eliminan licencia, teléfono, foto y documentos de **R. Medina**.
> **Se conservan** los 40 servicios que cubrió, con su nombre tal como estaba declarado cada día. Esos hechos son parte de las actas selladas y no se pueden borrar.

**Nunca una baja que borre los hechos.** Y nunca una que deje las credenciales colgando.

### 6.6 Solicitud de historial (planta → carrier)
El flujo del nivel 3 del §4: la planta pide ver el historial completo de un chofer, el carrier lo aprueba o no. Dos caras, un acuerdo — como el enforcement.

---

## 7. Auditoría de datos

*Requisito de PLAN-v1 §0. Se llena cuando el módulo entre a construcción — hoy casi nada existe.*

**Lo único que existe hoy:**
- `jrzPassDriverId` en la tabla de unidades: un campo de texto que viene del predecesor congelado (`jrz-drone-os`). **No es la base del módulo.** El módulo se diseña limpio desde este plano; ese campo es, a lo sumo, un dato de migración a considerar cuando toque, nunca el modelo.

**Todo lo demás debe construirse:**
- Tabla de choferes con sus dos capas separadas (§2)
- Tabla de asignaciones con el modelo fija/periodo + excepciones (§5)
- La referencia congelada nombre—servicio en las ocurrencias selladas (§2, Capa 1)
- El nivel de visibilidad por contrato (§4)
- El flujo de solicitud de historial (§6.6)

**Antes de construir cualquier pantalla, desarrollo confirma el modelo de datos de las dos capas** — es la decisión de la que todo lo demás depende.

---

## 8. Lo que NO es este módulo

- **No es identificación por GPS.** El chofer no se detecta; se declara. Si algún día se identifica al conductor, será por otra infraestructura (tarjeta, biometría), nunca por el rastreador del camión
- **No es evidencia de veredicto.** Quién manejó no entra en el juicio de si el servicio cumplió
- **No espeja `jrz-drone-os`.** El predecesor es fuente de datos, no de diseño
- **No colapsa las dos capas.** Ni por simplicidad, ni por conveniencia de una pantalla
