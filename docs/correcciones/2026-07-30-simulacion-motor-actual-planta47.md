# Simulación con el motor arreglado — las 300 congeladas de Planta 47

**Generada:** 2026-07-30 · **Fuente:** `DATABASE_URL_READONLY` (usuario
`jtel_readonly`, sin permisos de escritura), solo lectura
**Alcance:** el CSV congelado de `docs/correcciones/2026-07-30-lista-congelada-planta47.md`
**Reproducible:** `pnpm --filter @jtel/services simular-motor-actual-planta47`
(`packages/services/src/simular-motor-actual-planta47.ts`)

Las 300 se congelaron por dos razones. Una ya no aplica: el árbitro está
arreglado (#108, #111, #113, #115). Esto es la medición nueva.

## Qué se midió, exactamente

Cada ocurrencia se juzgó **dos veces**, con el mismo verificador y la misma
evidencia, cambiando una sola cosa — el ancho de la ventana:

- **A · ventana vieja:** 60 min antes del deadline, la constante que estaba
  puesta cuando se midió el 91/209/0.
- **B · ventana derivada:** el ancho que la generación de ocurrencias le pone
  hoy a cada ruta.

Como el verificador es el mismo en las dos columnas, la diferencia A→B es la
ventana y nada más. Y como A corre con el motor de hoy, la distancia entre el
91/209/0 histórico y A es lo que aportó el match sobre el tramo observable.
Las dos preguntas quedan separadas en vez de mezcladas en un número.

## El reparto

| | cumplido | no_cumplido | pendiente_evidencia |
|---|---:|---:|---:|
| Referencia — ventana rota, motor viejo | 91 | 209 | 0 |
| **A** — motor de hoy, ventana vieja | **141** | **157** | **2** |
| **B** — motor de hoy, ventana derivada | **139** | **160** | **1** |

**+48 cumplidos** contra la referencia: de 91 a 139, procesadas las 300 de 300.

El desglose del +48 es lo interesante:

- **+50 por el match sobre el tramo observable** (referencia → A). Este es el
  arreglo que movió el número.
- **−2 por la ventana derivada** (A → B). La ventana ancha, por sí sola, deja
  el total dos cumplidos abajo.

Ese −2 no es ruido y no se puede reportar sin explicarlo.

## Por ruta

`c/n/p` = cumplido / no_cumplido / pendiente_evidencia.

| Ruta | Ocurr. | Ventana antes (min) | A · ventana vieja | B · ventana derivada | Δ cumplidos | Caen solo por corredor |
|---|---:|---:|---|---|---:|---:|
| Huertas - B | 15 | 60 → 111 | 0/15/0 | 13/2/0 | +13 | 0 |
| Juarez Nuevo - B | 15 | 60 → 76 | 5/10/0 | 15/0/0 | +10 | 0 |
| San Jose Auxiliar - B | 15 | 60 → 136 | 2/13/0 | 11/4/0 | +9 | 1 |
| Riveras 7 - A | 14 | 60 → 94 | 3/11/0 | 7/7/0 | +4 | 4 |
| Km 30 - B | 15 | 60 → 121 | 11/4/0 | 13/2/0 | +2 | 0 |
| Centro - A | 14 | 60 → 67 | 0/14/0 | 0/14/0 | +0 | 14 |
| Km 20 - A | 14 | 60 → 60 | 2/11/1 | 2/11/1 | +0 | 11 |
| Oasis - A | 14 | 60 → 91 | 13/1/0 | 13/1/0 | +0 | 0 |
| Parajes del Sur - A | 14 | 60 → 117 | 0/14/0 | 0/14/0 | +0 | 11 |
| Riveras 9 - B | 15 | 60 → 85 | 15/0/0 | 15/0/0 | +0 | 0 |
| San Jose - B | 15 | 60 → 120 | 14/1/0 | 14/1/0 | +0 | 0 |
| Colinas - A | 14 | 60 → 98 | 12/2/0 | 11/3/0 | -1 | 2 |
| Finca - A | 14 | 60 → 105 | 6/7/1 | 4/10/0 | -2 | 10 |
| Sierra Vista - A | 14 | 60 → 128 | 3/11/0 | 1/13/0 | -2 | 10 |
| Juarez Nuevo - A | 14 | 60 → 73 | 5/9/0 | 2/12/0 | -3 | 12 |
| Sanders - A | 14 | 60 → 76 | 5/9/0 | 2/12/0 | -3 | 10 |
| Finca Auxiliar - A | 14 | 60 → 108 | 7/7/0 | 3/11/0 | -4 | 11 |
| Km 30 - A | 14 | 60 → 130 | 10/4/0 | 6/8/0 | -4 | 7 |
| Riveras 9 - A | 14 | 60 → 83 | 6/8/0 | 1/13/0 | -5 | 13 |
| Safari - A | 14 | 60 → 81 | 10/4/0 | 2/12/0 | -8 | 11 |
| San Isidro - A | 14 | 60 → 101 | 12/2/0 | 4/10/0 | -8 | 10 |
| **Total** | **300** | | **141/157/2** | **139/160/1** | **-2** | **137** |

El corte es limpio y va por turno:

- **Turno B se endereza.** Huertas-B (0 → 13), Juarez Nuevo-B (5 → 15), San
  Jose Auxiliar-B (2 → 11), Km 30-B (11 → 13). Son exactamente las rutas que
  `docs/correcciones/2026-07-30-ventana-vs-ruta.md` había marcado como
  condenadas por construcción: ventana de 105 min contra recorridos de 96 a
  282 min. Al abrir la ventana, el arranque de la ruta entra en cuadro.
- **Turno A pierde cumplidos.** San Isidro-A (12 → 4), Safari-A (10 → 2),
  Riveras 9-A (6 → 1), Km 30-A (10 → 6). Ninguna de estas rutas tenía el
  arranque tapado.

## Por qué Turno A pierde: el corredor se diluye

De las 43 ocurrencias que pasaron de `cumplido` a `no_cumplido` al ensanchar
la ventana, **41 caen por una sola razón**: la métrica B (precisión de
corredor) cruzó hacia abajo el umbral de 60, con la métrica A intacta.

| Grupo | n | Puntos GPS | A · cobertura de ruta | B · precisión de corredor | Tramo observable |
|---|---:|---|---|---|---|
| `no_cumplido` → `cumplido` | 41 | ×1.31 | 86.5 → 84.3 | 88.4 → 84.3 | **0.707 → 0.967** |
| `cumplido` → `no_cumplido` | 43 | ×1.23 | 89.2 → 89.7 | **66.6 → 55.2** | 0.980 → 0.972 |

Las dos filas cuentan historias opuestas:

- **Las que se enderezan** ganan tramo observable: de 0.707 a 0.967. La
  ventana destapó ruta que antes no se veía. Eso es verdad nueva.
- **Las que se caen** no ganan nada: el tramo observable ya era 0.98 y se
  quedó ahí, la cobertura de ruta se quedó en 89.7. Lo único que cambió es que
  entraron 23% más puntos GPS y la precisión de corredor se desplomó 11.4
  puntos.

**El mecanismo.** El arreglo #113 puso la métrica A a calificarse sobre el
tramo observable — el prefijo que nadie vio no se cobra. La métrica B se quedó
como estaba: se calcula sobre **todos los puntos GPS de la ventana** contra el
KML completo ([`evaluateUnitRouteMatch`](../../packages/verification/src/index.ts)).
El comentario del código razona que el prefijo no observado no aporta puntos,
y eso es cierto — pero no cubre el otro lado: los minutos extra de una ventana
más ancha **sí** aportan puntos, y son puntos del camión haciendo otra cosa
antes de arrancar la ruta. Entran al denominador de B y la diluyen.

La contraprueba está en las mismas 300: en 31 ocurrencias la precisión de
corredor **sube** con la ventana ancha, y son justo aquellas donde el tramo
observable creció el triple que en el resto (+0.161 contra +0.058). Cuando los
minutos extra son ruta de verdad, los puntos caen dentro del corredor y B
mejora. Cuando son el camión en la base, la diluyen.

Las dos métricas dejaron de medir sobre el mismo tramo. El resultado es que
**ensanchar la ventana cambia el veredicto sin aprender nada nuevo sobre cómo
se manejó la ruta**, que es justo lo que Ley 1 y el arreglo #113 vinieron a
prohibir en el otro sentido.

**El tamaño de la palanca.** De las 160 `no_cumplido` de la columna B, **137
tienen cobertura de ruta ≥ 60 y caen solo por corredor** — con A promedio de
83.9. De esas 137, 42 cruzaron el umbral al ensanchar la ventana (B media 66.0
→ 54.4) y 95 ya venían abajo con la ventana vieja. Es, por mucho, el frente más
grande que queda abierto en Planta 47.

## Contra lo que está sellado hoy

| Sellado hoy | → B (ventana derivada) | Ocurrencias |
|---|---|---:|
| `no_cumplido` | `cumplido` | 128 |
| `no_cumplido` | `no_cumplido` | 126 |
| `pendiente_evidencia` | `no_cumplido` | 33 |
| `pendiente_evidencia` | `cumplido` | 11 |
| `cumplido` | `no_cumplido` | 1 |
| `pendiente_evidencia` | `pendiente_evidencia` | 1 |

**139 hechos cambiarían a favor del carrier** y 34 en contra. El único
`cumplido` sellado (Safari-A del 2026-07-21) se voltearía a `no_cumplido` —
es el escenario del §6 de la ficha, que ahora sí se materializa y por lo tanto
sigue necesitando la revisión manual de Asav.

## Lo que esta simulación NO dice

1. **No se simularon las pasadas de exclusividad ni de eliminación.** Son
   cruzadas entre ocurrencias y escriben. La exclusividad solo puede *quitar*
   cumplidos (dos servicios peleándose la misma unidad), así que **139 es un
   techo, no un piso**.
2. **La ventana de hoy es geométrica, no medida.** `route_traversal_measurements`
   sigue **vacía en producción** (0 filas): la tabla existe desde la migración
   0013 pero nada la ha llenado. El ancho de B sale de dividir el largo del KML
   entre 20 km/h, no de duraciones reales. Cuando el cron empiece a medir, el
   ancho cambia — y este número con él.
3. **La re-verificación, tal como está escrita hoy, aplicaría la columna A, no
   la B.** `reverificacion-zona-motor.ts` llama `computeEvidenceWindow` sin la
   ruta, así que recalcula la ventana vieja y la graba en `trips`
   (`reverificar-zona-planta47.ts`). Si se corre así, el resultado sería
   141/157/2, no 139/160/1.
4. **No se tocó nada.** Usuario `jtel_readonly`, sin `INSERT`/`UPDATE`/`DELETE`
   sobre ninguna tabla. Después de la corrida: 846 hechos, 1948 ocurrencias,
   0 mediciones — los mismos números de antes.

## Recomendación

**No re-verificar todavía.** El número subió +48 y eso es real, pero la mitad
de la mejora se está pagando con 41 veredictos que se voltean por dilución del
corredor, no por evidencia. Sellar hoy significa sellar ese efecto.

El orden que propongo:

1. **Simetrizar B con A** — que la precisión de corredor se mida sobre el mismo
   tramo que la cobertura de ruta, no sobre la ventana completa. Es el mismo
   arreglo que #113, del otro lado de la moneda.
2. **Volver a correr esta simulación** (mismo script, mismo alcance) y ver el
   número sin el efecto de dilución. Las 137 que hoy caen solo por corredor son
   la cota de lo que hay en juego.
3. **Entonces decidir** si se re-verifica, y con qué ventana.

Si la decisión fuera re-verificar antes de eso, hay que corregir primero el
punto 3 de la sección anterior, o el resultado sellado no será el que dice esta
simulación.

## El detalle, ocurrencia por ocurrencia

Columnas: estado sellado hoy, veredicto con cada ventana, ancho de ventana,
puntos GPS considerados, y las tres cifras con las que el motor decidió
(`A` = cobertura de ruta, `B` = precisión de corredor, `observable` = fracción
del trazado que alcanzó a calificarse).

```csv
occurrence_id,service_date,ruta,estado_actual,estado_vieja,estado_derivada,antes_min_vieja,antes_min_derivada,base_ventana,puntos_vieja,puntos_derivada,A_vieja,B_vieja,observable_vieja,A_derivada,B_derivada,observable_derivada
ce983b29-1010-40f0-855b-29c0f80934f7,2026-07-09,Centro - A,pendiente_evidencia,no_cumplido,no_cumplido,60,67,estimada_geometria,8236,8690,74.1,40.7,1,74.1,38,1
550573a8-b34e-47df-8232-bc2ef83b30ac,2026-07-09,Colinas - A,pendiente_evidencia,cumplido,cumplido,60,98,estimada_geometria,8236,10098,98.1,71.5,1,98.1,61.8,1
7f5c40de-000d-47ff-9d79-01d148218ad4,2026-07-09,Finca - A,pendiente_evidencia,cumplido,no_cumplido,60,105,estimada_geometria,8236,10330,88.9,61.5,1,88.9,50.3,1
fe8f6df4-cdf8-4a50-b2ce-9dc747183e5d,2026-07-09,Finca Auxiliar - A,pendiente_evidencia,no_cumplido,no_cumplido,60,108,estimada_geometria,8236,10419,90.3,47.6,1,90.3,46.6,1
b271e370-54e8-413d-b7d7-94caebf43b0c,2026-07-09,Juarez Nuevo - A,pendiente_evidencia,cumplido,cumplido,60,73,estimada_geometria,8236,9044,89.3,69.6,1,89.3,61.9,1
4b7bbbaa-91e5-4308-9f5d-be6da9a4dc60,2026-07-09,Km 20 - A,pendiente_evidencia,no_cumplido,no_cumplido,60,60,estimada_geometria,8236,8236,90.9,45.9,1,90.9,45.9,1
c0ab6026-1ca0-4bba-9e79-5e2fb064bc61,2026-07-09,Km 30 - A,pendiente_evidencia,no_cumplido,no_cumplido,60,130,estimada_geometria,8236,11031,66,50.9,0.991,66,40.4,0.991
0c0a84fe-7b60-48ba-b9c0-89b7044a5fd6,2026-07-09,Oasis - A,pendiente_evidencia,cumplido,cumplido,60,91,estimada_geometria,8236,9860,99.2,72.8,0.982,99.2,67.5,1
1613c42a-5557-4f3c-a62a-cb2f50a749f8,2026-07-09,Parajes del Sur - A,pendiente_evidencia,no_cumplido,no_cumplido,60,117,estimada_geometria,8236,10670,72.8,49.1,0.879,75.6,50.3,0.907
c32c3591-443d-4c92-8ef0-aec4f27faba2,2026-07-09,Riveras 7 - A,pendiente_evidencia,no_cumplido,cumplido,60,94,estimada_geometria,8236,9963,62.4,59.5,0.962,64.7,69.8,1
b592bb56-cc19-42a6-9af4-2cada5fb5b73,2026-07-09,Riveras 9 - A,pendiente_evidencia,no_cumplido,no_cumplido,60,83,estimada_geometria,8236,9522,75.6,53.5,1,75.6,45.3,1
88dd0bc2-84a8-45d8-a5cc-7dea159f213e,2026-07-09,Safari - A,pendiente_evidencia,cumplido,cumplido,60,81,estimada_geometria,8236,9430,90.1,69.3,1,90.1,72.3,1
0aba14eb-e934-46af-b456-7dc7072e9809,2026-07-09,San Isidro - A,pendiente_evidencia,cumplido,no_cumplido,60,101,estimada_geometria,8236,10211,92.5,63.3,1,94.4,50,1
b1d94a5d-8ed4-4cab-b156-f839bf7358d3,2026-07-09,Sanders - A,pendiente_evidencia,cumplido,cumplido,60,76,estimada_geometria,8236,9186,96.3,71.7,1,96.3,66.7,1
aaa8548e-d6de-4fde-8c68-3da97b0f615a,2026-07-09,Sierra Vista - A,pendiente_evidencia,cumplido,no_cumplido,60,128,estimada_geometria,8236,10976,88.9,64.2,0.865,89.8,56.1,1
846ea8ca-ebac-45ce-8e84-796adfd0cdb1,2026-07-09,Huertas - B,no_cumplido,no_cumplido,no_cumplido,60,111,estimada_geometria,6252,7212,91.4,92.4,0.661,92,92.8,0.749
3e98b8c0-ea7b-41a6-a392-c17d3f300d5f,2026-07-09,Juarez Nuevo - B,no_cumplido,no_cumplido,cumplido,60,76,estimada_geometria,6252,6633,96,99.3,0.815,85.4,99.3,0.947
ed3f18e6-cccc-4e31-ae78-03c0a9b17538,2026-07-09,Km 30 - B,no_cumplido,cumplido,cumplido,60,121,estimada_geometria,6252,7441,84.5,88.1,0.857,82.4,66.8,1
2a1d7fe1-041e-4459-b546-1bdde996bc04,2026-07-09,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,6252,6794,78.4,88.5,1,78.4,80.6,1
eaa2b9a0-2aa1-47ee-a401-64805b59603a,2026-07-09,San Jose - B,no_cumplido,cumplido,cumplido,60,120,estimada_geometria,6252,7403,80.2,88.1,0.898,80.2,88.7,0.898
ad13fd24-7809-4a20-ae83-4e2cf8735567,2026-07-09,San Jose Auxiliar - B,no_cumplido,no_cumplido,no_cumplido,60,136,estimada_geometria,6252,8006,78.9,83.3,0.142,78.9,83.3,0.142
184431db-f82d-4d7d-8890-21a675e82f56,2026-07-10,Centro - A,pendiente_evidencia,no_cumplido,no_cumplido,60,67,estimada_geometria,6424,6780,74.1,36.8,1,74.1,33.6,1
0b2f7352-2c40-49f9-a957-7c38b5308327,2026-07-10,Colinas - A,pendiente_evidencia,no_cumplido,no_cumplido,60,98,estimada_geometria,6424,7758,79.7,56,0.839,79.7,48.2,0.839
b5f6a66d-513d-4914-a352-0faf0d60d09a,2026-07-10,Finca - A,pendiente_evidencia,no_cumplido,no_cumplido,60,105,estimada_geometria,6424,7902,89.9,58.6,1,89.9,48.2,1
a851232f-fa79-4eca-8715-aafc4a206673,2026-07-10,Finca Auxiliar - A,pendiente_evidencia,no_cumplido,no_cumplido,60,108,estimada_geometria,6424,7956,82.8,33,0.722,78.6,39.2,0.813
4aaa618a-6419-4a2c-a715-7749c4062aab,2026-07-10,Juarez Nuevo - A,pendiente_evidencia,cumplido,no_cumplido,60,73,estimada_geometria,6424,7057,87.2,67.1,1,87.2,59.9,1
020a4726-ffab-4b89-b0a6-09d1bfbe06c3,2026-07-10,Km 20 - A,pendiente_evidencia,cumplido,cumplido,60,60,estimada_geometria,6424,6424,100,61.1,1,100,61.1,1
a754877c-a7a6-4418-9e85-e01a30f9d18d,2026-07-10,Km 30 - A,pendiente_evidencia,cumplido,cumplido,60,130,estimada_geometria,6424,8338,77.7,84.6,0.969,80.3,61.9,1
a5c90cfd-da42-4e6a-939f-ac6f7f38fdf1,2026-07-10,Oasis - A,pendiente_evidencia,cumplido,cumplido,60,91,estimada_geometria,6424,7592,98.3,76.4,0.982,99.2,74.3,1
4a457b59-a55e-463a-81b1-64437e5b5592,2026-07-10,Parajes del Sur - A,pendiente_evidencia,no_cumplido,no_cumplido,60,117,estimada_geometria,6424,8110,72.1,57.1,0.923,82.8,55.9,0.923
88e1d41d-215e-4e62-b939-e42dcc98cd90,2026-07-10,Riveras 7 - A,pendiente_evidencia,no_cumplido,no_cumplido,60,94,estimada_geometria,6424,7671,65.2,41.4,0.947,68.4,57,1
73a74452-2834-49bd-a778-b2c4fce3e6ea,2026-07-10,Riveras 9 - A,pendiente_evidencia,no_cumplido,no_cumplido,60,83,estimada_geometria,6424,7387,87.6,50,0.974,87.6,38.8,0.974
54df2fef-d468-4913-847b-8c2548ed280b,2026-07-10,Safari - A,pendiente_evidencia,cumplido,cumplido,60,81,estimada_geometria,6424,7331,91.5,69.8,1,91.5,62.2,1
e2434c74-f953-4257-b550-4d07b86c4756,2026-07-10,San Isidro - A,pendiente_evidencia,no_cumplido,no_cumplido,60,101,estimada_geometria,6424,7819,86.6,25.3,0.199,86.6,19.6,0.199
7fc3b955-1be0-4c17-aff8-3026a1e4ef91,2026-07-10,Sanders - A,pendiente_evidencia,no_cumplido,no_cumplido,60,76,estimada_geometria,6424,7178,48.8,35.3,0.871,48.8,35.3,0.871
b80c79f5-f3d7-4524-84bf-46dcf94936e7,2026-07-10,Sierra Vista - A,pendiente_evidencia,no_cumplido,no_cumplido,60,128,estimada_geometria,6424,8303,86,23.2,0.343,28.6,21.6,0.601
d3f73705-b2d0-41b9-aa3a-3b7113be12d3,2026-07-10,Huertas - B,no_cumplido,no_cumplido,no_cumplido,60,111,estimada_geometria,6830,8650,90.9,89,0.617,94.7,67,0.22
8521de04-14c9-4216-b439-fa1aa40f436b,2026-07-10,Juarez Nuevo - B,no_cumplido,no_cumplido,cumplido,60,76,estimada_geometria,6830,7217,83.8,83.1,0.84,78.9,85.6,1
45f9aac3-c308-403e-9cda-2b4e58ca983e,2026-07-10,Km 30 - B,no_cumplido,no_cumplido,cumplido,60,121,estimada_geometria,6830,9052,87.7,100,0.767,83.2,64.9,1
095190fa-d46d-4ccf-a54d-99c4fff8424a,2026-07-10,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,6830,7612,79.7,93,1,79.7,93.5,1
a812a632-5e58-4b29-b97e-4122bf8dee2e,2026-07-10,San Jose - B,no_cumplido,cumplido,cumplido,60,120,estimada_geometria,6830,9022,84.9,84.3,0.898,86.7,69.7,1
97012b0c-6c51-4991-a947-db6d49116d01,2026-07-10,San Jose Auxiliar - B,no_cumplido,no_cumplido,no_cumplido,60,136,estimada_geometria,6830,9602,90.4,92.2,0.753,90.4,92.3,0.753
01ab3a7d-eb69-45cd-88b9-6ca204c01b64,2026-07-13,Centro - A,no_cumplido,no_cumplido,no_cumplido,60,67,estimada_geometria,7439,7971,68.1,39.3,1,68.1,35.6,1
24ab0a88-778f-4a39-bada-a4434a55b364,2026-07-13,Colinas - A,no_cumplido,cumplido,cumplido,60,98,estimada_geometria,7439,9604,100,81.4,1,100,67.4,1
4d558741-37ca-4087-a24e-5a931f380e67,2026-07-13,Finca - A,no_cumplido,cumplido,cumplido,60,105,estimada_geometria,7439,9811,87.4,75.9,0.99,87.9,65.6,1
8e9a203d-057d-4108-94f7-5e2451b45c61,2026-07-13,Finca Auxiliar - A,no_cumplido,cumplido,no_cumplido,60,108,estimada_geometria,7439,9896,94.4,64,1,94.4,55.9,1
694aa656-173a-49e6-861b-9f5eca290fd1,2026-07-13,Juarez Nuevo - A,no_cumplido,no_cumplido,no_cumplido,60,73,estimada_geometria,7439,8380,87.2,53.4,1,87.2,47.2,1
204e29c6-e571-42ef-87e4-547ff340a371,2026-07-13,Km 20 - A,no_cumplido,no_cumplido,no_cumplido,60,60,estimada_geometria,7439,7439,72.7,41.4,1,72.7,41.4,1
3a972259-5b18-4aff-8031-6d88b486f5b0,2026-07-13,Km 30 - A,no_cumplido,cumplido,cumplido,60,130,estimada_geometria,7439,10493,92.3,84.9,1,92.3,67.7,1
740c3abf-94eb-4985-bb89-adde932706a9,2026-07-13,Oasis - A,no_cumplido,cumplido,cumplido,60,91,estimada_geometria,7439,9284,95.8,75.6,0.982,97.5,70.6,1
adbb43be-06db-44e8-8f21-b2b20fe48198,2026-07-13,Parajes del Sur - A,no_cumplido,no_cumplido,no_cumplido,60,117,estimada_geometria,7439,10134,63.7,57.3,0.867,68.5,49.2,0.913
42171f4b-4c45-4c0f-94ee-146d69d41ff8,2026-07-13,Riveras 7 - A,no_cumplido,no_cumplido,no_cumplido,60,94,estimada_geometria,7439,9407,72,41.4,0.962,73.1,55,1
91a52388-eee2-49d1-b70d-5c23ec604df2,2026-07-13,Riveras 9 - A,no_cumplido,cumplido,no_cumplido,60,83,estimada_geometria,7439,8912,73.3,62.9,1,73.3,50.4,1
671a0a32-aa6d-48d6-9241-2e26f7785b96,2026-07-13,Safari - A,no_cumplido,cumplido,no_cumplido,60,81,estimada_geometria,7439,8813,91.5,67.3,1,91.5,55,1
9b4f4bdd-4281-4a33-88ab-44a8b0ff84ae,2026-07-13,San Isidro - A,no_cumplido,cumplido,no_cumplido,60,101,estimada_geometria,7439,9702,82.1,77.5,0.993,84.9,53.4,0.993
7ed49f9b-49b3-4d32-bc0b-34f8f7e944ba,2026-07-13,Sanders - A,no_cumplido,no_cumplido,no_cumplido,60,76,estimada_geometria,7439,8537,98.8,59,1,98.8,52.4,1
f654e654-7626-4bdf-a7f1-f4ad0298f983,2026-07-13,Sierra Vista - A,no_cumplido,no_cumplido,no_cumplido,60,128,estimada_geometria,7439,10441,58.3,67.9,0.865,64.1,61.7,1
f74fb025-a363-4225-8a8e-f196c35f50e6,2026-07-13,Huertas - B,no_cumplido,no_cumplido,cumplido,60,111,estimada_geometria,6695,9391,89,89.7,0.647,91.6,89.3,1
c500ab71-9f79-421a-8f21-3c309f6fd835,2026-07-13,Juarez Nuevo - B,no_cumplido,no_cumplido,cumplido,60,76,estimada_geometria,6695,7526,93.7,91.9,0.776,85.9,93.1,1
1b0d6d6c-4156-4551-a301-1ce6cc4b8a91,2026-07-13,Km 30 - B,no_cumplido,cumplido,cumplido,60,121,estimada_geometria,6695,9771,81.9,89.3,0.889,89.3,71.3,1
80cb876e-a0c0-4a57-aa45-aa03c017e926,2026-07-13,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,6695,8040,75.7,85.7,1,75.7,88.1,1
e085f991-3f7f-4c07-96ba-aa56411b5151,2026-07-13,San Jose - B,no_cumplido,cumplido,cumplido,60,120,estimada_geometria,6695,9738,82.5,86.4,0.898,85.7,62.6,1
2ab40a26-3e8a-479c-8af2-d8497c3960e3,2026-07-13,San Jose Auxiliar - B,no_cumplido,no_cumplido,cumplido,60,136,estimada_geometria,6695,10311,84.9,87.1,0.717,82.2,84.1,0.873
92b54537-06ae-4065-8ad7-5c9a566d40eb,2026-07-14,Centro - A,no_cumplido,no_cumplido,no_cumplido,60,67,estimada_geometria,7924,8389,74.1,41.2,1,74.1,38,1
e5ea03c1-1893-438c-b199-828bcc1791c4,2026-07-14,Colinas - A,no_cumplido,cumplido,cumplido,60,98,estimada_geometria,7924,9809,98.1,71.7,1,98.1,62,1
22ea4fb9-b1d3-4e7c-a7bc-f2b454f7a334,2026-07-14,Finca - A,no_cumplido,no_cumplido,no_cumplido,60,105,estimada_geometria,7924,9997,88.4,58.5,0.99,92.9,49.7,1
05013e3c-deb1-4e95-832b-cea6628b2ee1,2026-07-14,Finca Auxiliar - A,no_cumplido,cumplido,cumplido,60,108,estimada_geometria,7924,10070,98.6,68.6,1,98.6,65.6,1
4b248c50-2304-4ee2-a954-69b0095755ed,2026-07-14,Juarez Nuevo - A,no_cumplido,no_cumplido,no_cumplido,60,73,estimada_geometria,7924,8767,87.2,52.3,1,87.2,46.7,1
cee69212-4987-44d9-89f1-adcc4a405861,2026-07-14,Km 20 - A,no_cumplido,no_cumplido,no_cumplido,60,60,estimada_geometria,7924,7924,69.6,44.3,1,69.6,44.3,1
ff5855eb-8d2d-425f-9e42-f13dca475800,2026-07-14,Km 30 - A,no_cumplido,no_cumplido,no_cumplido,60,130,estimada_geometria,7924,10605,84.8,59.7,0.981,87.2,53,1
af5d93ed-dc1f-487c-b13d-df8bf3fc7c51,2026-07-14,Oasis - A,no_cumplido,cumplido,cumplido,60,91,estimada_geometria,7924,9589,95,79,0.982,97.5,72.8,1
2393914a-a162-4b92-a1e0-f4ce4a93d2b8,2026-07-14,Parajes del Sur - A,no_cumplido,no_cumplido,no_cumplido,60,117,estimada_geometria,7924,10289,73.3,54.3,0.867,76.4,42.6,0.907
691c6b50-ac54-4714-bab0-91426c3b1320,2026-07-14,Riveras 7 - A,no_cumplido,no_cumplido,cumplido,60,94,estimada_geometria,7924,9690,63.3,52.1,0.962,64.7,63.1,1
cd6288b0-bf6f-4e93-8fc5-ac50ae1986de,2026-07-14,Riveras 9 - A,no_cumplido,no_cumplido,no_cumplido,60,83,estimada_geometria,7924,9243,78.7,59.3,0.974,78.7,51,0.974
549a118b-33e5-4c77-b1dd-0ab64eab1920,2026-07-14,Safari - A,no_cumplido,no_cumplido,no_cumplido,60,81,estimada_geometria,7924,9150,91.5,59.1,1,91.5,47.9,1
9bd30918-0bdb-4182-9fbd-67d6cbe1dddb,2026-07-14,San Isidro - A,no_cumplido,cumplido,cumplido,60,101,estimada_geometria,7924,9891,96.2,71.8,0.993,96.2,60.5,0.993
0b989f27-7204-436e-8642-c2cb3dcb5c6c,2026-07-14,Sanders - A,no_cumplido,no_cumplido,no_cumplido,60,76,estimada_geometria,7924,8904,93.8,58.5,1,93.8,52.7,1
faba2f0a-c7b8-4a02-88b8-1db1205845f9,2026-07-14,Sierra Vista - A,no_cumplido,cumplido,no_cumplido,60,128,estimada_geometria,7924,10555,81,60.8,0.937,84.4,47.8,1
f007e8a6-b45f-44d6-9d62-f73c744c9705,2026-07-14,Huertas - B,no_cumplido,no_cumplido,cumplido,60,111,estimada_geometria,5971,8066,87.1,91.5,0.628,91.6,94.3,1
18b73c29-3f09-4df8-b7db-5f044547f837,2026-07-14,Juarez Nuevo - B,no_cumplido,no_cumplido,cumplido,60,76,estimada_geometria,5971,6773,81.6,95.8,0.8,77.4,91.2,1
911de9a3-db29-4b44-a6b6-fbbec46cda42,2026-07-14,Km 30 - B,no_cumplido,cumplido,cumplido,60,121,estimada_geometria,5971,8428,80.9,91.6,1,89.3,61.9,1
e86b0c89-c6f6-4ddc-bf05-bd5e97516ced,2026-07-14,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,5971,7243,71.6,83.7,1,71.6,82.2,1
1cfc4e6a-6ec0-41ab-8c3c-6556c2d91b89,2026-07-14,San Jose - B,no_cumplido,cumplido,cumplido,60,120,estimada_geometria,5971,8391,86,87,0.898,87.6,72.5,1
c066040d-bd3c-4a82-8893-94c3dde97dbd,2026-07-14,San Jose Auxiliar - B,no_cumplido,no_cumplido,cumplido,60,136,estimada_geometria,5971,8968,77.2,90.3,0.74,75.7,86.4,0.873
0ff9ac7b-4798-440b-ab42-b73a3e167f97,2026-07-15,Centro - A,no_cumplido,no_cumplido,no_cumplido,60,67,estimada_geometria,8271,8766,74.1,40.2,1,74.1,36.6,1
305ab9b9-bf93-4fd1-aef7-d8e43bb2b653,2026-07-15,Colinas - A,no_cumplido,cumplido,cumplido,60,98,estimada_geometria,8271,10144,98.1,71,1,98.1,62.3,1
053d8d2b-dd59-481f-981a-7b180272a691,2026-07-15,Finca - A,no_cumplido,no_cumplido,no_cumplido,60,105,estimada_geometria,8271,10362,88.9,52.5,1,88.9,44.8,1
17d0e667-0a34-4793-8134-7849abf534ae,2026-07-15,Finca Auxiliar - A,no_cumplido,cumplido,cumplido,60,108,estimada_geometria,8271,10435,97.2,67.1,1,97.2,66.7,1
f0b106bd-272d-48ee-b0fe-d77b366ff8cf,2026-07-15,Juarez Nuevo - A,no_cumplido,no_cumplido,no_cumplido,60,73,estimada_geometria,8271,9119,87.2,57.7,1,87.2,51.3,1
be847b07-5749-4b81-9034-39e572763845,2026-07-15,Km 20 - A,no_cumplido,no_cumplido,no_cumplido,60,60,estimada_geometria,8271,8271,74.2,47.4,1,74.2,47.4,1
8fdf8383-41e4-4f1e-a25d-d0efbfdc6eb5,2026-07-15,Km 30 - A,no_cumplido,cumplido,no_cumplido,60,130,estimada_geometria,8271,11011,87.6,60.8,0.959,88.9,50,1
66754750-9e00-4d3b-b42f-35a625a4bf59,2026-07-15,Oasis - A,no_cumplido,cumplido,cumplido,60,91,estimada_geometria,8271,9925,99.2,77.6,0.982,99.2,72.2,1
fde80423-17a9-45a7-b049-971dd5b5e36c,2026-07-15,Parajes del Sur - A,no_cumplido,no_cumplido,no_cumplido,60,117,estimada_geometria,8271,10675,56.5,46.4,0.923,66.3,39.1,0.923
0eb1cb8b-ebba-4d85-bd91-860de78d5a35,2026-07-15,Riveras 7 - A,no_cumplido,no_cumplido,cumplido,60,94,estimada_geometria,8271,10020,64.3,58.6,0.962,65.6,69,1
dde038b9-3c3a-4940-83ca-65bb4339e72e,2026-07-15,Riveras 9 - A,no_cumplido,cumplido,cumplido,60,83,estimada_geometria,8271,9599,79.8,71.3,0.974,79.8,60,0.974
e49110ae-cab2-4666-beff-1ab5c082b34c,2026-07-15,Safari - A,no_cumplido,cumplido,no_cumplido,60,81,estimada_geometria,8271,9516,90.1,67.2,1,90.1,58.9,1
b4f6380e-3094-4f56-88fd-82c4696a6470,2026-07-15,San Isidro - A,no_cumplido,cumplido,no_cumplido,60,101,estimada_geometria,8271,10238,92.5,65.7,1,92.5,57.2,1
e5f126f3-e039-4cc2-bbcc-978e7b617370,2026-07-15,Sanders - A,no_cumplido,cumplido,no_cumplido,60,76,estimada_geometria,8271,9273,98.8,61.3,1,98.8,54.5,1
48612d9e-64f6-4449-9982-851e8b61ef76,2026-07-15,Sierra Vista - A,no_cumplido,no_cumplido,cumplido,60,128,estimada_geometria,8271,10960,86.4,63.9,0.844,88.3,60.3,1
e53badc9-0823-4848-937f-d3218dccb559,2026-07-15,Huertas - B,no_cumplido,no_cumplido,cumplido,60,111,estimada_geometria,6980,9457,93.1,87,0.653,93.2,89,1
dba69de5-6a6f-4ace-9706-eeccba44015a,2026-07-15,Juarez Nuevo - B,no_cumplido,no_cumplido,cumplido,60,76,estimada_geometria,6980,7871,88.6,88.9,0.784,83.1,89.3,1
20523028-d7d0-46c9-b455-20864591949d,2026-07-15,Km 30 - B,no_cumplido,cumplido,no_cumplido,60,121,estimada_geometria,6980,9831,81.7,81.5,0.884,95.8,73,0.201
027c0120-a8b4-4b91-8f3a-4f70a202ba6c,2026-07-15,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,6980,8308,79.7,85.7,1,79.7,76.1,1
06d9aec8-c816-452a-8918-1768dbaf151c,2026-07-15,San Jose - B,no_cumplido,cumplido,cumplido,60,120,estimada_geometria,6980,9792,78.8,82.2,0.894,86.7,61.8,1
f20d4242-361f-488a-8cf2-9382bf74ed80,2026-07-15,San Jose Auxiliar - B,no_cumplido,no_cumplido,cumplido,60,136,estimada_geometria,6980,10369,82.3,91.7,0.814,85.5,90.4,0.873
e71cf5ea-27eb-49f8-a341-22d116ff0a26,2026-07-16,Centro - A,no_cumplido,no_cumplido,no_cumplido,60,67,estimada_geometria,7867,8307,76.1,40.2,1,76.1,37,1
6fbb799d-127f-419d-8fbb-7a2b8be7b639,2026-07-16,Colinas - A,no_cumplido,cumplido,cumplido,60,98,estimada_geometria,7867,9654,99.1,71.1,1,99.1,61.2,1
821c3594-404d-41b7-90d4-a4aabb3412c3,2026-07-16,Finca - A,no_cumplido,no_cumplido,no_cumplido,60,105,estimada_geometria,7867,9851,84.8,53.2,1,84.8,48.5,1
ac0c8148-04ee-4212-8e1c-2730c16c4d09,2026-07-16,Finca Auxiliar - A,no_cumplido,cumplido,no_cumplido,60,108,estimada_geometria,7867,9933,98.6,76.4,1,98.6,56.3,1
f7c0b9be-a164-4907-b7d0-10e462160971,2026-07-16,Juarez Nuevo - A,no_cumplido,no_cumplido,no_cumplido,60,73,estimada_geometria,7867,8639,86.1,56.8,1,86.1,50.7,1
2eb3e2a4-3823-41fb-b434-ea9699cf3812,2026-07-16,Km 20 - A,no_cumplido,no_cumplido,no_cumplido,60,60,estimada_geometria,7867,7867,89.2,52.1,0.994,89.2,52.1,0.994
6f20ad74-2051-4de7-b5fd-719a69370418,2026-07-16,Km 30 - A,no_cumplido,cumplido,no_cumplido,60,130,estimada_geometria,7867,10501,86.5,67.6,0.95,91.4,53,1
da7f0de2-ffb2-452b-8227-392a2da078e5,2026-07-16,Oasis - A,no_cumplido,cumplido,cumplido,60,91,estimada_geometria,7867,9390,99.2,73.8,0.972,99.2,67.4,1
edeec991-6fc4-4f4e-9ca5-27244399100a,2026-07-16,Parajes del Sur - A,no_cumplido,no_cumplido,no_cumplido,60,117,estimada_geometria,7867,10161,84.2,55,0.88,85.7,44,0.907
a209c9b5-ed9e-4352-a823-2cb15f5f19f4,2026-07-16,Riveras 7 - A,no_cumplido,no_cumplido,no_cumplido,60,94,estimada_geometria,7867,9510,68.2,44,0.962,69.4,57.3,1
4f33695b-95e8-4f2e-b82a-ef0d078d2712,2026-07-16,Riveras 9 - A,no_cumplido,no_cumplido,no_cumplido,60,83,estimada_geometria,7867,9117,78.7,49.4,0.974,78.7,39.7,0.974
97151624-577a-4269-aeaa-5075764b406a,2026-07-16,Safari - A,no_cumplido,cumplido,no_cumplido,60,81,estimada_geometria,7867,9027,90.1,61.7,1,90.1,53.3,1
5a4ecb78-db7f-475d-9e86-ddd4393f62a1,2026-07-16,San Isidro - A,no_cumplido,cumplido,cumplido,60,101,estimada_geometria,7867,9742,93.4,70,0.993,93.4,63,0.993
b7a3c0dd-d6bc-4c35-adc4-368097016246,2026-07-16,Sanders - A,no_cumplido,no_cumplido,no_cumplido,60,76,estimada_geometria,7867,8792,97.5,55.6,1,97.5,50.3,1
f9601310-1dbe-49e5-8ba6-42598cff41e6,2026-07-16,Sierra Vista - A,no_cumplido,no_cumplido,no_cumplido,60,128,estimada_geometria,7867,10449,60.5,58.9,0.964,61.7,48.1,1
2a002f39-9e59-4eee-ab6f-291e97bf7377,2026-07-16,Huertas - B,no_cumplido,no_cumplido,cumplido,60,111,estimada_geometria,6947,9329,94.1,100,0.186,93.7,88.8,1
14d53ded-2b09-4371-8f06-51999b9e6660,2026-07-16,Juarez Nuevo - B,no_cumplido,cumplido,cumplido,60,76,estimada_geometria,6947,7837,90.6,90.1,0.852,83.8,84.8,1
e387b327-9fd5-4d46-9a5b-c6c2638f0947,2026-07-16,Km 30 - B,no_cumplido,cumplido,cumplido,60,121,estimada_geometria,6947,9691,81,97,0.864,87.8,72.6,1
b8f9434d-68d5-4580-8d2c-c7c327c0ef91,2026-07-16,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,6947,8315,82.4,85.5,1,82.4,78.5,1
ee9548b4-023f-4f5b-ac78-9efec7200560,2026-07-16,San Jose - B,no_cumplido,cumplido,cumplido,60,120,estimada_geometria,6947,9662,73.7,78.3,0.858,81.9,64.1,1
97565de2-d6e7-4bbb-afde-f4439fa86d5c,2026-07-16,San Jose Auxiliar - B,no_cumplido,no_cumplido,cumplido,60,136,estimada_geometria,6947,10219,86.4,89,0.753,82.9,87.2,0.873
8a0f0ec0-0b08-4919-a5eb-ad3e39643956,2026-07-17,Centro - A,no_cumplido,no_cumplido,no_cumplido,60,67,estimada_geometria,7855,8318,66.1,36.7,1,66.1,33.3,1
6e526e7f-9d43-4bdd-b8e4-8734201eeb7b,2026-07-17,Colinas - A,no_cumplido,cumplido,cumplido,60,98,estimada_geometria,7855,9636,98.1,71.9,1,98.1,63.5,1
fb0aa2cc-60dd-4ac4-a759-3b394e2544ce,2026-07-17,Finca - A,no_cumplido,no_cumplido,no_cumplido,60,105,estimada_geometria,7855,9832,88.9,56.3,1,88.9,42.1,1
9bb57d27-1b99-41d6-87d8-de031318e74a,2026-07-17,Finca Auxiliar - A,no_cumplido,cumplido,cumplido,60,108,estimada_geometria,7855,9904,100,72.4,1,100,67.1,1
ca4c3485-c95e-4bbe-bef9-33cabede0bc2,2026-07-17,Juarez Nuevo - A,no_cumplido,no_cumplido,no_cumplido,60,73,estimada_geometria,7855,8666,86.1,48.4,1,86.1,43.3,1
034d2b75-0038-42d1-bb61-35ec1754afe7,2026-07-17,Km 20 - A,no_cumplido,no_cumplido,no_cumplido,60,60,estimada_geometria,7855,7855,86.3,47.8,1,86.3,47.8,1
1feae473-437f-4432-950c-ff4c05abe4d3,2026-07-17,Km 30 - A,no_cumplido,cumplido,cumplido,60,130,estimada_geometria,7855,10457,86.3,72.8,1,87.2,62.6,1
08671695-5773-451c-94ce-f0e3614790ba,2026-07-17,Oasis - A,no_cumplido,cumplido,cumplido,60,91,estimada_geometria,7855,9427,97.5,81.4,0.972,97.5,73.8,1
f81d4f26-7a4f-4555-84e6-31c55c690463,2026-07-17,Parajes del Sur - A,no_cumplido,no_cumplido,no_cumplido,60,117,estimada_geometria,7855,10139,54,54.8,0.923,65.5,47.2,0.923
1d239686-a1ac-4534-b9c5-764ceaa16a6b,2026-07-17,Riveras 7 - A,no_cumplido,no_cumplido,no_cumplido,60,94,estimada_geometria,7855,9516,58.5,58.5,0.962,60.1,58,1
c73a6f3e-3dc6-476e-bbd5-24b90f4bbde5,2026-07-17,Riveras 9 - A,no_cumplido,cumplido,no_cumplido,60,83,estimada_geometria,7855,9116,73,60.6,0.974,73,51.9,0.974
35887ae4-88a3-4554-ab47-784e0130cee5,2026-07-17,Safari - A,no_cumplido,cumplido,no_cumplido,60,81,estimada_geometria,7855,9029,90.1,66.1,1,90.1,53.1,1
6010dd97-4353-4099-ad7a-4c0d1602bd69,2026-07-17,San Isidro - A,no_cumplido,cumplido,no_cumplido,60,101,estimada_geometria,7855,9726,96.2,65.6,0.993,96.2,55.6,0.993
7b604b83-07b5-4c2e-853a-0e5ecd4476ca,2026-07-17,Sanders - A,no_cumplido,no_cumplido,no_cumplido,60,76,estimada_geometria,7855,8809,93.8,55.9,1,93.8,50,1
00b8975d-409e-4830-ba87-3fcb6cddd447,2026-07-17,Sierra Vista - A,no_cumplido,no_cumplido,no_cumplido,60,128,estimada_geometria,7855,10407,87.9,59.7,0.86,89.1,48.9,1
bca777d3-f7ab-42c7-99fc-5d26f4ed5542,2026-07-17,Huertas - B,no_cumplido,no_cumplido,cumplido,60,111,estimada_geometria,6892,9227,94.8,91.3,0.638,96.3,91.5,1
78ab55f4-34a4-4532-b2b9-e6c6c4c5ac4a,2026-07-17,Juarez Nuevo - B,no_cumplido,no_cumplido,cumplido,60,76,estimada_geometria,6892,7656,89.6,90.2,0.776,82.7,91.7,0.965
03fdaa73-8f5b-46e4-bcf8-84ae3f12f1eb,2026-07-17,Km 30 - B,no_cumplido,cumplido,cumplido,60,121,estimada_geometria,6892,9632,88.1,94.4,0.896,92.4,70,1
c819f9ce-5a59-4ff9-8515-f42bd7b1a755,2026-07-17,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,6892,8094,81.1,85.5,1,81.1,78.3,1
62121e47-c7d3-4fc7-a320-b3df0db51852,2026-07-17,San Jose - B,no_cumplido,cumplido,cumplido,60,120,estimada_geometria,6892,9598,83.7,87.2,0.898,85.7,65.2,1
7b9470c1-c3fb-434f-8265-e9e0a8d843b9,2026-07-17,San Jose Auxiliar - B,no_cumplido,no_cumplido,cumplido,60,136,estimada_geometria,6892,10169,77,88.1,0.804,80.9,85.4,0.873
e3c3051c-4b4a-4db8-b048-4897bf7a3fcc,2026-07-20,Centro - A,no_cumplido,no_cumplido,no_cumplido,60,67,estimada_geometria,7707,8226,72.1,39.4,1,72.1,36.6,1
eefef684-8fcb-40e6-9b58-b8d035db3600,2026-07-20,Colinas - A,no_cumplido,cumplido,cumplido,60,98,estimada_geometria,7707,9734,100,69.3,1,100,60.7,1
56d94e30-96e7-488f-a233-39c21e5b65cf,2026-07-20,Finca - A,no_cumplido,cumplido,no_cumplido,60,105,estimada_geometria,7707,9946,90.9,77,1,90.9,59.5,1
30ffdf9b-d8c1-494e-ab35-b1f3cc366a42,2026-07-20,Finca Auxiliar - A,no_cumplido,no_cumplido,no_cumplido,60,108,estimada_geometria,7707,10029,64.3,46.4,0.813,73.7,39.2,0.907
6fa7c392-750f-487f-be1e-8708fab3074f,2026-07-20,Juarez Nuevo - A,no_cumplido,no_cumplido,no_cumplido,60,73,estimada_geometria,7707,8604,85.1,49.5,1,85.1,44.7,1
c3b57939-40d3-4e3b-9e41-27e0915d20a7,2026-07-20,Km 20 - A,no_cumplido,no_cumplido,no_cumplido,60,60,estimada_geometria,7707,7707,87.9,48.5,1,87.9,48.5,1
6dacb332-d9dc-416b-83c4-a32cc97e26b7,2026-07-20,Km 30 - A,no_cumplido,cumplido,cumplido,60,130,estimada_geometria,7707,10596,91.6,75.8,0.969,91.4,67.5,1
c261d1b0-d401-4f04-8eb5-fff6a00f669d,2026-07-20,Oasis - A,no_cumplido,cumplido,cumplido,60,91,estimada_geometria,7707,9493,96.7,74.2,0.982,98.4,68.9,1
1977727b-2131-4c7b-9705-1a595decf616,2026-07-20,Parajes del Sur - A,no_cumplido,no_cumplido,no_cumplido,60,117,estimada_geometria,7707,10261,44.6,30.3,0.813,29.7,37.2,0.952
28a348e1-3f8b-423d-9c0f-d711f8952f85,2026-07-20,Riveras 7 - A,no_cumplido,no_cumplido,no_cumplido,60,94,estimada_geometria,7707,9607,51.8,57,0.962,53.6,55.9,1
8e81cb17-e2d8-4a60-8567-9ebd18e8e680,2026-07-20,Riveras 9 - A,no_cumplido,cumplido,no_cumplido,60,83,estimada_geometria,7707,9127,79.8,67.9,0.974,79.8,55.3,0.974
b0786e92-38a9-415c-ba5c-3d095e4fc9ed,2026-07-20,Safari - A,no_cumplido,cumplido,no_cumplido,60,81,estimada_geometria,7707,9028,91.5,64,1,91.5,51.9,1
e9c40af4-8225-4bc8-8aca-89e9ad0d90d4,2026-07-20,San Isidro - A,no_cumplido,cumplido,no_cumplido,60,101,estimada_geometria,7707,9823,88.8,66.9,1,88.8,58.5,1
c3c67c0f-2f20-4e62-a5ad-0838600213fe,2026-07-20,Sanders - A,no_cumplido,cumplido,no_cumplido,60,76,estimada_geometria,7707,8765,97.5,61.5,1,97.5,54.7,1
1d4b196c-35fa-447e-90a8-46077112b7ef,2026-07-20,Sierra Vista - A,no_cumplido,no_cumplido,no_cumplido,60,128,estimada_geometria,7707,10545,90.3,55.6,0.844,92.2,48.3,1
4a2982c4-388f-4371-bf35-4a8108cb3cfe,2026-07-20,Huertas - B,no_cumplido,no_cumplido,cumplido,60,111,estimada_geometria,7302,9742,96,89.8,0.649,95.8,91.6,1
4252f442-9027-43dd-bd97-dcdfffb86ef2,2026-07-20,Juarez Nuevo - B,no_cumplido,no_cumplido,cumplido,60,76,estimada_geometria,7302,8200,94.8,96.2,0.784,85.2,96.8,1
9218d65a-5b19-48a7-8e03-968907d0c358,2026-07-20,Km 30 - B,no_cumplido,cumplido,cumplido,60,121,estimada_geometria,7302,10092,85.3,94.7,0.854,82.4,81.6,1
72f38ebd-9443-463e-bc10-07adcc91bf3a,2026-07-20,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,7302,8680,81.1,87.9,1,81.1,69,1
c71ddf28-07d6-4c2a-aa27-a386a79d1855,2026-07-20,San Jose - B,no_cumplido,cumplido,cumplido,60,120,estimada_geometria,7302,10053,84.9,86.8,0.898,87.6,71.5,1
a8ce43f3-7b54-469f-8076-22fae15511a4,2026-07-20,San Jose Auxiliar - B,no_cumplido,no_cumplido,cumplido,60,136,estimada_geometria,7302,10599,92.5,95.7,0.72,92.1,76.9,0.873
9a6c2f28-7660-48fa-ae13-3aa7a54a5438,2026-07-21,Centro - A,no_cumplido,no_cumplido,no_cumplido,60,67,estimada_geometria,7744,8218,76.1,39.1,1,76.1,36.1,1
80d1896c-9079-440d-89e7-de51fd94ef4d,2026-07-21,Colinas - A,no_cumplido,cumplido,cumplido,60,98,estimada_geometria,7744,9621,99.1,78.5,1,99.1,68.7,1
1c4a0ef7-0ffc-4b2a-aac0-b9997295d9fa,2026-07-21,Finca - A,no_cumplido,no_cumplido,no_cumplido,60,105,estimada_geometria,7744,9817,83.3,54,0.99,83.3,47.5,0.99
2e842672-11aa-47f3-ac25-c4dfa881afc2,2026-07-21,Finca Auxiliar - A,no_cumplido,cumplido,no_cumplido,60,108,estimada_geometria,7744,9893,100,68.9,0.982,100,57.4,1
5ce2a53f-24cc-47c6-bf75-2d508f12e5f7,2026-07-21,Juarez Nuevo - A,no_cumplido,cumplido,no_cumplido,60,73,estimada_geometria,7744,8553,84.9,61.4,0.997,85.1,55.4,1
284623b3-e84e-4655-a4d2-2e82856a9cb5,2026-07-21,Km 20 - A,no_cumplido,cumplido,cumplido,60,60,estimada_geometria,7744,7744,86.3,60.3,1,86.3,60.3,1
8e310080-3c8e-40e1-9b52-8de3cdc4de37,2026-07-21,Km 30 - A,no_cumplido,cumplido,no_cumplido,60,130,estimada_geometria,7744,10450,72.6,73.3,1,78.6,53.7,1
92e62f50-5167-4443-b54b-cb39b6468692,2026-07-21,Oasis - A,no_cumplido,cumplido,cumplido,60,91,estimada_geometria,7744,9376,94.3,73,0.982,94.3,68.2,1
039462a8-014c-41f3-9d9b-a77e1262f632,2026-07-21,Parajes del Sur - A,no_cumplido,no_cumplido,no_cumplido,60,117,estimada_geometria,7744,10121,46.8,42.5,0.966,46.8,37.4,0.966
0d771144-d739-48a8-a309-eec19d6d7dea,2026-07-21,Riveras 7 - A,no_cumplido,no_cumplido,cumplido,60,94,estimada_geometria,7744,9478,58.5,68,0.962,60.1,61.5,1
09fa0795-2c5b-4eed-8ee2-88aa0f202427,2026-07-21,Riveras 9 - A,no_cumplido,cumplido,no_cumplido,60,83,estimada_geometria,7744,9032,76.4,65.3,0.974,76.4,52.1,0.974
4cdfe57b-0998-4e76-b626-d65923fb51eb,2026-07-21,Safari - A,cumplido,cumplido,no_cumplido,60,81,estimada_geometria,7744,8947,91.5,68.3,1,91.5,52.3,1
41bf757e-c1a5-4cb5-bc72-3c4f2d5e406c,2026-07-21,San Isidro - A,no_cumplido,cumplido,no_cumplido,60,101,estimada_geometria,7744,9709,94.4,64.1,1,94.4,57.4,1
8e727e47-da86-46a3-9abe-864062f6f4f7,2026-07-21,Sanders - A,no_cumplido,no_cumplido,no_cumplido,60,76,estimada_geometria,7744,8696,47.4,47.3,0.871,47.4,45.3,0.871
e48a41e2-309c-45a0-ad1b-da4561a1e059,2026-07-21,Sierra Vista - A,no_cumplido,no_cumplido,no_cumplido,60,128,estimada_geometria,7744,10400,84.5,56.4,0.844,86.7,47.9,1
1f49106c-35e3-4d3f-874f-3a5e0a04803c,2026-07-21,Huertas - B,no_cumplido,no_cumplido,cumplido,60,111,estimada_geometria,7303,9913,88.6,86.3,0.617,85.8,88.6,1
ca5a63cf-c2e2-4683-a537-4947da049679,2026-07-21,Juarez Nuevo - B,no_cumplido,cumplido,cumplido,60,76,estimada_geometria,7303,8243,87.7,96.2,0.947,88.7,96.8,1
fd559446-0c55-466f-8941-6ff7e827234c,2026-07-21,Km 30 - B,no_cumplido,cumplido,cumplido,60,121,estimada_geometria,7303,10351,89.6,94.3,0.889,93.9,71.6,1
ed9b9ebb-a031-421e-b184-903521d6b1fe,2026-07-21,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,7303,8805,89.2,84.4,1,89.2,71.4,1
4df709e3-2535-45f4-8bb2-e1499d8bb7ff,2026-07-21,San Jose - B,no_cumplido,cumplido,cumplido,60,120,estimada_geometria,7303,10306,84.9,84.2,0.898,87.6,67.5,1
f489bb46-f262-4f72-9c1e-ab883ecab91a,2026-07-21,San Jose Auxiliar - B,no_cumplido,no_cumplido,cumplido,60,136,estimada_geometria,7303,10911,85.6,91.4,0.753,82.2,88.5,0.873
8ce66503-68d6-4837-8716-e73d24ceba37,2026-07-22,Centro - A,no_cumplido,no_cumplido,no_cumplido,60,67,estimada_geometria,7922,8379,76.1,39.6,1,76.1,36.1,1
13e6daa3-d634-4fa6-95c1-c2967f5537af,2026-07-22,Colinas - A,no_cumplido,cumplido,no_cumplido,60,98,estimada_geometria,7922,9708,100,71,1,79.7,71.8,0.839
8962bafc-d19e-45fe-9747-8e81982a52af,2026-07-22,Finca - A,no_cumplido,cumplido,cumplido,60,105,estimada_geometria,7922,9904,99,76.2,1,99,69.8,1
661841ba-e987-4cdd-9ee3-1e08fb74a63e,2026-07-22,Finca Auxiliar - A,no_cumplido,no_cumplido,no_cumplido,60,108,estimada_geometria,7922,9985,91.4,54.2,0.982,88.4,41.9,0.83
33ef76a6-8601-46cc-93e0-8c6f55f90dbc,2026-07-22,Juarez Nuevo - A,no_cumplido,cumplido,no_cumplido,60,73,estimada_geometria,7922,8734,86.9,61.9,0.988,87.2,56.9,1
a2aaed4e-19a1-41ee-ad3b-cdae20100270,2026-07-22,Km 20 - A,no_cumplido,no_cumplido,no_cumplido,60,60,estimada_geometria,7922,7922,91.7,44.4,0.972,91.7,44.4,0.972
4a101266-647a-4e93-a848-ce1bd909510d,2026-07-22,Km 30 - A,no_cumplido,cumplido,no_cumplido,60,130,estimada_geometria,7922,10568,83.4,70.1,0.991,86.3,55.5,1
a6215a7f-8720-443d-9853-6030c89f9fc8,2026-07-22,Oasis - A,no_cumplido,cumplido,cumplido,60,91,estimada_geometria,7922,9491,96.6,77.7,0.972,97.5,70.2,1
cb4ebfc6-d5ca-4dcf-bc5d-c7985a995e96,2026-07-22,Parajes del Sur - A,no_cumplido,no_cumplido,no_cumplido,60,117,estimada_geometria,7922,10226,54,50,0.923,65.5,45.3,0.923
f73e7345-3eda-4bd7-9c6e-0c1d5e377ece,2026-07-22,Riveras 7 - A,no_cumplido,cumplido,cumplido,60,94,estimada_geometria,7922,9594,62.4,63.6,0.962,63.8,62.3,1
4d667aa9-b455-410d-a877-c98bbdf8fcf3,2026-07-22,Riveras 9 - A,no_cumplido,no_cumplido,no_cumplido,60,83,estimada_geometria,7922,9197,69.7,53.7,0.974,69.7,45.2,0.974
0fb5d23c-52fa-4ce8-aac5-f0a2c9e7b709,2026-07-22,Safari - A,no_cumplido,cumplido,no_cumplido,60,81,estimada_geometria,7922,9115,91.5,61.6,1,91.5,49.3,1
4f6996e8-508a-4f63-bc38-835624bfab46,2026-07-22,San Isidro - A,no_cumplido,cumplido,cumplido,60,101,estimada_geometria,7922,9792,95.3,68.2,1,95.3,63,1
6cf2000a-0951-4593-b38d-c0ec47a5611a,2026-07-22,Sanders - A,no_cumplido,no_cumplido,no_cumplido,60,76,estimada_geometria,7922,8878,96.3,51.4,1,96.3,44.7,1
331d3d68-61e8-4f80-97d3-905182c14f07,2026-07-22,Sierra Vista - A,no_cumplido,no_cumplido,no_cumplido,60,128,estimada_geometria,7922,10517,90.3,56.5,0.844,91.4,48.6,1
6ff58edb-dde9-472e-ad5e-b9271410ff72,2026-07-22,Huertas - B,no_cumplido,no_cumplido,cumplido,60,111,estimada_geometria,6720,9029,89.4,100,0.22,93.2,86.7,1
c5e6d878-8819-4cf4-9a0e-53bd3cdb1b69,2026-07-22,Juarez Nuevo - B,no_cumplido,cumplido,cumplido,60,76,estimada_geometria,6720,7529,95.3,92.3,0.852,87.3,93.3,1
d1ba9005-14e8-4951-90ee-7e259a57312f,2026-07-22,Km 30 - B,no_cumplido,no_cumplido,cumplido,60,121,estimada_geometria,6720,9378,92.2,100,0.232,89.3,75.7,1
6cb50a8a-cb05-42c7-8754-ff4c8ce2ee2d,2026-07-22,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,6720,7983,79.7,85.2,1,79.7,72.2,1
1135b562-ac83-4587-9e4a-cf29c132664d,2026-07-22,San Jose - B,no_cumplido,cumplido,cumplido,60,120,estimada_geometria,6720,9348,83.7,83.8,0.898,87.6,74.8,1
eb3ed7a4-c75f-4d25-9d51-8dd64141a799,2026-07-22,San Jose Auxiliar - B,no_cumplido,no_cumplido,cumplido,60,136,estimada_geometria,6720,9830,86.4,92.3,0.753,84.7,66.5,0.953
6617e432-2ccc-4705-b45d-417158df29fd,2026-07-23,Centro - A,no_cumplido,no_cumplido,no_cumplido,60,67,estimada_geometria,7710,8128,72.1,38.9,1,72.1,35.2,1
daec7520-326c-4b91-bb33-1ba293f1bc5a,2026-07-23,Colinas - A,no_cumplido,cumplido,cumplido,60,98,estimada_geometria,7710,9385,99.1,71.4,1,99.1,62.6,1
a33f9628-87a7-42e2-8bdd-a9b7af675cb6,2026-07-23,Finca - A,no_cumplido,cumplido,cumplido,60,105,estimada_geometria,7710,9582,100,70,1,100,68,1
eb7fcc76-7b5f-4de7-8e96-3ccad23741af,2026-07-23,Finca Auxiliar - A,no_cumplido,cumplido,no_cumplido,60,108,estimada_geometria,7710,9664,98.6,70.4,1,98.6,49.8,1
2c10bd94-815a-4f05-bfbb-105ccc9d24f5,2026-07-23,Juarez Nuevo - A,no_cumplido,no_cumplido,no_cumplido,60,73,estimada_geometria,7710,8466,85.1,55.9,1,85.1,50.2,1
569ec881-24c8-49cd-bdc2-12d49a267733,2026-07-23,Km 20 - A,no_cumplido,no_cumplido,no_cumplido,60,60,estimada_geometria,7710,7710,87.9,55.9,1,87.9,55.9,1
eab69015-5f66-49d3-b622-ccf367520589,2026-07-23,Km 30 - A,no_cumplido,no_cumplido,no_cumplido,60,130,estimada_geometria,7710,10215,63.4,81.1,1,63.4,71,1
d75ed756-714e-4505-b217-d30383fdac03,2026-07-23,Oasis - A,no_cumplido,cumplido,cumplido,60,91,estimada_geometria,7710,9178,95.9,69.4,1,97.5,65.7,1
b1b114e5-38e7-46e8-a942-3100569f8a75,2026-07-23,Parajes del Sur - A,no_cumplido,no_cumplido,no_cumplido,60,117,estimada_geometria,7710,9893,63.7,42.9,0.867,67.2,38.9,0.907
420e4e4e-99d4-414e-b1f9-7b3f8068ad7f,2026-07-23,Riveras 7 - A,no_cumplido,cumplido,cumplido,60,94,estimada_geometria,7710,9262,65.3,64,0.962,66.6,61.4,1
04163c9d-171e-4201-a32a-38274cfb5ea8,2026-07-23,Riveras 9 - A,no_cumplido,no_cumplido,no_cumplido,60,83,estimada_geometria,7710,8891,68.5,55.8,0.974,69.7,46.6,0.974
96ebda1d-df35-421a-8797-8c047b6d3218,2026-07-23,Safari - A,no_cumplido,no_cumplido,no_cumplido,60,81,estimada_geometria,7710,8818,88.7,55.4,1,88.7,49.8,1
b5e21ff8-6657-43ab-a71b-a50c34c1bc1a,2026-07-23,San Isidro - A,no_cumplido,cumplido,no_cumplido,60,101,estimada_geometria,7710,9474,91.6,62.8,1,91.6,55.7,1
1875af59-bac2-431a-bac7-6c568d2c12fa,2026-07-23,Sanders - A,no_cumplido,cumplido,no_cumplido,60,76,estimada_geometria,7710,8603,97.5,60.7,1,97.5,52.8,1
d9b40669-da30-460a-bd37-c70fddd60d3d,2026-07-23,Sierra Vista - A,no_cumplido,cumplido,no_cumplido,60,128,estimada_geometria,7710,10166,91.4,60.8,0.854,92.2,51.4,1
7531c9aa-5ab0-4e48-80e7-ae4d39111caa,2026-07-23,Huertas - B,no_cumplido,no_cumplido,cumplido,60,111,estimada_geometria,7075,9310,94.2,100,0.656,94.8,93.1,1
941fed48-374a-41c9-80ef-464973ec5612,2026-07-23,Juarez Nuevo - B,no_cumplido,cumplido,cumplido,60,76,estimada_geometria,7075,7882,95.3,96.7,0.852,85.9,91.3,1
d4ffdd71-b4ff-4cf2-862a-0774ea4c6881,2026-07-23,Km 30 - B,no_cumplido,cumplido,cumplido,60,121,estimada_geometria,7075,9639,79.7,84.1,0.987,87,68.6,1
5f29cba3-9460-41bc-822f-17d605850daa,2026-07-23,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,7075,8332,87.8,95.5,1,87.8,75.6,1
b84c9f43-2183-4cd4-bd39-b9c8249459e8,2026-07-23,San Jose - B,no_cumplido,cumplido,cumplido,60,120,estimada_geometria,7075,9607,83.7,84.2,0.898,85.7,72.5,1
0847810b-9ce9-4f44-9ec7-03ad59ceeffd,2026-07-23,San Jose Auxiliar - B,no_cumplido,cumplido,no_cumplido,60,136,estimada_geometria,7075,10102,88.2,84.5,0.873,88.2,58.2,0.873
a52d31c6-a025-4f71-b85b-a9367a374084,2026-07-24,Centro - A,no_cumplido,no_cumplido,no_cumplido,60,67,estimada_geometria,8086,8537,72.1,33.3,1,72.1,34,1
c15fbc32-7866-487c-8922-de3f50b8d2f1,2026-07-24,Colinas - A,no_cumplido,cumplido,cumplido,60,98,estimada_geometria,8086,9811,99.1,71.5,1,99.1,62.3,1
211eb018-0544-46a3-8cf4-b609096802b2,2026-07-24,Finca - A,no_cumplido,cumplido,cumplido,60,105,estimada_geometria,8086,9987,97,70.4,1,97,69.2,1
41141338-307c-4610-a9f3-18b6e1155384,2026-07-24,Finca Auxiliar - A,no_cumplido,no_cumplido,no_cumplido,60,108,estimada_geometria,8086,10058,93.1,50,1,95.3,46.2,0.83
453e55c7-88d1-4633-8c08-5c95fbb1b401,2026-07-24,Juarez Nuevo - A,no_cumplido,cumplido,cumplido,60,73,estimada_geometria,8086,8869,87.2,71.8,1,87.2,63.5,1
c031e55a-cc64-474d-9b09-9a5283e9799e,2026-07-24,Km 20 - A,no_cumplido,no_cumplido,no_cumplido,60,60,estimada_geometria,8086,8086,86.3,46.3,1,86.3,46.3,1
06f8a382-ce73-4d86-86e0-1c7fa548d054,2026-07-24,Km 30 - A,no_cumplido,cumplido,cumplido,60,130,estimada_geometria,8086,10591,73.5,85.3,1,73.5,71.1,1
5908bc13-77ab-4cfc-a14d-457907c21661,2026-07-24,Oasis - A,no_cumplido,cumplido,cumplido,60,91,estimada_geometria,8086,9597,94.9,82.8,0.972,99.2,76.6,1
57ea6a6c-f399-4f15-8d00-453f5ca71cad,2026-07-24,Parajes del Sur - A,no_cumplido,no_cumplido,no_cumplido,60,117,estimada_geometria,8086,10278,75.4,52.8,0.923,86,47.2,0.923
099bb200-5074-4dea-af9b-04acb8530210,2026-07-24,Riveras 7 - A,no_cumplido,cumplido,cumplido,60,94,estimada_geometria,8086,9688,63.3,61.1,0.962,64.7,62.5,1
1c71e987-d941-4f4e-8b20-50024544c560,2026-07-24,Riveras 9 - A,no_cumplido,no_cumplido,no_cumplido,60,83,estimada_geometria,8086,9340,77.5,50,0.974,77.5,44,0.974
553687e1-ff59-4f2f-9033-aa5b4a8a045b,2026-07-24,Safari - A,no_cumplido,no_cumplido,no_cumplido,60,81,estimada_geometria,8086,9265,91.5,51.2,1,91.5,46.1,1
f47c5976-b133-44c3-af2d-ab70b107f72e,2026-07-24,San Isidro - A,no_cumplido,cumplido,cumplido,60,101,estimada_geometria,8086,9887,96.3,69.5,1,96.3,61.2,1
2696e40f-901b-48c7-b54c-b40d62ce21a4,2026-07-24,Sanders - A,no_cumplido,no_cumplido,no_cumplido,60,76,estimada_geometria,8086,9030,93.8,46.5,1,93.8,42.6,1
93c2b650-fe7c-43a8-b0c7-0a6f75a25fc6,2026-07-24,Sierra Vista - A,no_cumplido,no_cumplido,no_cumplido,60,128,estimada_geometria,8086,10543,85.4,57.3,0.844,88.2,48,0.988
0fe379e1-38b6-4611-9487-67e94034b6b6,2026-07-24,Huertas - B,no_cumplido,no_cumplido,cumplido,60,111,estimada_geometria,6728,9036,92.8,87.4,0.64,93.2,83.3,1
860db06b-20ec-422e-9eb7-e558b799fa7e,2026-07-24,Juarez Nuevo - B,no_cumplido,no_cumplido,cumplido,60,76,estimada_geometria,6728,7529,78.3,93.5,0.784,72.5,95.1,1
dcf32eb7-d75a-4b45-a61d-baa99f483e34,2026-07-24,Km 30 - B,no_cumplido,no_cumplido,cumplido,60,121,estimada_geometria,6728,9363,91.1,100,0.798,83.3,67.6,0.924
a044ff4a-c41d-4d07-becf-4eb2a4677d3d,2026-07-24,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,6728,7996,75.7,83.3,1,75.7,71.7,1
afa6f30e-ddb0-42b2-bf2c-f306227a2830,2026-07-24,San Jose - B,no_cumplido,no_cumplido,no_cumplido,60,120,estimada_geometria,6728,9333,83,86.9,0.273,77.7,62.7,0.585
7845d620-2e66-4e36-b998-5b8c435c3b1f,2026-07-24,San Jose Auxiliar - B,no_cumplido,cumplido,cumplido,60,136,estimada_geometria,6728,9803,85.2,86.2,0.855,90.1,85.9,0.873
54446cd0-29fb-467e-bf35-2b5579d21bd6,2026-07-27,Centro - A,no_cumplido,no_cumplido,no_cumplido,60,67,estimada_geometria,7617,8065,74.1,30.4,1,74.1,28.1,1
b7e20471-f49f-4699-a9e1-ac06272234c2,2026-07-27,Colinas - A,no_cumplido,cumplido,cumplido,60,98,estimada_geometria,7617,9491,100,70.8,1,100,60.7,1
62822d35-c1a2-472b-8f4d-8cdc5c7b359d,2026-07-27,Finca - A,no_cumplido,no_cumplido,no_cumplido,60,105,estimada_geometria,7617,9679,94.9,53.9,1,94.9,47.1,1
bfbbbf3a-5ca2-43d2-8a19-06114d764906,2026-07-27,Finca Auxiliar - A,no_cumplido,no_cumplido,no_cumplido,60,108,estimada_geometria,7617,9754,95.8,49,1,95.8,34.9,1
78f5fe18-d7bc-44bb-86f2-2825218506ed,2026-07-27,Juarez Nuevo - A,no_cumplido,no_cumplido,no_cumplido,60,73,estimada_geometria,7617,8411,84.2,48.4,0.3,84,43.4,1
855f5531-3bda-4852-b83f-cbf721e7c54d,2026-07-27,Km 20 - A,no_cumplido,no_cumplido,no_cumplido,60,60,estimada_geometria,7617,7617,87.9,46.4,1,87.9,46.4,1
b8be5390-6aca-44f2-b9e0-475de4b7b7f2,2026-07-27,Km 30 - A,no_cumplido,cumplido,cumplido,60,130,estimada_geometria,7617,10294,87.2,86.2,1,87.2,77,1
c25c3596-9a2f-4750-874d-9184b1280332,2026-07-27,Oasis - A,no_cumplido,cumplido,cumplido,60,91,estimada_geometria,7617,9237,98.3,75.6,0.982,99.2,69.3,1
9ebe5e06-7ef2-473c-9495-cffd9dcf1a5c,2026-07-27,Parajes del Sur - A,no_cumplido,no_cumplido,no_cumplido,60,117,estimada_geometria,7617,9978,53.2,44.9,0.923,63.9,45.7,0.923
e788bf58-f0f7-4162-abf0-30cc4bf0aded,2026-07-27,Riveras 7 - A,no_cumplido,no_cumplido,no_cumplido,60,94,estimada_geometria,7617,9343,57.6,68,0.962,59.1,67.2,1
e0c21d1d-a182-4ade-abc0-72470a8abd35,2026-07-27,Riveras 9 - A,no_cumplido,cumplido,no_cumplido,60,83,estimada_geometria,7617,8901,78.7,67.3,0.974,78.7,56.9,0.974
bc2faf85-7f1c-47a5-b5b8-134e1dae3b98,2026-07-27,Safari - A,no_cumplido,cumplido,no_cumplido,60,81,estimada_geometria,7617,8806,100,64,1,100,54.3,1
3fe77003-f3fd-4e14-b461-0d43904115d6,2026-07-27,San Isidro - A,no_cumplido,cumplido,no_cumplido,60,101,estimada_geometria,7617,9573,95.3,65.7,0.993,95.3,57.8,0.993
80a0ef47-b5da-4131-9b61-c058d62bbf4a,2026-07-27,Sanders - A,no_cumplido,no_cumplido,no_cumplido,60,76,estimada_geometria,7617,8570,96.3,58.3,1,96.3,50.7,1
f1ca176a-878e-445f-a098-33e99acfbc12,2026-07-27,Sierra Vista - A,no_cumplido,no_cumplido,no_cumplido,60,128,estimada_geometria,7617,10247,62.6,57.6,0.824,62.6,43.3,0.824
edc8df37-37af-460e-8140-ca53b1038653,2026-07-27,Huertas - B,no_cumplido,no_cumplido,cumplido,60,111,estimada_geometria,5062,7350,96.9,100,0.381,94.2,94.4,1
27fa600b-b280-4f62-a09f-aa509978cf9a,2026-07-27,Juarez Nuevo - B,no_cumplido,cumplido,cumplido,60,76,estimada_geometria,5062,5919,79.2,100,0.947,81.7,90.6,1
3ba03bf1-a9a7-4127-beef-9951e8d20fb6,2026-07-27,Km 30 - B,no_cumplido,no_cumplido,no_cumplido,60,121,estimada_geometria,5062,7679,96.6,91.3,0.293,84,83.6,0.786
86223ff3-3b83-4c60-bcf7-451e1fed862e,2026-07-27,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,5062,6408,71.6,88.1,1,71.6,71.6,1
d91acaa6-7901-47a9-8f21-5e222d4b8b17,2026-07-27,San Jose - B,no_cumplido,cumplido,cumplido,60,120,estimada_geometria,5062,7641,83.7,100,0.921,85.7,68.1,1
52ce1cca-d1b9-4d18-bca9-8303a091f4bb,2026-07-27,San Jose Auxiliar - B,no_cumplido,no_cumplido,no_cumplido,60,136,estimada_geometria,5062,8155,100,67.3,0.002,41.4,44,0.873
fbb6d6b7-d3a5-43ca-abc9-ac6104573e04,2026-07-28,Centro - A,pendiente_evidencia,no_cumplido,no_cumplido,60,67,estimada_geometria,4452,4889,61.3,41.2,0.102,61.3,36.5,0.102
a18cc0db-4202-43f3-ae7f-7d04bd671360,2026-07-28,Colinas - A,pendiente_evidencia,no_cumplido,no_cumplido,60,98,estimada_geometria,4452,6153,100,53.6,0.323,80.8,40.8,0.608
427b658e-af6b-427c-8bbb-d904f19152ca,2026-07-28,Finca - A,pendiente_evidencia,pendiente_evidencia,no_cumplido,60,105,estimada_geometria,4452,6349,93.3,50,0.605,93.3,42.7,0.605
f945d569-290a-43b9-8064-01228c73c2b0,2026-07-28,Finca Auxiliar - A,pendiente_evidencia,no_cumplido,no_cumplido,60,108,estimada_geometria,4452,6429,80,62.5,0.779,80,53.4,0.779
fcf2c06d-fad8-4824-bc97-8b3d8f30b70a,2026-07-28,Juarez Nuevo - A,pendiente_evidencia,no_cumplido,no_cumplido,60,73,estimada_geometria,4452,5225,92.7,58.8,0.317,92.7,46.3,0.317
c47ae97f-85c9-4ba3-ae93-98a4ff460e92,2026-07-28,Km 20 - A,pendiente_evidencia,pendiente_evidencia,pendiente_evidencia,60,60,estimada_geometria,4452,4452,83.8,65.5,0.495,83.8,65.5,0.495
f4e2df79-983f-4abe-b109-a13d27174120,2026-07-28,Km 30 - A,pendiente_evidencia,no_cumplido,no_cumplido,60,130,estimada_geometria,4452,6905,88.7,52.4,0.269,88.7,32.9,0.269
b685e8f5-7135-4ddf-bd93-0334cc5d8f88,2026-07-28,Oasis - A,pendiente_evidencia,no_cumplido,no_cumplido,60,91,estimada_geometria,4452,5942,95.2,52.4,0.389,49.1,64.2,1
c8ba4283-a77b-494b-ab49-41dd70cd39e8,2026-07-28,Parajes del Sur - A,pendiente_evidencia,no_cumplido,no_cumplido,60,117,estimada_geometria,4452,6645,34.8,47.1,0.375,41.1,30.5,0.907
a9fddfcd-d2ed-4f04-950d-90450ca900e9,2026-07-28,Riveras 7 - A,pendiente_evidencia,no_cumplido,no_cumplido,60,94,estimada_geometria,4452,6035,91.4,53.6,0.213,44.3,84.8,1
34d091ff-be35-49b8-81dc-53490c054a5d,2026-07-28,Riveras 9 - A,pendiente_evidencia,no_cumplido,no_cumplido,60,83,estimada_geometria,4452,5655,76.5,58.8,0.328,76.5,39.4,0.328
39c0242d-1a55-441e-a8b1-87192c81402a,2026-07-28,Safari - A,pendiente_evidencia,no_cumplido,no_cumplido,60,81,estimada_geometria,4452,5576,94.6,53.6,0.438,48.7,46.1,0.815
4cf7de1e-634c-4f2b-8dbc-43e112386add,2026-07-28,San Isidro - A,pendiente_evidencia,no_cumplido,no_cumplido,60,101,estimada_geometria,4452,6239,59.1,57.6,0.32,93.3,34.1,0.199
d2ce71de-b053-4ccb-ad67-77747dde41ab,2026-07-28,Sanders - A,pendiente_evidencia,cumplido,cumplido,60,76,estimada_geometria,4452,5366,98.8,86,1,98.8,71.7,1
e9c898e8-06e4-4a22-b953-b05da6dbd3bd,2026-07-28,Sierra Vista - A,pendiente_evidencia,no_cumplido,no_cumplido,60,128,estimada_geometria,4452,6865,75,40.5,0.062,41.2,30.9,0.591
3446af1a-c092-493f-aac8-aabc29518ac3,2026-07-28,Huertas - B,no_cumplido,no_cumplido,cumplido,60,111,estimada_geometria,7026,9183,100,89.1,0.396,90.6,85.9,1
e7c791e6-319e-4c18-bec8-36b771fd7bf6,2026-07-28,Juarez Nuevo - B,no_cumplido,no_cumplido,cumplido,60,76,estimada_geometria,7026,7748,93.3,88,0.835,85.9,88.7,1
7eeb6f16-c11e-4e84-8d56-9a6bd37c05fc,2026-07-28,Km 30 - B,no_cumplido,cumplido,cumplido,60,121,estimada_geometria,7026,9537,81.3,76.2,0.896,87,68,1
892bbfca-e571-426a-8b70-22928cfb0631,2026-07-28,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,7026,8172,78.4,85.3,1,78.4,68,1
4726148e-ccaf-4ec7-a1b8-1108110c891b,2026-07-28,San Jose - B,no_cumplido,cumplido,cumplido,60,120,estimada_geometria,7026,9507,81.4,79.2,0.898,84.7,64.7,1
4d8bba38-24e8-4bd2-8347-8f9289e7411a,2026-07-28,San Jose Auxiliar - B,no_cumplido,no_cumplido,cumplido,60,136,estimada_geometria,7026,9971,87.1,92.2,0.744,80.9,89,0.873
e1dfa04b-7221-4d50-a87a-7fa8ec9ee48f,2026-07-29,Huertas - B,no_cumplido,no_cumplido,cumplido,60,111,estimada_geometria,6682,9065,90.9,86.3,0.617,94.2,88.4,1
b6f37129-29e4-46a8-afe3-881b64ea812a,2026-07-29,Juarez Nuevo - B,no_cumplido,no_cumplido,cumplido,60,76,estimada_geometria,6682,7594,92.4,91.3,0.84,85.2,87.4,1
676641b0-7646-43f1-a448-051280bc1cea,2026-07-29,Km 30 - B,no_cumplido,cumplido,cumplido,60,121,estimada_geometria,6682,9416,83.2,95.7,0.877,85.5,73.3,1
b7438cd1-5227-4bb6-946c-9f0da79b05e2,2026-07-29,Riveras 9 - B,no_cumplido,cumplido,cumplido,60,85,estimada_geometria,6682,8044,77,84.7,1,77,72.1,1
6ff712a1-197a-439b-94e6-c6760b10b8ac,2026-07-29,San Jose - B,no_cumplido,cumplido,cumplido,60,120,estimada_geometria,6682,9379,88.4,94.8,0.898,91.4,74.6,1
31a87c5e-fbde-4a74-9ef7-ea997e52d71b,2026-07-29,San Jose Auxiliar - B,no_cumplido,no_cumplido,cumplido,60,136,estimada_geometria,6682,9925,83.3,89.9,0.72,80.9,86.9,0.873
```
