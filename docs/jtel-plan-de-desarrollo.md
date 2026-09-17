# J-Tel — Plan de desarrollo

Dónde vamos y qué sigue. **Fuente única: cualquier chat nuevo lee esto para saber el estado.** Se actualiza al cerrar cada pieza. Acompaña al Marco (`docs/marco-limpio/`) y al mapa de la casa (`docs/Mapa-De-La-Casa.md`). Última actualización: 17 de septiembre de 2026.

---

## Cómo se trabaja

- **Asav decide y revisa; Devin construye.** Asav no corre comandos de terminal. Lo único técnico que hace Asav es correr SQL en el editor de Neon (copiar/pegar lo que se le da) y usar las pantallas.
- **La secuencia de cada pieza:** decidir → prototipo que Asav revisa antes de escribir código → construir → capturas → (migración en Neon si la trae) → merge.
- **Todo entra por PR.** Asav mergea lo que toca motor, Marco, migración, guardias o endpoints que leen telemetría. Devin mergea lo de sólo presentación tras revisión visual de Asav.
- **Migración siempre antes del merge.** SQL en Neon paso a paso, comprobar, y hasta entonces mergear.
- **Árbol lado a lado.** El UI viejo (`/carrier`, `/cliente`, `/jstaff`) sigue vivo mientras la casa nueva (`/casa/…`) se llena cuarto por cuarto. Nada nuevo se construye en el lenguaje viejo. Lo viejo se apaga cuando su último cuarto tenga versión nueva.
- **Modelos:** Opus para decisiones de arquitectura, diseño y validación contra el Marco; un modelo tipo Fable para tramos largos de construcción, en modo "avanza y detente en cada punto de verificación". Devin recomienda el modelo al inicio de cada tarea.
- **Principio recurrente:** los cambios son eventos, no reemplazos. El expediente versiona, la corrección apila, la baja marca sin borrar, reactivar será un evento encima.

---

## Lo que está en main (hecho)

**El cimiento del rediseño:**
- Identidad visual (cobre con tinta azul, dos pieles), skill `jtel-diseno`, mapa de la casa (cinco caras), cascarón con navegación por pestañas.
- Expedientes completo: el cuarto (#421), el catálogo de documentos D2 (#422), mercado de Chihuahua para Juárez Bus (#420).
- Arreglo del menú que perdía la cuenta + selector de cuenta (#429).
- Muro entre cuentas: lo que un dispositivo trajo en otra cuenta no se enseña en ésta (#435).
- La flecha › en las piezas que llevan a otra pantalla (#438).

**El cuarto de Compás — COMPLETO:**
- C1 — recorrido del día con huecos (#424) y corte de traza por modalidad (#426).
- C2 — Flota en vivo con mapa (#428).
- C3 — recorrido y playback en Ver ‹unidad› (#431, #432, #433).
- C4 — acciones y candados (#434), el cuarto Dispositivos (#436), asignar/soltar/dar de baja (#437).
- Recorrido y playback en Ver ‹dispositivo›, partido por unidad (#439).

**Infraestructura / motor:**
- Migración a Compás cerrada; marca de lectura por aparato (#408 / 0037).
- Los 8 FTC927 configurados; los 7 movidos a Juárez Bus (#419), el 002 en el Jeep (ASAV).
- Velocidad: consulta de última señal 3.3 s → 1 ms (#423), cronómetro de lentitud (#427).

**El Marco: 7 piezas.** Pieza 6 (Compás, el cimiento), enmienda del expediente (§H, 6.30–6.33), Pieza 7 (la modalidad del servicio).

---

## Lo que sigue, en orden

### Ahora
1. **Instalar los 7 FTC en camiones de Juárez Bus.** Probar el 005 primero (prueba de 5 min al cielo: si no reporta en su ficha, no instalarlo — su IMEI empieza raro, `860573…`, y no tiene un solo punto en su historia). Asignar cada uno a su unidad **el mismo día** en `/carrier/flota/alta?account=juarez-bus`. Lo que llegue antes de asignar se guarda sin unidad para siempre.
2. **C4-d — apagar el alta vieja** de `/carrier/flota/alta`, ya con los 7 rodando.
3. **Migrar Vernier** a la casa nueva. Es el cuarto más grande que queda del transportista, ya funciona en la piel vieja.

### Después
4. **Medir la lentitud como la vive el usuario** con el cronómetro (#427), y quitar las precargas en ráfaga si hace falta.
5. **Migrar Planta y Corporativo** a la casa nueva.
6. **Migrar el alta de cuentas de J-Staff** al UI nuevo — cuando se acerque el primer cliente real, no antes.
7. **Proveedor de mapas de pago** (MapTiler o Stadia) antes de las 80 unidades. Hoy en OpenStreetMap directo; CARTO dejó de servir sin llave.

### Condición, no fecha
8. **Los 80+ GPS y el alta por lote.** NO es una fecha: se hace SÓLO cuando el cuarto de Compás funcione y Asav lo haya visto trabajar con los 8. Umbrella se deja cuando la prueba convenza.
   - **Decidido (17-sep):** se compran Teltonika nuevos; no se redirigen los 82 Meitrack de Umbrella. Razón: 37 son 3G (red muriendo), ~20 ya callados, cinco modelos por validar contra el árbitro, dos protocolos que mantener. Un solo modelo probado vale más que cinco por validar.
   - Pendiente sin prisa: mandar `0000,A10` por SMS al chip del 10249 (656 551 7725). Si contesta, evaluar redirigir sólo los 42 de 4G como puente mientras llegan los Teltonika.

---

## Pendientes con nombre (anotados para no perderse)

- **El evento de cambio de cuenta.** Hoy mover un dispositivo entre cuentas no deja fecha, así que no se puede decir «sin registro en esta cuenta». Cuando se construya (J-Staff), que sea un evento con fecha, y que el 6.14 lo diga al enmendarse.
- **Quitar la baja desde la pantalla (6.18).** Hoy sólo con SQL. Necesita su propia conversación: reactivar debe ser un evento encima, no un borrado, para no perder fecha y motivo (6.15).
- **El estado de una unidad y de un dispositivo debe derivar del lugar** (patio, taller, en servicio, en bodega) cuando existan Lugares y el mapa en vivo. Requiere roles nuevos de geocerca que hoy no existen.
- **La historia del horario de servicio de los circuitos** — hoy se sobrescribe, por eso el botón de circuito sólo sale hoy.
- `corredor-prueba` es transporte especial cargado como circuito; se corrige cuando la modalidad exista como dato marcable.
- Las alertas viejas de Umbrella (5–11 sep) siguen abiertas y nunca llegan a cero; limpiar al retirar lo viejo (6.17).
- Texto cortado en celular en nombres largos del catálogo («Permiso de transpo…»).
- Marcar el lugar activo dentro de "Más" en el menú.
- Las 23 fichas del Marco que apuntaban al skill viejo (revisión de Asav).
- Las 5 reglas candidatas al Marco en `Trampas-De-Medicion.md` §2, sin ratificar.
- Cuadrar el dispositivo que no coincide: la hoja de Umbrella tiene 81 renglones (el 9181 repetido) pero en la base se dieron de baja 82.

---

## Decisiones grandes pendientes con papá / negocio

- Los valores del catálogo de documentos de Chihuahua (obligatorio, vence, periodicidad, días de aviso) — Asav los junta con su papá y los captura en la pantalla del catálogo.
- Si Compás·flota se vende solo y a qué precio (6.27).
- Las reglas del contrato Tecma, el estado de cuenta, la matriz de permisos (6.29) — sesión con papá.
