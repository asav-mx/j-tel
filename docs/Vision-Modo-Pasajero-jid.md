# Nota de Visión — Modo Pasajero y j-id (el Norte, no para construir hoy)

**Estado:** VISIÓN. No es trabajo en curso. No se implementa nada de esto ahora. Su función es fijar el destino a largo plazo para que las decisiones de HOY (Modo Rutas) no cierren la puerta a llegar aquí mañana.

**Autoridad:** subordinado al Marco Maestro. Cuando esto madure, se derivarán piezas propias verificadas contra el Marco.

---

## La tesis

Hoy J-Telemetry verifica que **la ruta se hizo**. La visión es verificar que **el pasajero llegó**. Son las dos caras de la misma verdad — "el empleado llegó a su trabajo" — una medida por la ruta, otra por la persona.

El Marco ya planta la semilla: el propósito del servicio es que el trabajador llegue a la planta. El Modo Rutas lo mide por el vehículo; el Modo Pasajero lo mediría por el destinatario real del servicio.

## Los dos modos

- **Modo Rutas (existe / se construye ahora):** ancla en la ruta y su recorrido. El contrato mide por KML completo o por llegada al destino. La consolidación (una unidad cubre varias rutas por fuerza operativa) es tolerada y medida. Este es el producto de hoy.

- **Modo Pasajero (visión):** ancla en el pasajero, no en la ruta. Solo tendría sentido en contratos tipo "sólo destino" — donde lo que importa es que la gente llegue, no el trazo exacto. Cambia el modelo de negocio: de "auditar al carrier contra una ruta fija" a "orquestar y verificar que un universo de empleados llegó a su planta".

## Qué haría falta para el Modo Pasajero (a grandes rasgos, sin construir)

1. **j-id (no existe aún):** sistema hermano de identidad. Registro del universo de pasajeros/empleados y sus puntos de interés (recogidas). Conectado a J-Telemetry solo por un contrato de ID normalizado, no fusionado.
2. **Mapeo:** ubicar esos puntos de recogida en el territorio.
3. **Agrupación / diseño de servicio:** algoritmo que agrupa empleados en servicios a cumplir según sus ubicaciones.
4. **Optimización de ruta en vivo:** contra el universo de unidades disponibles, resolver qué unidad sirve qué grupo, dinámicamente.
5. **Verificación por pasajero:** el "cumplido" se mediría por empleados recogidos y entregados, no por corredor KML.

## Por qué se anota ahora aunque no se construya

Para que el Modo Rutas de hoy **no traicione** este Norte:

- El veredicto se guarda como hecho inmutable con unidad observada y evidencia — eso ya sirve a ambos modos.
- La geocerca como frontera de evidencia y "el destino es parte del servicio" son compatibles con verificar por pasajero.
- La identidad de unidad separada del dispositivo (el GPS es un dispositivo, no la unidad) prepara el terreno para una futura identidad de pasajero separada también.
- Mantener `routeStrictness` como decisión del contrato deja el gancho natural: el Modo Pasajero sería una evolución del modo "sólo destino".

## Regla de oro

Una cosa a la vez. Modo Rutas primero, completo y sólido. j-id y Modo Pasajero son un horizonte, no un pendiente. Este documento existe para no perderlos, no para acelerarlos.
