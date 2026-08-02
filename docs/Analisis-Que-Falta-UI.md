# Qué falta para que la UI quede como la definimos

**Medido contra `main` (7c5a471), no de memoria.**
**Total de pantallas existentes: 48** — 37 de cliente, 11 de carrier. Diseñamos 9.

**Al commitearse, la Oficina ya entró (#166–#168); Pendiente, Inicios y Correos siguen en rama.**

---

## 1. La respuesta corta

**Revestidas hoy: 2 de 48.** Monitoreo y Cierre del turno.

De las 46 restantes:
- **6 se pueden revestir ya** — tienen ficha y muestran hechos
- **4 tienen ficha pero esperan Ola 2** — muestran cifras de juicio
- **36 nunca se diseñaron** — y ese es el número que importa

**El hueco no es de construcción: es de diseño.** Faltan más pantallas por diseñar que por construir.

---

## 2. Lo que se puede revestir YA — tanda inmediata

Ficha escrita, datos existentes, muestran hechos y no juicios.

| Pantalla | Ficha | Rutas que reviste |
|---|---|---|
| **Oficina** | `Ficha-Oficina-Contrato.md` | `configuracion` + 5 subrutas ×3 alcances = **15 pantallas** |
| **Pendiente por evidencia** | `Ficha-Pendiente-Por-Evidencia-Pantalla.md` | `planta/[id]/pendiente-por-evidencia` |
| **Inicio planta** | `Ficha-Inicio-Dos-Caras.md` | `planta/[plantId]` |
| **Inicio campus** | idem | `campus/[groupId]` |
| **Correos** | `Ficha-Correos-y-Alertas.md` | plantillas, no pantalla |

**Ojo con la Oficina: son 15 pantallas, no una.** Configuración tiene subrutas (contratos, geocercas, rutas, servicios, turnos) repetidas en tres alcances. Es el PR más grande de esta tanda.

**Después de esta tanda: 8 pantallas principales revestidas** y el producto se ve coherente en su recorrido central.

---

## 3. Lo que tiene ficha pero ESPERA Ola 2

Diseñadas y fichadas, pero su contenido son **cifras de juicio** — porcentajes de cumplimiento, tendencias, retículas de veredictos. Revestirlas antes de que el árbitro pase su compuerta sería ponerle piel bonita a números que no aguantan una discusión.

- **Cumplimiento** (`planta/`, `campus/`, `cliente/cumplimiento`) — la de los sparklines y la retícula
- **Expediente de ruta** — su bloque de métricas
- **Expediente de unidad** — su bloque de cumplimiento (lo demás sí va)
- **Expediente del contrato** — su bloque de cumplimiento

**Matiz importante:** ruta y unidad **se pueden revestir parcialmente hoy** — identidad, trazado, salud de señal, rastreadores, historial. Solo el recuadro de métricas queda como espacio reservado.

---

## 4. Lo que NUNCA se diseñó — el hueco real

**36 pantallas.** Aquí está el trabajo que falta, y es de diseño, no de construcción.

### 4.1 Cliente — sin diseñar
| Pantalla | Qué es | ¿Se puede diseñar hoy? |
|---|---|---|
| `jornada` (×3 alcances) | vista de jornada, existe y se usa | **Sí** — no sabemos qué muestra, hay que mirarla |
| `servicio/[id]` | expediente del servicio | **Sí** — mockup aprobado, falta ficha |
| `contrato/[id]` + `/historia` | expediente del contrato | **Sí** — ficha escrita |
| `inspecciones` | zona compartida planta–carrier | **No** — nunca se definió qué hace |
| `notificaciones` | historial de avisos | **Sí** — conecta con los correos |
| `reportes` | exportaciones | **No** — falta definir qué exporta |
| `plantas` | panorama corporativo | **Sí** — pero hay que diseñarlo desde cero |
| `cliente/` (raíz) | panorama corporativo | **Sí** — el que viste con tarjetas duplicadas |

### 4.2 Carrier — **la cara completa sin diseñar**
Once pantallas, y **solo se diseñó su inicio** (mockup, sin ficha):

`flota` · `gps` · `combustible` · `mantenimiento` · `historial` · `historial/[unitId]` · `recorrido` · `cumplimiento` · `reportes` · `servicio/[id]` · inicio

**Esta es la mitad del producto y está entera con piel vieja.** Y el nav lateral tampoco llegó a carrier — sigue con la barra horizontal que el skill prohíbe.

### 4.3 J-Staff — sin diseñar
Consola de operador. Nunca se dibujó.

### 4.4 Login y onboarding
Depende de auth-rbac. Hoy hay una pantalla de desarrollo (el menú de tres caras) que **debe desaparecer**.

---

## 5. Lo que falta de LÓGICA, no de piel

Cosas que ninguna pantalla puede mostrar hasta que el motor las produzca.

| Falta | Bloquea | Tamaño |
|---|---|---|
| **Destinatarios por rol y contrato** | los correos no se pueden enviar | mediano — `userMemberships` no liga a `service_contracts`, emails en Clerk |
| **Concepto de contratación** | módulos no contratados con candado | mediano — no hay tabla de features ni plan |
| **Modelo de choferes** | expediente de chofer, "quién manejó" en unidad | mediano — 2 tablas, plano ya escrito |
| **Vigencia del contrato** | expediente del contrato | chico — confirmar si `validFrom`/`validTo` se persisten |
| **Longitud de ruta** | "31.4 km" en expediente de ruta | chico — calcular de waypoints |
| **Datos de alta de unidad** | modelo, año, asientos, verificación | chico — no existen columnas |
| **Kilómetro muerto** | métrica del carrier | mediano — distinguir recorrido en servicio de fuera |
| **CI que corra integración** | nada, pero deja pruebas sin vigilar | chico |
| **ESLint** | nada, pero no hay red de seguridad | mediano — levanta ola sobre 60 archivos |
| **~14s de la torre** | percepción de lentitud | por medir |

---

## 6. El orden que recomiendo

**Ahora (Carril B, semana):**
1. Oficina (15 pantallas) · 2. Pendiente · 3. Inicios · 4. Correos

**Después, si quieres que el producto se vea completo antes de Ola 2:**
5. Expediente del servicio (mockup listo, falta ficha)
6. Expedientes de ruta y unidad, sin su bloque de métricas
7. Expediente del contrato
8. Panorama corporativo (rediseño — hoy duplica la nav)
9. **La cara carrier completa** — es la mitad del producto y no se ha tocado

**Y en paralelo, lo que desbloquea:**
- Modelo de choferes (2 tablas) — completa el expediente de unidad
- Destinatarios de correo — desbloquea 1.b

**Después de todo eso: Ola 2**, y con ella se revisten Cumplimiento y los bloques de métricas.

---

## 7. La verdad incómoda

**Diseñamos 9 pantallas. El producto tiene 48.**

Las 9 son las importantes —el recorrido central del cliente— pero **la cara del carrier está entera sin diseñar**, y es la mitad de tu negocio: el carrier es quien paga por saber cómo va su flota.

Cuando termines la tanda de Carril B, el producto va a verse bien **para la planta**. Para el carrier va a seguir viéndose viejo.

**Eso no es un error de ejecución: es que nunca lo diseñamos.** Y es la decisión más grande que queda pendiente después de esta tanda.
