# Ficha de concepto — Sandbox

> **Estado:** parqueado para v2. No se construye en v1.
> **Propósito de esta ficha:** dejar la idea congelada y validada contra el Marco antes de que se pierda. No es una orden de construcción ni un diseño de pantalla.
> **Autoridad:** el `Marco-Limpio-J-Telemetry-MAESTRO.md` manda sobre este documento.

---

## 1. Qué es, en una frase

Un banco de pruebas donde la planta **rediseña su propia política de rutas contra el historial real de la operación**, y aprueba el resultado como una versión nueva con fecha de vigencia.

Analogía: una mesa de dibujo al lado de la fábrica. Puedes rayar todo lo que quieras en el plano; la fábrica no se mueve hasta que alguien firma el plano nuevo y dice desde cuándo aplica.

---

## 2. Por qué existe

La rotación de personal en la maquila mueve los domicilios cada mes. Las rutas se quedan atrás y nadie las rehace, porque rehacerlas a mano es un trabajo de días. El resultado es la operación normal del mercado: rutas heredadas, camiones que van a media capacidad, y unidades contratadas que ya no corresponden a dónde vive la gente.

Hoy el sistema le dice a la planta si el servicio se cumplió. El Sandbox le dice **si el servicio que contrató sigue siendo el servicio que necesita.**

Es el primer módulo del producto que no juzga: propone.

---

## 3. Dónde encaja en el Marco (validación)

| Ley del Marco | Cómo la respeta el Sandbox |
|---|---|
| La ruta/KML es **política del cliente**, no activo del carrier ni del producto | El Sandbox es exactamente la herramienta del derecho que el Marco ya le concede al cliente. No inventa una facultad nueva. |
| La ruta vive dentro de un turno; el KML pertenece a ruta × turno | El Sandbox trabaja sobre esa misma combinación. No crea un eje nuevo. |
| Todo es modificable; **los hechos pasados quedan atados a la versión vigente cuando ocurrieron** | Una propuesta aprobada nace como versión nueva con fecha de inicio. Los hechos viejos jamás se recalculan. |
| La verdad se calcula una vez y se congela | El Sandbox **nunca escribe hechos**. Sólo lee. Escribe escenarios y propuestas, que son otra clase de objeto. |
| Multi-cuenta; cada quien ve sólo lo suyo | El escenario pertenece a la cuenta cliente. El carrier no ve escenarios, sólo versiones aprobadas y vigentes. |
| Se protegen datos personales al mínimo que la ley exige | El Sandbox trabaja con coordenadas y conteos, nunca con nombres ni domicilios legibles. |
| El código nunca conoce nombres | El Sandbox recibe cuenta, alcance, turno y fecha. No sabe de qué planta ni de qué ruta se trata. |

**Conclusión:** el Sandbox cabe dentro del Marco sin modificarlo, siempre que se respeten las fronteras de la sección 6.

---

## 4. Qué necesita para funcionar (insumos)

1. **Puntos de origen del personal** — coordenadas agregadas, no domicilios ni nombres. *Clase de dato nueva; hoy no existe en el sistema.* Ver preguntas abiertas.
2. **Turnos y sus deadlines** — ya existe.
3. **Geocerca destino** — ya existe.
4. **Capacidad por tipo de unidad** — ya existe en flota.
5. **Tiempos reales de recorrido, por tramo y por hora del día** — **viene del Archivador.**

El punto 5 es el que hace que esto no sea un juguete. Cualquiera puede simular una ruta con los tiempos teóricos de un mapa genérico. Sólo J-Telemetry puede simularla con los tiempos que **de verdad** se hicieron en esos corredores, a esa hora, ese día de la semana, medidos durante meses.

**Consecuencia de planeación:** el Archivador deja de ser un pendiente técnico y se vuelve el combustible del producto v2. Refuerza la decisión ya tomada de guardar la telemetría **cruda y completa**, no recortada a lo que el árbitro necesita.

---

## 5. Qué produce (resultados)

Un **escenario**: una propuesta guardada, nombrada y comparable contra lo que está vigente.

Cada escenario responde:

- Cuántas rutas se necesitan y qué recorrido lleva cada una.
- Cuántas unidades, de qué capacidad.
- A qué hora tiene que arrancar cada una para llegar al deadline **con holgura declarada**.
- Cuánto tiempo pasa a bordo el trabajador más lejano.
- La diferencia contra lo vigente: unidades, kilómetros, tiempo a bordo, holgura.

Un escenario aprobado se convierte en versión nueva de ruta × turno, con fecha de inicio. Un escenario no aprobado no existe para nadie fuera de la cuenta cliente.

---

## 6. Las fronteras (esto no se negocia)

1. **El Sandbox propone, nunca decide.** No escribe hechos de cumplimiento. Ni uno.
2. **Todo cambio aprobado es hacia adelante, con fecha de vigencia.** Nunca retroactivo.
3. **Un hecho pasado jamás se recalcula contra una ruta nueva.** Hacerlo sería fabricar incumplimientos contra un recorrido que no existía el día que pasaron las cosas.
4. **Sin datos personales.** Coordenadas y conteos. Nunca nombres, nunca domicilios legibles en pantalla.
5. **La pared entre cuentas se mantiene.** El carrier ve versiones vigentes, no escenarios en borrador.
6. **Los tiempos son insumo, nunca estándar.** Ver la trampa en la sección 7.
7. **El escenario se guarda con los datos que usó, congelados.** Misma filosofía que el hecho: una propuesta debe poder auditarse meses después, contra lo que se sabía cuando se hizo.

---

## 7. La trampa a evitar

Es la trampa de calibración con otra ropa.

Si el Sandbox optimiza usando los tiempos que hizo el carrier actual, y luego el contrato se aprieta contra esa propuesta, acabas de convertir el desempeño de una sola operación en el estándar contra el que se juzga esa misma operación. El árbitro quedó calibrado contra el auditado.

**La regla:** el estándar es el deadline del contrato. Los tiempos históricos son insumo para saber si un plan es alcanzable, no para fijar lo que se exige.

**El indicador de un mal escenario:** uno que sólo cumple si todo sale perfecto. Todo escenario declara su holgura, y una propuesta sin holgura se marca como frágil antes de que alguien la apruebe.

---

## 8. Qué cambia en el negocio

El sello se cobra por servicio esperado. Es un ingreso predecible pero chico por unidad.

El Sandbox se cobra distinto, porque entrega algo que la planta puede meter a un presupuesto: **unidades que dejan de necesitarse.** Es una línea comercial separada — por proyecto o por módulo — y no debe mezclarse con el precio del sello.

**Importante para la neutralidad:** el Sandbox vive del lado cliente y no toca al árbitro. Si algún día se le cobra por ahorro logrado, ese cobro no puede depender jamás de lo que digan los sellos.

---

## 9. Dependencias antes de poder construirlo

- **Archivador (Tarea B)** completo, guardando telemetría cruda con historia suficiente para tener tiempos por hora del día.
- **auth-rbac**, para saber qué rol dentro de la planta puede aprobar una versión.
- **Versionado de ruta × turno** funcionando de verdad, con fecha de vigencia y hechos atados a su versión.
- Capacidad por tipo de unidad en el expediente de la unidad.

---

## 10. Preguntas abiertas

**Para el abogado:**
- Sobre qué base legal se guardan los puntos de origen del personal, y quién es el responsable de ese dato: la planta o J-Telemetry.
- Qué nivel de agregación es suficiente para que dejen de ser datos personales.

**De producto (para decidir antes de diseñar):**
- ¿El carrier ve la propuesta antes de que se apruebe, o sólo la versión ya vigente? *(Inclinación: sólo la vigente — un borrador del cliente no es asunto del auditado. Pero un cambio de ruta afecta la operación del carrier, así que puede necesitar un aviso con anticipación pactada en el contrato.)*
- ¿Qué rol dentro de la planta puede aprobar una versión? *(Candidato natural: Coordinación de rutas, con visto bueno de Contrato.)*
- ¿Con cuánta anticipación mínima puede entrar en vigor una versión nueva? Debe ser cláusula de contrato, no constante de código.

---

## 11. Nota de nombre

**El nombre interno es Sandbox.** Decisión de Asav. Es el que usa esta ficha, el que usa el backlog en `docs/DESPUES.md`, y el que se usa al hablar del concepto entre nosotros.

**Cómo se rotula en la cara cliente es una decisión separada, y no se toma aquí.** Se toma cuando se diseñen sus pantallas, junto con el resto de su lenguaje.

Lo que conviene tener a la mano ese día, porque el argumento sigue siendo válido aunque no haya ganado el nombre interno: en la cara cliente no va jerga técnica. La propuesta que existió fue **"Taller de Rutas"** — en español de operación, un taller es donde se trabaja una pieza antes de montarla, no donde se juega. Queda anotada como candidata para esa decisión, no como decisión tomada.

Cuando llegue el momento de diseñar sus pantallas, aplica el skill `j-telemetry-ui`. Ojo con dos cosas de ese lenguaje: los colores de veredicto **no se usan aquí** (el Sandbox no juzga nada, así que todo lo medido va en acero), y toda cifra de un escenario va con su comparación al lado.
