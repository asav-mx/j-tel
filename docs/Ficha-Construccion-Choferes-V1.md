# Ficha de construcción · Choferes V1 — el alta y el expediente

**Qué es.** El PR E que la ficha de Expedientes (16-sep) dejó con nombre: dar vida al cajón **Choferes** del archivero. Alta, corrección y expediente (`Ver ‹chofer›`). Con esto el cajón deja de decir «Sin choferes dados de alta», y se desbloquea la cadena que pidió Asav el 19-sep: **sin choferes no hay asignación, sin asignación no hay ausentismo, y la atribución del paso por parada (la suite de transporte público (B), por diseñar) queda coja.**

Esta ficha obedece a `docs/Ficha-Expedientes.md` en todo lo que ya decidió (las cuatro familias, los tres estados, la vigencia §4, el catálogo §5) y al archivero (#450) en la puerta. No las repite: las llena.

**Proceso:** rama propia. Plan antes de código; lo que choque con el repo se reporta, no se acomoda. Checks verdes no son aprobación. El merge es de Asav.

---

## 1 · El alta

Botón `＋ Dar de alta un chofer` en el cajón Choferes — **vuelve el botón que el #450 quitó con razón**, porque ahora sí lleva a algún lado. El alta pide lo mínimo que identifica:

- **Nombre completo** (obligatorio).
- **Número de licencia** (obligatorio) y **su vencimiento** (si la licencia lo trae; la regla del §4 de la ficha vieja gobierna cómo se juzga). El número vive en las credenciales —es identidad y lleva su candado—; **el vencimiento se guarda como papel «Licencia» del catálogo**, con el número de folio, para que el §4 lo juzgue como a cualquier papel, en un solo lugar. `driver_credentials.license_expires_on` no se escribe (enmienda 2).
- Lo demás — papeles del catálogo, foto, contacto — **no se pide en el alta**: se captura después en el expediente, cada papel en su lugar. Un alta larga es un alta que no se llena.

Reglas de identidad, mismas que unidades (C4-e): **nombre único por cuenta** y **licencia única por cuenta**, con el candado en la base además del aviso en palabras. La corrección se hace desde `Ver ‹chofer›` y sobrescribe, con aviso — igual que la unidad.

## 2 · `Ver ‹chofer›`

Las cuatro familias, con los tres estados honestos de la ficha vieja. Al construir se comprueba contra la base, no contra esta tabla:

| Familia | Parte | Estado esperado hoy |
|---|---|---|
| Identidad | Nombre · número de licencia | con datos desde el alta |
| Actividad | Unidades que ha operado | **aún no disponible · llega con el chofer declarado en cada servicio** — si la base ya tiene alguno, con datos (enmienda 5). Los pasos por parada no se dibujan en V1: no tienen fuente ni ley. |
| Relaciones | Sus servicios asignados (ruta × turno, o circuito) | **aún no disponible · llega con la asignación** |
| Documentos | Licencia con su vencimiento; los demás papeles del catálogo de su mercado | licencia con datos desde el alta; el resto según el catálogo (§5) |

La frontera de siempre (6.19): ninguna parte dice «aún no disponible» sobre algo que la base ya tenga — se mide antes de escribir el estado.

## 3 · El cajón, ya con gente

Lo que el #450 dejó listo se llena solo: glifo por el peor papel, nombre, licencia de apoyo, y el dato de papeles (`VENCIDOS / POR VENCER / FALTAN / AL DÍA / SIN JUZGAR` — las mismas reglas que unidades, incluida la lección del «sin juzgar» cuando el catálogo no está cargado). «Piden atención» del tablero recibe a los choferes con papeles vencidos, por vencer o faltantes —la misma regla que unidades—, junto a unidades y dispositivos.

## 4 · Lo que esta ficha NO construye (con nombre)

- **La asignación chofer ↔ servicio.** Es el siguiente paso, no éste, y trae una pregunta abierta: `driver_assignments` liga chofer con **ruta × turno** (forma de especial); la forma para **circuito** (¿circuito × franja?) la define la construcción de la terminal (la suite de transporte público (B), por diseñar). Se diseña cuando la terminal se diseñe, para no inventarle forma dos veces.
- **El ausentismo.** Necesita la asignación. Queda declarado en la terminal como «aún no disponible · llega con la asignación» (la suite de transporte público (B), por diseñar).
- **Papeles más allá de la licencia** (examen médico, antidoping): esperan la palabra del abogado (§6 de la ficha vieja) y el catálogo cargado.
- **jrz-pass y abordaje**: futuro del expediente, no de esta ficha.
- **La baja del chofer, con ficha propia.** Es el momento delicado: **purga datos personales** (Plan-Choferes 6.5), y los momentos delicados no se cuelan de pasada en otra ficha. Cuando se construya purga, en el mismo acto, las credenciales **y los papeles del chofer** —incluida la «Licencia» que nace en esta alta—, y conserva los hechos. Mientras un chofer de baja conservara sus credenciales seguiría ocupando su nombre y su licencia en el candado de la 0042: por eso la purga no puede quedar para después.

## 5 · Pruebas mínimas

1. Alta con nombre y licencia crea al chofer y aparece en el cajón; el candado de duplicados rechaza nombre o licencia repetidos, en palabras y en la base.
2. `Ver ‹chofer›` muestra las cuatro familias con sus estados; ninguna parte «aún no disponible» miente sobre datos existentes (prueba contra la base sembrada).
3. La vigencia de la licencia sigue §4: vigente todo el día del vencimiento, vencida desde las 00:00 del siguiente, hora de Ciudad Juárez.
4. «Piden atención» del tablero incluye choferes con papeles vencidos, por vencer o faltantes.
5. El cajón vacío sigue declarando su vacío en una cuenta sin choferes.

## 6 · Revisión visual (de Devin)

Desechable con choferes sembrados (incluido uno con licencia vencida y uno sin catálogo cargado), dos pieles, 375 y 1280 px, capturas en el PR.

## Enmiendas del 19-sep (al revisar el plan contra el repo)

Decididas por Asav el 19 de septiembre de 2026. Cada una corrige algo que la ficha daba por hecho y que el repo contradice. Donde el texto de arriba y una enmienda no coinciden, manda la enmienda.

1. **Sin citas a ley no firmada.** La Pieza 9 está redactada y espera ratificación; no está en el Maestro del repo. Sus citas (9.2, 9.5, 9.11) dicen «la suite de transporte público (B), por diseñar». Cuando la pieza entre al Maestro, un PR de documento las restaura.
2. **La licencia en un solo lugar.** El número en las credenciales (identidad, con su candado); el vencimiento como papel «Licencia» del catálogo, con el número de folio. El alta sigue pidiendo el vencimiento, pero lo guarda como papel. `license_expires_on` no se escribe. La baja futura purga también esos papeles.
3. **El candado en la base es la 0042:** la cuenta en las credenciales, con llave compuesta hacia `drivers`, y dos índices únicos —nombre y licencia— sobre los choferes activos. Se aplica en Neon antes del merge.
4. **Examen médico y antidoping** dicen «aún no disponible · espera la palabra del abogado», sin botón, y **no cuentan** en el resumen ni en «Piden atención»: un chofer no puede nacer condenado a nunca estar al día por papeles que ni se pueden capturar.
5. **La actividad dice de dónde llega de verdad:** del chofer declarado en cada servicio (`compliance_facts.declared_driver_id`), no de la asignación. Los pasos por parada no se dibujan en V1.
6. **La baja queda fuera**, como pendiente con nombre y con ficha propia (§4).
7. **«Por vencer» entra a «Piden atención»**, igual que en unidades.

Y lo que sigue tal cual: da de alta quien maneja la flota (coordinador y admin del transportista, y el admin de plataforma); el cajón Choferes lleva los mismos chips que Unidades; la hora del vencimiento es la del mercado de la cuenta.
