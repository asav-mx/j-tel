# Ficha — Choferes: catálogo y expediente

**Gobierna:** el skill `j-telemetry-ui`, el `Marco-Limpio-J-Telemetry-MAESTRO.md` y el `Plan-Choferes.md`.
**Rutas nuevas:** `carrier/choferes` y `carrier/choferes/[id]`. **Cara:** transportista.
**BLOQUEADA POR EL MODELO DE DATOS — ver §5.**

**Reviste:** `carrier/choferes` · `carrier/choferes/[id]` — ⚠ **rutas que todavía NO existen** en `apps/web/src/app`.

> **Por qué esta línea existe:** sin ella, contar cuántas pantallas tienen
> diseño obliga a leer las trece fichas y a interpretar. Con ella el conteo se
> rehace solo. La ruta va **en el encabezado y con acentos graves**, para que
> un `grep` la encuentre. Ver `PLAN.md` §8.

---

## 1. La ley que ordena el módulo

> **El chofer se declara, no se mide.** El GPS identifica unidades, no personas. Quién iba manejando lo dice el transportista. Por eso un servicio puede tener unidad medida y chofer sin declarar — y ese hueco se ve, no se esconde.

> **El chofer no tiene resultado propio.** Los servicios que cubrió sí. Atribuir un `no_cumplido` a una persona es la afirmación de más peso que puede hacer este producto.

---

## 2. Las dos capas — la distinción que la pantalla debe hacer visible

El expediente muestra **dos bloques separados, cada uno con su ley escrita**:

**Capa de hechos** (borde acero) — *"Lo que quedó escrito en cada servicio que cubrió. No se borra nunca, aunque se dé de baja: borrarlo destruiría la historia de esos servicios."*
Servicios cubiertos · rutas que ha cubierto · primer servicio · conteos.

**Capa de credenciales** (borde ámbar) — *"Datos personales. Al dar de baja se borran, y los servicios conservan el nombre que ya tenían congelado."*
Licencia con su vencimiento · teléfono · contacto de emergencia · fotografía · documentos.

**Por qué la separación se dibuja y no solo se implementa:** si en pantalla fueran una sola lista, alguien eventualmente pondría un botón de "borrar chofer" que destruiría historia. **Verlas separadas es lo que impide que se colapsen.**

---

## 3. El catálogo

### 3.1 Titular
Enuncia lo que necesita atención: *"Dos licencias vencen este mes."* Si no hay nada: *"38 choferes, ninguna licencia por vencer."*

### 3.2 Lentes
Tres, **enunciadas como conceptos, no como preguntas**: Asignaciones · Licencias y documentos · Servicios cubiertos.

Cada una cambia qué columnas importan y cómo se ordena. **No filtra choferes.**

*(Nota: el explorador de Unidades usa el mismo patrón y sus lentes deben decirse igual — conceptos, no preguntas.)*

### 3.3 Filtros y búsqueda
Búsqueda por nombre o licencia · activos · sin asignación · licencia por vencer (en ámbar) · dados de baja.

### 3.4 La tabla
Avatar · nombre con su licencia · asignación vigente (unidad, ruta, tipo) · vencimiento de licencia con días restantes · servicios de 30 días · desde cuándo.

**El ámbar marca lo que vence, no una falta.**

Cada renglón abre `carrier/choferes/[id]`.

---

## 4. El expediente

Cabecera con foto, nombre, desde cuándo y su asignación vigente. Pestañas: Resumen · Servicios · Asignaciones · Documentos. Navegación entre hermanos.

**Resumen** = las dos capas de §2, más sus últimos servicios con su resultado, más la asignación vigente.

**Bloque reservado:** su cumplimiento, con la razón escrita — *"atribuir servicios no cumplidos a una persona es la afirmación de más peso que puede hacer este producto, y por eso es la última que se muestra."*

---

## 5. AUDITORÍA DE DATOS — **el módulo está bloqueado**

**NO existe tabla de choferes.** Ni `drivers`, ni equivalente. El módulo entero espera el modelo.

**`units.jrzPassDriverId` NO sirve.** Es un campo heredado del sistema anterior; no es la base de este módulo.

**Lo que hace falta antes de construir cualquier pantalla:**

1. **Dos tablas**, según el `Plan-Choferes.md`: una de hechos (congelable) y una de credenciales (purgable).
2. **El nombre congelado en `complianceFacts`.** Cuando un servicio se sella, el nombre del chofer declarado se guarda **dentro del hecho**, no como referencia a una fila que puede borrarse. Sin eso, la purga rompe la historia.
3. **El identificador estable** — pregunta abierta del `Plan-Choferes.md`: ¿lo genera J-Tel o lo provee el transportista?
4. **Asignaciones**: modelo de un solo registro — fija (sin fecha de fin) o por periodo (con rango). Las excepciones se superponen sin cerrar la fija.
5. **Alta mínima**: nombre + licencia. Todo lo demás opcional.

**Confirmado que existe y sirve:**
- `complianceFacts` — los servicios a los que se atribuirá el chofer
- La estructura de expedientes ya establecida (cabecera, hermanos, pestañas)

**Orden correcto: el modelo primero, las pantallas después.** Dibujar sobre una tabla que no existe produce fichas que envejecen mal.

---

## 6. Qué ve la planta — la frontera

Tres niveles, ya decididos en el `Plan-Choferes.md`:
1. **El nombre del chofer en sus propios servicios** — mínimo, por defecto
2. **Historia acotada a su planta** — configurable por contrato
3. **Historia completa** — solicitud que el transportista aprueba

**El catálogo completo es del transportista.** Ninguna planta lo ve.

---

## 7. Lo que NO lleva

- **Un resultado del chofer.** No existe "chofer cumplido"
- **Credenciales mezcladas con hechos** en el mismo bloque
- **Cifras de cumplimiento antes de la compuerta**
- **Un botón de borrar que toque la capa de hechos.** La baja purga credenciales; los hechos quedan
