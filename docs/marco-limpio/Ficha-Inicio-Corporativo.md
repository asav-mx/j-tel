# Ficha — Inicio corporativo

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Reviste** `cliente/page.tsx`. **Cara:** cliente, alcance corporativo.

---

## 1. Qué es, y qué estaba mal

Lo que ve quien tiene varias plantas o campus. Responde: *¿dónde tengo que mirar hoy?*

**Dos problemas de la versión anterior, que esta ficha corrige:**

1. **Repetía la navegación en tarjetas.** "Administrar plantas" y "Reportes corporativos" aparecían como tarjetas *y* como renglones de nav. Con nav lateral permanente, esas tarjetas sobran.
2. **Mostraba conteos históricos sin alcance temporal.** "1837 servicios · 469 no cumplidos" acumulados desde siempre. **Es §D del Marco:** un dato correcto que alarma sin informar, porque no dice de cuándo.

> **Esta pantalla es para decidir dónde mirar, no para operar.** Cada sitio tiene su propio panel, su cierre y su configuración.

---

## 2. Vocabulario — regla nueva

**En la cara del cliente, una planta o un campus es un "sitio".** Nunca "unidad" ni "unidad operativa".

**Por qué:** un cliente de transporte lee "unidad" y entiende camión — y en la cara del transportista eso es exactamente lo que significa. La misma palabra con dos significados en un producto donde el vocabulario es la mitad del valor.

"Unidad operativa" sigue siendo el nombre en código. Solo sale de la pantalla.

---

## 3. Estructura

### 3.1 Titular
Nombra el sitio que necesita atención: *"Campus Santos Dumont necesita atención."* Si ninguno lo necesita, lo dice: *"Los tres sitios al corriente."*

Subtítulo: cuenta, cuántas plantas en cuántos sitios, cuántos transportistas, fecha.

### 3.2 El aviso
Un bloque con borde ámbar, solo si hay algo que atender. Enuncia el hallazgo con su antigüedad y su comparación:

*"22 servicios quedaron sin poder juzgarse por falta de evidencia — el más viejo lleva 6 días · Planta 47 y Salvárcar tienen 3 entre las dos."*

**La comparación es lo que lo hace accionable.** Un número solo no dice si es mucho.

### 3.3 Tus sitios
Una tarjeta por sitio. Cada una: tipo (campus con sus plantas, o planta independiente) · nombre · transportista · tres cifras de hoy (servicios, servicios pendientes, sin verificar) · **una tira de 14 días** con un cuadro por día en el color de su resultado.

**La tira es lo que permite comparar de un vistazo.** Un cuadro vacío es un día sin servicios programados, no un día sin datos.

Cada tarjeta abre el panel de ese sitio.

### 3.4 Todo sumado
Cuatro cifras del conjunto, en acero: servicios de hoy · servicios pendientes **con la antigüedad del más viejo** · sin verificar · transportistas.

**Cada cifra que pueda alarmar lleva su alcance temporal.** Es la regla §D aplicada.

### 3.5 Bloque reservado
Comparar el cumplimiento entre sitios. Con su razón escrita: *"poner lado a lado el porcentaje de un campus contra el de una planta es la comparación de más peso que hace este producto — y por eso es la última que se muestra, no la primera."*

---

## 4. AUDITORÍA DE DATOS

**Confirmado que existe:**
- `plants`, `plantGroups`, `accounts` — los sitios y su tipo
- `countByStatusForScope` y `countByStatusForClientAccount` (PR #164) — **las cifras sin traer filas.** Esta pantalla era uno de los cinco sitios que contaban en JS
- `complianceFacts` — la tira de 14 días, agrupada por día
- `serviceContracts` — qué transportista sirve cada sitio

**Debe confirmar desarrollo:**
1. **Antigüedad del pendiente más viejo.** Es un `min(materializedAt)` sobre los pendientes abiertos del alcance. Confirmar que se puede sin traer filas.
2. **La tira de 14 días por sitio.** Agrupación por día y estado, por sitio. Con tres sitios ×14 días es chico, pero **medir con una cuenta de veinte plantas.**
3. **Distinguir "sin servicios programados" de "sin datos".** Un cuadro vacío tiene que significar lo primero. Si no se puede distinguir, **no se dibuja la tira** — un cuadro ambiguo es peor que ninguno.

---

## 5. Lo que NO lleva

- **Tarjetas que repitan la nav**
- **Conteos históricos sin alcance temporal**
- **Cifras de cumplimiento antes de la compuerta de Ola 2**
- **La flota de los transportistas.** El corporativo ve el estado de sus sitios, nunca los camiones de quien le sirve
- **La palabra "unidad"** para referirse a un sitio
