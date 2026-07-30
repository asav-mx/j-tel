# Lista congelada — re-verificación deadline de zona, Planta 47

**Generada:** 2026-07-30 · **Fuente:** `DATABASE_URL_READONLY`, solo lectura
**Referencia:** paso 1 de `docs/marco-limpio/Ficha-Reverificacion-Deadline-Zona.md` §4

Esta es la lista de alcance para la re-verificación. **Nada fuera de esta lista
se toca** cuando se ejecute la corrección.

## Criterio de selección (los tres juntos)

1. `clasificarDiferencia(...).causa === "zona"` (`packages/db/src/deadline-diff.ts`) — el
   deadline guardado está desanclado del marco temporal del turno, no es una
   deriva de política.
2. Tiene `compliance_facts` sellado (`join` interno, no `left join`).
3. Pertenece a Tecma Planta 47 (`plants.code = '47'`).

**Contrato de prueba (`Destino Prueba`):** no aparece en el resultado — sus
ocurrencias no pertenecen a Planta 47, así que el filtro por planta ya las
excluye sin necesidad de una regla aparte.

## Total

**300 ocurrencias** — coincide exactamente con la medición de alcance previa y
con el conteo de la simulación en seco de la ficha.

| Estado actual | Cantidad |
|---|---:|
| `no_cumplido` | 254 |
| `pendiente_evidencia` | 45 |
| `cumplido` | 1 |
| **Total** | **300** |

## Muestra piloto propuesta (§5 de la ficha)

Re-verificación en seco de las 300 (mismo motor, misma ventana corregida)
contra `DATABASE_URL_READONLY` — sin escrituras. Reparto: **161 `cumplido`
/ 139 `no_cumplido` / 0 `pendiente_evidencia`**, idéntico al de la ficha.

Los 5 casos propuestos para correr primero, según el criterio de §5 (2 que
pasan a `cumplido`, 2 que siguen `no_cumplido`, y el único `cumplido` actual):

| occurrence_id | service_date | ruta | turno | fact_id | estado actual | estado simulado |
|---|---|---|---|---|---|---|
| `24ab0a88-778f-4a39-bada-a4434a55b364` | 2026-07-13 | Colinas - A | Turno A | `5c91f9b6-8230-454a-bb78-969b8858411f` | no_cumplido | → cumplido |
| `ed3f18e6-cccc-4e31-ae78-03c0a9b17538` | 2026-07-09 | Km 30 - B | Turno B | `2dd60106-ecc0-4d6d-a2d0-f637784bf829` | no_cumplido | → cumplido |
| `204e29c6-e571-42ef-87e4-547ff340a371` | 2026-07-13 | Km 20 - A | Turno A | `342f7e3b-d390-47e0-8dc8-2e86272d3712` | no_cumplido | no_cumplido (sin cambio) |
| `ad13fd24-7809-4a20-ae83-4e2cf8735567` | 2026-07-09 | San Jose Auxiliar - B | Turno B | `5c823943-aa7d-4ceb-a9fe-f2e8f60c7b98` | no_cumplido | no_cumplido (sin cambio) |
| `4cdfe57b-0998-4e76-b626-d65923fb51eb` | 2026-07-21 | Safari - A | Turno A | `be8f7aae-4f89-415a-9153-01055d7e55cf` | **cumplido** | cumplido (sin cambio — no se voltea a no_cumplido) |

Los dos "pasan a cumplido" se eligieron uno por turno (A y B) para que el
piloto cubra ambos. Los dos "siguen no_cumplido" se eligieron fuera de las
tres rutas con falla real (Huertas-B, Centro-A, Parajes del Sur-A — ver §8 de
la ficha), para que el piloto pruebe el mecanismo de re-verificación sobre un
caso limpio, no sobre el frente aparte de las rutas rotas. El caso Safari-A no
se voltea a `no_cumplido` en la simulación — el escenario de §6 no se
materializa en este piloto, pero la revisión manual de Asav sigue aplicando
igual.

## La lista

Columnas: `occurrence_id, service_date, ruta, turno, fact_id, estado_actual, materialized_at, dif_minutos`

`dif_minutos` es la diferencia entre el deadline guardado y el que
`computeExpectedDeadline` calcula hoy con la misma política — positivo cuando
el guardado quedó atrasado respecto al correcto.

```csv
occurrence_id,service_date,ruta,turno,fact_id,estado_actual,materialized_at,dif_minutos
ce983b29-1010-40f0-855b-29c0f80934f7,2026-07-09,Centro - A,Turno A,1a1cf386-4189-4cfd-a57c-648effda3b45,pendiente_evidencia,2026-07-20 04:27:37.169328+00,360
550573a8-b34e-47df-8232-bc2ef83b30ac,2026-07-09,Colinas - A,Turno A,6ed28cf8-b25f-47b5-877e-9f275150b481,pendiente_evidencia,2026-07-20 04:27:44.438536+00,360
7f5c40de-000d-47ff-9d79-01d148218ad4,2026-07-09,Finca - A,Turno A,104f81a1-2db5-447b-8680-b2e8b029bb12,pendiente_evidencia,2026-07-20 04:27:42.661819+00,360
fe8f6df4-cdf8-4a50-b2ce-9dc747183e5d,2026-07-09,Finca Auxiliar - A,Turno A,c63e809b-5bc9-45d3-9f43-85598ce4f2d6,pendiente_evidencia,2026-07-20 04:27:39.026486+00,360
b271e370-54e8-413d-b7d7-94caebf43b0c,2026-07-09,Juarez Nuevo - A,Turno A,57b25128-8030-493d-8792-1f74b06cbc54,pendiente_evidencia,2026-07-20 04:27:34.705439+00,360
4b7bbbaa-91e5-4308-9f5d-be6da9a4dc60,2026-07-09,Km 20 - A,Turno A,6ff5a369-29fb-404c-9ceb-e87cfd311b1d,pendiente_evidencia,2026-07-20 04:27:36.596882+00,360
c0ab6026-1ca0-4bba-9e79-5e2fb064bc61,2026-07-09,Km 30 - A,Turno A,8ea44a27-6527-487f-8fda-6b1e6d1f973e,pendiente_evidencia,2026-07-20 04:27:42.030498+00,360
0c0a84fe-7b60-48ba-b9c0-89b7044a5fd6,2026-07-09,Oasis - A,Turno A,3e1a3f76-0ec2-4add-8723-c1e69c60931a,pendiente_evidencia,2026-07-20 04:27:39.658129+00,360
1613c42a-5557-4f3c-a62a-cb2f50a749f8,2026-07-09,Parajes del Sur - A,Turno A,751ceb49-863d-45dd-8d0d-c18302189d9e,pendiente_evidencia,2026-07-20 04:27:43.785992+00,360
c32c3591-443d-4c92-8ef0-aec4f27faba2,2026-07-09,Riveras 7 - A,Turno A,fa7c93bd-fd62-48ca-bda7-504fce038b28,pendiente_evidencia,2026-07-20 04:27:45.658977+00,360
b592bb56-cc19-42a6-9af4-2cada5fb5b73,2026-07-09,Riveras 9 - A,Turno A,34455962-f0a7-473c-abf2-285ef6243b21,pendiente_evidencia,2026-07-20 04:27:37.843765+00,360
88dd0bc2-84a8-45d8-a5cc-7dea159f213e,2026-07-09,Safari - A,Turno A,56824741-216c-4771-9613-50af16bbc8e1,pendiente_evidencia,2026-07-20 04:27:43.163844+00,360
0aba14eb-e934-46af-b456-7dc7072e9809,2026-07-09,San Isidro - A,Turno A,a17ce3f2-9375-49b6-acbd-6b7a361cccb2,pendiente_evidencia,2026-07-20 04:27:44.967743+00,360
b1d94a5d-8ed4-4cab-b156-f839bf7358d3,2026-07-09,Sanders - A,Turno A,db88c2c3-c23e-4fd0-9c32-c6214d876b1a,pendiente_evidencia,2026-07-20 04:27:35.400253+00,360
aaa8548e-d6de-4fde-8c68-3da97b0f615a,2026-07-09,Sierra Vista - A,Turno A,624bbd3e-6b27-4fab-86ac-43c1fbdfa497,pendiente_evidencia,2026-07-20 04:27:38.45484+00,360
846ea8ca-ebac-45ce-8e84-796adfd0cdb1,2026-07-09,Huertas - B,Turno B,aa514707-6cf8-4e22-bd76-7c20cec2e61d,no_cumplido,2026-07-20 04:27:46.143815+00,210
3e98b8c0-ea7b-41a6-a392-c17d3f300d5f,2026-07-09,Juarez Nuevo - B,Turno B,f44261d1-f1bf-4e3a-a3df-b48e140dbd12,no_cumplido,2026-07-20 04:27:36.039348+00,210
ed3f18e6-cccc-4e31-ae78-03c0a9b17538,2026-07-09,Km 30 - B,Turno B,2dd60106-ecc0-4d6d-a2d0-f637784bf829,no_cumplido,2026-07-20 04:27:40.557764+00,210
2a1d7fe1-041e-4459-b546-1bdde996bc04,2026-07-09,Riveras 9 - B,Turno B,3039bea2-70cd-4295-9b9b-725065248ae6,no_cumplido,2026-07-20 04:27:41.47718+00,210
eaa2b9a0-2aa1-47ee-a401-64805b59603a,2026-07-09,San Jose - B,Turno B,6a632b9a-ff6b-44fc-8634-5ed75b93ef8e,no_cumplido,2026-07-20 04:27:40.097437+00,210
ad13fd24-7809-4a20-ae83-4e2cf8735567,2026-07-09,San Jose Auxiliar - B,Turno B,5c823943-aa7d-4ceb-a9fe-f2e8f60c7b98,no_cumplido,2026-07-20 04:27:41.017053+00,210
184431db-f82d-4d7d-8890-21a675e82f56,2026-07-10,Centro - A,Turno A,7b49e577-a38d-4413-876b-162605294c23,pendiente_evidencia,2026-07-20 04:27:58.401424+00,360
0b2f7352-2c40-49f9-a957-7c38b5308327,2026-07-10,Colinas - A,Turno A,3bc41c80-5663-414f-8f77-eddea3601047,pendiente_evidencia,2026-07-20 04:27:53.189575+00,360
b5f6a66d-513d-4914-a352-0faf0d60d09a,2026-07-10,Finca - A,Turno A,6bd2a074-775a-412e-aaee-c0f06c279725,pendiente_evidencia,2026-07-20 04:27:54.677768+00,360
a851232f-fa79-4eca-8715-aafc4a206673,2026-07-10,Finca Auxiliar - A,Turno A,3e543ee9-3f68-4b9a-b1cd-eb2a6a2c3606,pendiente_evidencia,2026-07-20 04:27:55.662153+00,360
4aaa618a-6419-4a2c-a715-7749c4062aab,2026-07-10,Juarez Nuevo - A,Turno A,1645930e-baed-4cc5-ac52-bc7528135a1e,pendiente_evidencia,2026-07-20 04:27:56.119689+00,360
020a4726-ffab-4b89-b0a6-09d1bfbe06c3,2026-07-10,Km 20 - A,Turno A,cae92d8a-c055-4c03-9dfc-19c6f506ee59,pendiente_evidencia,2026-07-20 04:27:55.146896+00,360
a754877c-a7a6-4418-9e85-e01a30f9d18d,2026-07-10,Km 30 - A,Turno A,2443f43e-8de6-43d4-987c-34a37a0b2e45,pendiente_evidencia,2026-07-20 04:27:54.217361+00,360
a5c90cfd-da42-4e6a-939f-ac6f7f38fdf1,2026-07-10,Oasis - A,Turno A,a3c0c401-4b3a-422c-893d-038d3ce53843,pendiente_evidencia,2026-07-20 04:27:53.683783+00,360
4a457b59-a55e-463a-81b1-64437e5b5592,2026-07-10,Parajes del Sur - A,Turno A,6c264dd7-6479-4108-a3e3-acc93a7900d5,pendiente_evidencia,2026-07-20 04:27:57.015322+00,360
88e1d41d-215e-4e62-b939-e42dcc98cd90,2026-07-10,Riveras 7 - A,Turno A,e38545a1-fe3f-437d-9365-9f6b666d9fe0,pendiente_evidencia,2026-07-20 04:27:59.304688+00,360
73a74452-2834-49bd-a778-b2c4fce3e6ea,2026-07-10,Riveras 9 - A,Turno A,6b39af88-59ae-4bac-ae2e-b0f76d5fb76b,pendiente_evidencia,2026-07-20 04:27:59.847235+00,360
54df2fef-d468-4913-847b-8c2548ed280b,2026-07-10,Safari - A,Turno A,f6d82c18-51b9-49f6-9689-5726017e846b,pendiente_evidencia,2026-07-20 04:27:56.525469+00,360
e2434c74-f953-4257-b550-4d07b86c4756,2026-07-10,San Isidro - A,Turno A,90447f1f-162d-4554-a21f-28318f225f9c,pendiente_evidencia,2026-07-20 04:27:57.946686+00,360
7fc3b955-1be0-4c17-aff8-3026a1e4ef91,2026-07-10,Sanders - A,Turno A,ddb566b1-bb17-4552-af77-b208229a54e8,pendiente_evidencia,2026-07-20 04:27:57.500449+00,360
b80c79f5-f3d7-4524-84bf-46dcf94936e7,2026-07-10,Sierra Vista - A,Turno A,ec1f8b4b-7f71-4b46-a040-24ec5135527e,pendiente_evidencia,2026-07-20 04:27:52.296394+00,360
d3f73705-b2d0-41b9-aa3a-3b7113be12d3,2026-07-10,Huertas - B,Turno B,e6fa0049-a9f7-47d2-96be-b3c3dc34b118,no_cumplido,2026-07-20 04:27:50.835085+00,210
8521de04-14c9-4216-b439-fa1aa40f436b,2026-07-10,Juarez Nuevo - B,Turno B,efbb6f69-2ef1-47a9-9a1a-5d567d95c0d3,no_cumplido,2026-07-20 04:27:51.779311+00,210
45f9aac3-c308-403e-9cda-2b4e58ca983e,2026-07-10,Km 30 - B,Turno B,b3d476b4-971f-48de-ad08-99b710218e86,no_cumplido,2026-07-20 04:27:51.28014+00,210
095190fa-d46d-4ccf-a54d-99c4fff8424a,2026-07-10,Riveras 9 - B,Turno B,55b4a3e2-24e4-46d8-ab0f-78a8d389d016,no_cumplido,2026-07-20 04:27:52.749524+00,210
a812a632-5e58-4b29-b97e-4122bf8dee2e,2026-07-10,San Jose - B,Turno B,036693b0-3846-42f6-a831-775b4548c623,no_cumplido,2026-07-20 04:27:58.835791+00,210
97012b0c-6c51-4991-a947-db6d49116d01,2026-07-10,San Jose Auxiliar - B,Turno B,607ad6c6-0861-4c8a-a9fd-788a4fb6b3a1,no_cumplido,2026-07-20 04:28:00.322285+00,210
01ab3a7d-eb69-45cd-88b9-6ca204c01b64,2026-07-13,Centro - A,Turno A,69cd2037-1654-4edd-95c3-69242aca431d,no_cumplido,2026-07-20 04:28:11.385877+00,360
24ab0a88-778f-4a39-bada-a4434a55b364,2026-07-13,Colinas - A,Turno A,5c91f9b6-8230-454a-bb78-969b8858411f,no_cumplido,2026-07-20 04:28:09.626201+00,360
4d558741-37ca-4087-a24e-5a931f380e67,2026-07-13,Finca - A,Turno A,8ce21621-a4a3-42de-a147-a18c3edb3ed4,no_cumplido,2026-07-20 04:28:12.801635+00,360
8e9a203d-057d-4108-94f7-5e2451b45c61,2026-07-13,Finca Auxiliar - A,Turno A,b862b6bb-6b45-4e9e-9b49-92ff7891f8cc,no_cumplido,2026-07-20 04:28:11.842357+00,360
694aa656-173a-49e6-861b-9f5eca290fd1,2026-07-13,Juarez Nuevo - A,Turno A,8e45f9c2-c3dd-4208-81f0-402fff786d27,no_cumplido,2026-07-20 04:28:08.262786+00,360
204e29c6-e571-42ef-87e4-547ff340a371,2026-07-13,Km 20 - A,Turno A,342f7e3b-d390-47e0-8dc8-2e86272d3712,no_cumplido,2026-07-20 04:28:10.969826+00,360
3a972259-5b18-4aff-8031-6d88b486f5b0,2026-07-13,Km 30 - A,Turno A,59a10554-991b-44a7-bd5c-3b44331cf77e,no_cumplido,2026-07-20 04:28:04.706342+00,360
740c3abf-94eb-4985-bb89-adde932706a9,2026-07-13,Oasis - A,Turno A,31512847-7bfa-45ac-bc66-c9614690b55f,no_cumplido,2026-07-20 04:28:07.855551+00,360
adbb43be-06db-44e8-8f21-b2b20fe48198,2026-07-13,Parajes del Sur - A,Turno A,f1857b04-1f9d-46f8-8fcb-8cd0fa83d49d,no_cumplido,2026-07-20 04:28:06.875214+00,360
42171f4b-4c45-4c0f-94ee-146d69d41ff8,2026-07-13,Riveras 7 - A,Turno A,2a7d9ec6-f62a-4e91-b76d-fc895f3ce137,no_cumplido,2026-07-20 04:28:10.119042+00,360
91a52388-eee2-49d1-b70d-5c23ec604df2,2026-07-13,Riveras 9 - A,Turno A,a8c079a6-8ee7-4547-b8b3-f4ba51d3fa1a,no_cumplido,2026-07-20 04:28:05.125312+00,360
671a0a32-aa6d-48d6-9241-2e26f7785b96,2026-07-13,Safari - A,Turno A,745b2c44-719d-41a7-8ff1-d05da7ecb4bc,no_cumplido,2026-07-20 04:28:08.767075+00,360
9b4f4bdd-4281-4a33-88ab-44a8b0ff84ae,2026-07-13,San Isidro - A,Turno A,e39ddc0b-3270-4bd1-be9c-235425dfa9cd,no_cumplido,2026-07-20 04:28:09.2105+00,360
7ed49f9b-49b3-4d32-bc0b-34f8f7e944ba,2026-07-13,Sanders - A,Turno A,efdf7e87-778b-487d-9440-48f222295caa,no_cumplido,2026-07-20 04:28:10.583866+00,360
f654e654-7626-4bdf-a7f1-f4ad0298f983,2026-07-13,Sierra Vista - A,Turno A,a343b9e5-2a0b-4e9c-8cde-00ea9d37a661,no_cumplido,2026-07-20 04:28:13.883445+00,360
f74fb025-a363-4225-8a8e-f196c35f50e6,2026-07-13,Huertas - B,Turno B,098e9075-0fa4-4934-a525-1339bc31e180,no_cumplido,2026-07-20 04:28:13.382292+00,210
c500ab71-9f79-421a-8f21-3c309f6fd835,2026-07-13,Juarez Nuevo - B,Turno B,cc5a3890-517a-4bb4-9772-38796806c247,no_cumplido,2026-07-20 04:28:07.360019+00,210
1b0d6d6c-4156-4551-a301-1ce6cc4b8a91,2026-07-13,Km 30 - B,Turno B,1013029e-9af2-4b97-9bf3-1bee65708ed1,no_cumplido,2026-07-20 04:28:05.779853+00,210
80cb876e-a0c0-4a57-aa45-aa03c017e926,2026-07-13,Riveras 9 - B,Turno B,28a3f142-88b4-4f02-ad04-d25c6fc583f5,no_cumplido,2026-07-20 04:28:12.385838+00,210
e085f991-3f7f-4c07-96ba-aa56411b5151,2026-07-13,San Jose - B,Turno B,5e8e4ee8-d9cf-4986-a76f-152e8fb8ab83,no_cumplido,2026-07-20 04:28:04.275796+00,210
2ab40a26-3e8a-479c-8af2-d8497c3960e3,2026-07-13,San Jose Auxiliar - B,Turno B,b6ae71a7-ad53-422c-bdc8-fd612ff75dfd,no_cumplido,2026-07-20 04:28:06.317208+00,210
92b54537-06ae-4065-8ad7-5c9a566d40eb,2026-07-14,Centro - A,Turno A,4a19f310-2e76-4466-9b95-7204e00ce1c6,no_cumplido,2026-07-27 19:13:34.450636+00,360
e5ea03c1-1893-438c-b199-828bcc1791c4,2026-07-14,Colinas - A,Turno A,3c718dc6-89fa-48f4-9287-ca29f97943fa,no_cumplido,2026-07-27 19:13:35.722713+00,360
22ea4fb9-b1d3-4e7c-a7bc-f2b454f7a334,2026-07-14,Finca - A,Turno A,ff5cb5ae-cd7b-48e8-8688-8e015ede4420,no_cumplido,2026-07-27 19:13:28.152173+00,360
05013e3c-deb1-4e95-832b-cea6628b2ee1,2026-07-14,Finca Auxiliar - A,Turno A,c79324ee-bfdd-4a2b-9a28-3d16cdc315f4,no_cumplido,2026-07-27 19:13:30.340705+00,360
4b248c50-2304-4ee2-a954-69b0095755ed,2026-07-14,Juarez Nuevo - A,Turno A,d4871ad2-52c2-4b2e-a6f2-a9ec04f5cf39,no_cumplido,2026-07-27 19:13:32.267738+00,360
cee69212-4987-44d9-89f1-adcc4a405861,2026-07-14,Km 20 - A,Turno A,cfdadc97-af1a-40a1-8e28-56a1e792bcc3,no_cumplido,2026-07-27 19:13:31.322723+00,360
ff5855eb-8d2d-425f-9e42-f13dca475800,2026-07-14,Km 30 - A,Turno A,0d5d802d-530e-4e6b-95c9-ba8e920bda08,no_cumplido,2026-07-27 19:13:31.828886+00,360
af5d93ed-dc1f-487c-b13d-df8bf3fc7c51,2026-07-14,Oasis - A,Turno A,79870732-9157-47d4-aade-042e06cddefc,no_cumplido,2026-07-27 19:13:27.117187+00,360
2393914a-a162-4b92-a1e0-f4ce4a93d2b8,2026-07-14,Parajes del Sur - A,Turno A,b84fb633-4dca-40ad-940b-233274a924d9,no_cumplido,2026-07-27 19:13:30.810165+00,360
691c6b50-ac54-4714-bab0-91426c3b1320,2026-07-14,Riveras 7 - A,Turno A,215e6590-5a05-44e7-befd-2f12eac74265,no_cumplido,2026-07-27 19:13:33.285322+00,360
cd6288b0-bf6f-4e93-8fc5-ac50ae1986de,2026-07-14,Riveras 9 - A,Turno A,28fbdf1e-b548-473a-99e9-14e4b073d9ec,no_cumplido,2026-07-27 19:13:36.112709+00,360
549a118b-33e5-4c77-b1dd-0ab64eab1920,2026-07-14,Safari - A,Turno A,b5008eb0-b586-45c8-95a1-a6cec8cb8641,no_cumplido,2026-07-27 19:13:29.925233+00,360
9bd30918-0bdb-4182-9fbd-67d6cbe1dddb,2026-07-14,San Isidro - A,Turno A,1d3f3e40-4fe2-4d89-96f5-1c3809746b96,no_cumplido,2026-07-27 19:13:34.91785+00,360
0b989f27-7204-436e-8642-c2cb3dcb5c6c,2026-07-14,Sanders - A,Turno A,e11d5cbd-0a7f-4521-a4e8-90030ce516e9,no_cumplido,2026-07-27 19:13:27.671695+00,360
faba2f0a-c7b8-4a02-88b8-1db1205845f9,2026-07-14,Sierra Vista - A,Turno A,95c97ceb-d410-4865-b55c-1e1646acdf31,no_cumplido,2026-07-27 19:13:29.523793+00,360
f007e8a6-b45f-44d6-9d62-f73c744c9705,2026-07-14,Huertas - B,Turno B,c5a62c85-0280-4aaf-bbb9-c6ecf831aea7,no_cumplido,2026-07-27 19:13:29.032219+00,210
18b73c29-3f09-4df8-b7db-5f044547f837,2026-07-14,Juarez Nuevo - B,Turno B,a95c14d5-6fea-4495-8d9b-4711c5e843ef,no_cumplido,2026-07-27 19:13:28.550428+00,210
911de9a3-db29-4b44-a6b6-fbbec46cda42,2026-07-14,Km 30 - B,Turno B,a06a8f96-2069-4a85-9bd7-e700f332e02a,no_cumplido,2026-07-27 19:13:35.326012+00,210
e86b0c89-c6f6-4ddc-bf05-bd5e97516ced,2026-07-14,Riveras 9 - B,Turno B,6f194c32-32f8-495a-b045-2f4831cec213,no_cumplido,2026-07-27 19:13:34.086766+00,210
1cfc4e6a-6ec0-41ab-8c3c-6556c2d91b89,2026-07-14,San Jose - B,Turno B,b629b4e6-328b-4890-ad5e-43286d0116ba,no_cumplido,2026-07-27 19:13:33.658254+00,210
c066040d-bd3c-4a82-8893-94c3dde97dbd,2026-07-14,San Jose Auxiliar - B,Turno B,b537f9e2-812e-44d2-bba7-96da1df0e767,no_cumplido,2026-07-27 19:13:32.841949+00,210
0ff9ac7b-4798-440b-ab42-b73a3e167f97,2026-07-15,Centro - A,Turno A,44303a5e-5a54-4761-bc96-0cb5b08ae23b,no_cumplido,2026-07-27 19:13:42.816669+00,360
305ab9b9-bf93-4fd1-aef7-d8e43bb2b653,2026-07-15,Colinas - A,Turno A,05a68145-c21a-4311-aced-8bb6dd7efe8c,no_cumplido,2026-07-27 19:13:42.441255+00,360
053d8d2b-dd59-481f-981a-7b180272a691,2026-07-15,Finca - A,Turno A,8a9e1d54-714b-408c-86a0-6354d45f386e,no_cumplido,2026-07-27 19:13:41.187343+00,360
17d0e667-0a34-4793-8134-7849abf534ae,2026-07-15,Finca Auxiliar - A,Turno A,0b2a4fa5-7474-45e5-9afa-6000283f5ca9,no_cumplido,2026-07-27 19:13:40.372807+00,360
f0b106bd-272d-48ee-b0fe-d77b366ff8cf,2026-07-15,Juarez Nuevo - A,Turno A,8df6bbb4-5a1d-4083-b5a1-66dbd9ee69c0,no_cumplido,2026-07-27 19:13:43.734633+00,360
be847b07-5749-4b81-9034-39e572763845,2026-07-15,Km 20 - A,Turno A,5e04c1b1-5474-42aa-9740-69e40f59d769,no_cumplido,2026-07-27 19:13:40.76875+00,360
8fdf8383-41e4-4f1e-a25d-d0efbfdc6eb5,2026-07-15,Km 30 - A,Turno A,02dcbc05-63f4-4e55-9b4c-e2fc0b9e0f88,no_cumplido,2026-07-27 19:13:45.521016+00,360
66754750-9e00-4d3b-b42f-35a625a4bf59,2026-07-15,Oasis - A,Turno A,fe654144-3cda-4748-a546-90b170998e68,no_cumplido,2026-07-27 19:13:48.402441+00,360
fde80423-17a9-45a7-b049-971dd5b5e36c,2026-07-15,Parajes del Sur - A,Turno A,b15485c2-70a7-4ff1-9857-8c43f0aa3bc5,no_cumplido,2026-07-27 19:13:44.570358+00,360
0eb1cb8b-ebba-4d85-bd91-860de78d5a35,2026-07-15,Riveras 7 - A,Turno A,76a1793a-25ef-4cff-bca8-4f1f6a0fc243,no_cumplido,2026-07-27 19:13:47.632132+00,360
dde038b9-3c3a-4940-83ca-65bb4339e72e,2026-07-15,Riveras 9 - A,Turno A,aa8f36c8-6b45-4f97-97ea-9afeb14730ab,no_cumplido,2026-07-27 19:13:42.037869+00,360
e49110ae-cab2-4666-beff-1ab5c082b34c,2026-07-15,Safari - A,Turno A,31b30257-262a-44d9-a226-5cefc64bd321,no_cumplido,2026-07-27 19:13:39.891748+00,360
b4f6380e-3094-4f56-88fd-82c4696a6470,2026-07-15,San Isidro - A,Turno A,e7098602-ee7b-45e8-b74a-543776d186c9,no_cumplido,2026-07-27 19:13:43.25051+00,360
e5f126f3-e039-4cc2-bbcc-978e7b617370,2026-07-15,Sanders - A,Turno A,ec9b6a25-6886-47a9-9ea4-acef2b94687a,no_cumplido,2026-07-27 19:13:46.716196+00,360
48612d9e-64f6-4449-9982-851e8b61ef76,2026-07-15,Sierra Vista - A,Turno A,a15fd713-df4a-4800-97a8-5c2d331a048c,no_cumplido,2026-07-27 19:13:45.04687+00,360
e53badc9-0823-4848-937f-d3218dccb559,2026-07-15,Huertas - B,Turno B,3213d92f-c6be-43f4-b1f3-3ad5e16e6aa4,no_cumplido,2026-07-27 19:13:41.598831+00,210
dba69de5-6a6f-4ace-9706-eeccba44015a,2026-07-15,Juarez Nuevo - B,Turno B,34920817-6bfa-4370-8d88-d33629fb6ef9,no_cumplido,2026-07-27 19:13:47.208175+00,210
20523028-d7d0-46c9-b455-20864591949d,2026-07-15,Km 30 - B,Turno B,9c099778-4f2c-4f7a-8ea8-550d791c6a79,no_cumplido,2026-07-27 19:13:45.899778+00,210
027c0120-a8b4-4b91-8f3a-4f70a202ba6c,2026-07-15,Riveras 9 - B,Turno B,64d6da7b-b382-4fe9-95a9-7203c83ec8d6,no_cumplido,2026-07-27 19:13:47.977235+00,210
06d9aec8-c816-452a-8918-1768dbaf151c,2026-07-15,San Jose - B,Turno B,2c041653-cecd-41e6-97e8-4c83050e5fc4,no_cumplido,2026-07-27 19:13:46.300207+00,210
f20d4242-361f-488a-8cf2-9382bf74ed80,2026-07-15,San Jose Auxiliar - B,Turno B,deb0ee28-5e27-4298-aef0-6c5e1781b5fd,no_cumplido,2026-07-27 19:13:44.124204+00,210
e71cf5ea-27eb-49f8-a341-22d116ff0a26,2026-07-16,Centro - A,Turno A,0f9136d2-f330-49ab-8e5f-99c61269a092,no_cumplido,2026-07-30 03:11:44.838342+00,360
6fbb799d-127f-419d-8fbb-7a2b8be7b639,2026-07-16,Colinas - A,Turno A,2efe0d6f-23e1-4c91-b9bd-dee867a6d6ef,no_cumplido,2026-07-30 03:11:49.443602+00,360
821c3594-404d-41b7-90d4-a4aabb3412c3,2026-07-16,Finca - A,Turno A,e654b59f-b26f-4799-9409-08d9511f9bfe,no_cumplido,2026-07-30 03:11:47.948884+00,360
ac0c8148-04ee-4212-8e1c-2730c16c4d09,2026-07-16,Finca Auxiliar - A,Turno A,3384c36a-f195-450d-8e42-25b5fe5070ec,no_cumplido,2026-07-30 03:11:49.816057+00,360
f7c0b9be-a164-4907-b7d0-10e462160971,2026-07-16,Juarez Nuevo - A,Turno A,d28e0cc9-b4ac-4cb0-9b95-c18d32c5dec8,no_cumplido,2026-07-30 03:11:47.151613+00,360
2eb3e2a4-3823-41fb-b434-ea9699cf3812,2026-07-16,Km 20 - A,Turno A,2e56af13-56a7-4f87-a314-89adf105a0c7,no_cumplido,2026-07-30 03:11:46.773361+00,360
6f20ad74-2051-4de7-b5fd-719a69370418,2026-07-16,Km 30 - A,Turno A,ed8c0583-9848-4f39-871e-9eea42bd85e8,no_cumplido,2026-07-30 03:11:42.081606+00,360
da7f0de2-ffb2-452b-8227-392a2da078e5,2026-07-16,Oasis - A,Turno A,0d833e56-ca82-424e-92d3-afff64f4083b,no_cumplido,2026-07-30 03:11:43.5682+00,360
edeec991-6fc4-4f4e-9ca5-27244399100a,2026-07-16,Parajes del Sur - A,Turno A,c6f76d49-9a5d-457f-8b5c-58ba8311dd75,no_cumplido,2026-07-30 03:11:44.064012+00,360
a209c9b5-ed9e-4352-a823-2cb15f5f19f4,2026-07-16,Riveras 7 - A,Turno A,9e78b4d5-00de-479c-85d5-fea25473830e,no_cumplido,2026-07-30 03:11:45.992232+00,360
4f33695b-95e8-4f2e-b82a-ef0d078d2712,2026-07-16,Riveras 9 - A,Turno A,ed6ae08b-fcd5-474e-ade5-76fc10d7a7f7,no_cumplido,2026-07-30 03:11:44.478986+00,360
97151624-577a-4269-aeaa-5075764b406a,2026-07-16,Safari - A,Turno A,38458267-f6ff-4b82-9a87-f5e376baf2ca,no_cumplido,2026-07-30 03:11:48.680529+00,360
5a4ecb78-db7f-475d-9e86-ddd4393f62a1,2026-07-16,San Isidro - A,Turno A,b8c88df5-1528-4264-8c01-dee1cd3b554f,no_cumplido,2026-07-30 03:11:48.338819+00,360
b7a3c0dd-d6bc-4c35-adc4-368097016246,2026-07-16,Sanders - A,Turno A,17979880-b2c1-465f-bb84-2f96396c3c23,no_cumplido,2026-07-30 03:11:42.678064+00,360
f9601310-1dbe-49e5-8ba6-42598cff41e6,2026-07-16,Sierra Vista - A,Turno A,d8359c4a-a884-4f67-b3c6-ef35f072d42a,no_cumplido,2026-07-30 03:11:46.401037+00,360
2a002f39-9e59-4eee-ab6f-291e97bf7377,2026-07-16,Huertas - B,Turno B,04a817df-8e34-4ac7-96aa-08f19cc9aa57,no_cumplido,2026-07-30 03:11:47.576079+00,210
14d53ded-2b09-4371-8f06-51999b9e6660,2026-07-16,Juarez Nuevo - B,Turno B,256b0a71-1596-403f-8d74-da3d28b0b52b,no_cumplido,2026-07-30 03:11:45.244749+00,210
e387b327-9fd5-4d46-9a5b-c6c2638f0947,2026-07-16,Km 30 - B,Turno B,b69308bc-1444-4743-9fe4-578ff9e12f53,no_cumplido,2026-07-30 03:11:49.028346+00,210
b8f9434d-68d5-4580-8d2c-c7c327c0ef91,2026-07-16,Riveras 9 - B,Turno B,8c397349-d192-4c9b-8048-54f45810f1f4,no_cumplido,2026-07-30 03:11:45.587032+00,210
ee9548b4-023f-4f5b-ac78-9efec7200560,2026-07-16,San Jose - B,Turno B,7392b6ac-2f1e-4145-9ec9-bafdf5f5ab27,no_cumplido,2026-07-30 03:11:50.182096+00,210
97565de2-d6e7-4bbb-afde-f4439fa86d5c,2026-07-16,San Jose Auxiliar - B,Turno B,78560dd8-eb82-40c8-98db-0c35e4434169,no_cumplido,2026-07-30 03:11:43.1288+00,210
8a0f0ec0-0b08-4919-a5eb-ad3e39643956,2026-07-17,Centro - A,Turno A,64cbee46-ab92-493c-8a73-486b10d30d7c,no_cumplido,2026-07-30 03:11:56.676468+00,360
6e526e7f-9d43-4bdd-b8e4-8734201eeb7b,2026-07-17,Colinas - A,Turno A,4c4e968b-859a-4358-9d06-4c370d617042,no_cumplido,2026-07-30 03:11:59.894582+00,360
fb0aa2cc-60dd-4ac4-a759-3b394e2544ce,2026-07-17,Finca - A,Turno A,d3e2c661-a7b8-47b9-bdd0-bed9eb47d9eb,no_cumplido,2026-07-30 03:11:56.029607+00,360
9bb57d27-1b99-41d6-87d8-de031318e74a,2026-07-17,Finca Auxiliar - A,Turno A,74872e69-e742-453f-8dd7-786ccd8eb203,no_cumplido,2026-07-30 03:11:57.721369+00,360
ca4c3485-c95e-4bbe-bef9-33cabede0bc2,2026-07-17,Juarez Nuevo - A,Turno A,659824ea-f07e-477f-9799-6db4e5c6b04e,no_cumplido,2026-07-30 03:11:58.395417+00,360
034d2b75-0038-42d1-bb61-35ec1754afe7,2026-07-17,Km 20 - A,Turno A,63e53f25-e337-4573-9f5e-827e6b7786ac,no_cumplido,2026-07-30 03:11:54.471304+00,360
1feae473-437f-4432-950c-ff4c05abe4d3,2026-07-17,Km 30 - A,Turno A,a3828441-5651-4366-9139-874be36a4424,no_cumplido,2026-07-30 03:11:59.525322+00,360
08671695-5773-451c-94ce-f0e3614790ba,2026-07-17,Oasis - A,Turno A,ee27c5a5-b26d-4128-95ed-9649778ecc15,no_cumplido,2026-07-30 03:12:00.263532+00,360
f81d4f26-7a4f-4555-84e6-31c55c690463,2026-07-17,Parajes del Sur - A,Turno A,976e9872-e9f1-4b94-8962-ec4ae513bdeb,no_cumplido,2026-07-30 03:11:55.243907+00,360
1d239686-a1ac-4534-b9c5-764ceaa16a6b,2026-07-17,Riveras 7 - A,Turno A,11427ab0-6e4d-40d3-98ea-ba54499f080e,no_cumplido,2026-07-30 03:11:53.995952+00,360
c73a6f3e-3dc6-476e-bbd5-24b90f4bbde5,2026-07-17,Riveras 9 - A,Turno A,a694e099-564f-4a7f-9ddd-50f29654e950,no_cumplido,2026-07-30 03:12:01.015388+00,360
35887ae4-88a3-4554-ab47-784e0130cee5,2026-07-17,Safari - A,Turno A,544eb9d8-935f-4b0b-861c-48e21eaadc5b,no_cumplido,2026-07-30 03:11:59.161176+00,360
6010dd97-4353-4099-ad7a-4c0d1602bd69,2026-07-17,San Isidro - A,Turno A,a330285e-85fb-4a38-bcc0-f08cd4908dbd,no_cumplido,2026-07-30 03:11:58.767707+00,360
7b604b83-07b5-4c2e-853a-0e5ecd4476ca,2026-07-17,Sanders - A,Turno A,1362474d-8291-4f13-b2bf-29b1a953a685,no_cumplido,2026-07-30 03:12:01.356771+00,360
00b8975d-409e-4830-ba87-3fcb6cddd447,2026-07-17,Sierra Vista - A,Turno A,d3402c13-3427-4595-9391-026f2c369d7e,no_cumplido,2026-07-30 03:11:54.855514+00,360
bca777d3-f7ab-42c7-99fc-5d26f4ed5542,2026-07-17,Huertas - B,Turno B,ea43b78f-92a7-4dd8-ab7e-f8b14028436f,no_cumplido,2026-07-30 03:12:00.657173+00,210
78ab55f4-34a4-4532-b2b9-e6c6c4c5ac4a,2026-07-17,Juarez Nuevo - B,Turno B,3c794a20-e3f5-4b1a-b33b-0eacc0e2e920,no_cumplido,2026-07-30 03:11:56.357315+00,210
03fdaa73-8f5b-46e4-bcf8-84ae3f12f1eb,2026-07-17,Km 30 - B,Turno B,7121765a-fad4-45aa-b127-de16ce224128,no_cumplido,2026-07-30 03:11:58.035914+00,210
c819f9ce-5a59-4ff9-8515-f42bd7b1a755,2026-07-17,Riveras 9 - B,Turno B,98b593a4-a0bb-4497-a330-7da2bf901f7a,no_cumplido,2026-07-30 03:11:55.545211+00,210
62121e47-c7d3-4fc7-a320-b3df0db51852,2026-07-17,San Jose - B,Turno B,4c480a79-3e75-4547-b6e0-dd5033012a1d,no_cumplido,2026-07-30 03:11:57.342394+00,210
7b9470c1-c3fb-434f-8265-e9e0a8d843b9,2026-07-17,San Jose Auxiliar - B,Turno B,b68787dd-0c38-4132-9a5d-10a5997c774e,no_cumplido,2026-07-30 03:11:57.023422+00,210
e3c3051c-4b4a-4db8-b048-4897bf7a3fcc,2026-07-20,Centro - A,Turno A,61726cd7-b977-414c-9ca2-0dc6185ea790,no_cumplido,2026-07-30 03:12:07.218949+00,360
eefef684-8fcb-40e6-9b58-b8d035db3600,2026-07-20,Colinas - A,Turno A,88d4ea4e-7dbb-46b4-91e4-883b549a21a5,no_cumplido,2026-07-30 03:12:06.092042+00,360
56d94e30-96e7-488f-a233-39c21e5b65cf,2026-07-20,Finca - A,Turno A,c97ba46c-b845-4d85-8b8c-e33840bdffc3,no_cumplido,2026-07-30 03:12:05.742101+00,360
30ffdf9b-d8c1-494e-ab35-b1f3cc366a42,2026-07-20,Finca Auxiliar - A,Turno A,c1aa222d-0987-448f-905e-4cc02dd191aa,no_cumplido,2026-07-30 03:12:06.419401+00,360
6fa7c392-750f-487f-be1e-8708fab3074f,2026-07-20,Juarez Nuevo - A,Turno A,719433a5-4570-42b7-88fe-520c03b325c4,no_cumplido,2026-07-30 03:12:07.766844+00,360
c3b57939-40d3-4e3b-9e41-27e0915d20a7,2026-07-20,Km 20 - A,Turno A,db608734-7521-4b0c-b201-de2d7ed01dad,no_cumplido,2026-07-30 03:12:06.953216+00,360
6dacb332-d9dc-416b-83c4-a32cc97e26b7,2026-07-20,Km 30 - A,Turno A,39e51fd6-be71-4344-a6d3-fad10460dea0,no_cumplido,2026-07-30 03:12:09.971786+00,360
c261d1b0-d401-4f04-8eb5-fff6a00f669d,2026-07-20,Oasis - A,Turno A,de012e62-6b28-4b75-9a40-aa50544d9263,no_cumplido,2026-07-30 03:12:11.410704+00,360
1977727b-2131-4c7b-9705-1a595decf616,2026-07-20,Parajes del Sur - A,Turno A,2470336e-2cf9-42ac-bed4-57b3b70e95cc,no_cumplido,2026-07-30 03:12:06.700134+00,360
28a348e1-3f8b-423d-9c0f-d711f8952f85,2026-07-20,Riveras 7 - A,Turno A,e81c73fc-55d6-4664-a95b-52cfce2f6456,no_cumplido,2026-07-30 03:12:10.822936+00,360
8e81cb17-e2d8-4a60-8567-9ebd18e8e680,2026-07-20,Riveras 9 - A,Turno A,dd47a0d0-3728-49c4-9209-b3434f02f829,no_cumplido,2026-07-30 03:12:11.100361+00,360
b0786e92-38a9-415c-ba5c-3d095e4fc9ed,2026-07-20,Safari - A,Turno A,08e73eed-a881-4e8d-94a8-68dc6efc9f98,no_cumplido,2026-07-30 03:12:10.25432+00,360
e9c40af4-8225-4bc8-8aca-89e9ad0d90d4,2026-07-20,San Isidro - A,Turno A,e69aee51-5454-4671-a7ec-e52fd92cea45,no_cumplido,2026-07-30 03:12:07.504608+00,360
c3c67c0f-2f20-4e62-a5ad-0838600213fe,2026-07-20,Sanders - A,Turno A,99d03094-7909-4ac6-97a6-b2fb0e962518,no_cumplido,2026-07-30 03:12:09.65674+00,360
1d4b196c-35fa-447e-90a8-46077112b7ef,2026-07-20,Sierra Vista - A,Turno A,18a3c32c-e3a7-430d-9c4f-122f944342c8,no_cumplido,2026-07-30 03:12:08.773275+00,360
4a2982c4-388f-4371-bf35-4a8108cb3cfe,2026-07-20,Huertas - B,Turno B,5195a217-6951-49be-8484-77f664c0c1e2,no_cumplido,2026-07-30 03:12:05.154552+00,210
4252f442-9027-43dd-bd97-dcdfffb86ef2,2026-07-20,Juarez Nuevo - B,Turno B,8d5a29f7-1d11-49fa-ae2f-c4758603c9bd,no_cumplido,2026-07-30 03:12:08.485103+00,210
9218d65a-5b19-48a7-8e03-968907d0c358,2026-07-20,Km 30 - B,Turno B,60e616cc-15fd-445f-a6ac-4503f4512512,no_cumplido,2026-07-30 03:12:09.083263+00,210
72f38ebd-9443-463e-bc10-07adcc91bf3a,2026-07-20,Riveras 9 - B,Turno B,09d33cf8-82d3-4b64-af46-b242dfa3c6bf,no_cumplido,2026-07-30 03:12:10.530163+00,210
c71ddf28-07d6-4c2a-aa27-a386a79d1855,2026-07-20,San Jose - B,Turno B,0e5c0ca1-aae4-4d01-8201-bbebd90a1a35,no_cumplido,2026-07-30 03:12:09.39073+00,210
a8ce43f3-7b54-469f-8076-22fae15511a4,2026-07-20,San Jose Auxiliar - B,Turno B,54f817ff-6bf1-4a58-9a4b-9c1552728976,no_cumplido,2026-07-30 03:12:08.141885+00,210
9a6c2f28-7660-48fa-ae13-3aa7a54a5438,2026-07-21,Centro - A,Turno A,40943414-b45c-4b9e-ba59-5b0a8e672196,no_cumplido,2026-07-30 03:12:28.006675+00,360
80d1896c-9079-440d-89e7-de51fd94ef4d,2026-07-21,Colinas - A,Turno A,8b1d859f-7d71-48dd-9e23-c0aeda27dcf2,no_cumplido,2026-07-30 03:12:23.279234+00,360
1c4a0ef7-0ffc-4b2a-aac0-b9997295d9fa,2026-07-21,Finca - A,Turno A,8c95a531-51d6-4c0f-b8fc-7a6a039f53ed,no_cumplido,2026-07-30 03:12:25.634718+00,360
2e842672-11aa-47f3-ac25-c4dfa881afc2,2026-07-21,Finca Auxiliar - A,Turno A,bc9bf112-fecb-4cf1-8087-b95b12a6d399,no_cumplido,2026-07-30 03:12:25.985931+00,360
5ce2a53f-24cc-47c6-bf75-2d508f12e5f7,2026-07-21,Juarez Nuevo - A,Turno A,449af3d5-7289-478c-84e5-b64307256167,no_cumplido,2026-07-30 03:12:24.078301+00,360
284623b3-e84e-4655-a4d2-2e82856a9cb5,2026-07-21,Km 20 - A,Turno A,a35c4220-ca58-4b26-a38e-39714227aa6c,no_cumplido,2026-07-30 03:12:25.215709+00,360
8e310080-3c8e-40e1-9b52-8de3cdc4de37,2026-07-21,Km 30 - A,Turno A,a0fd5591-8c97-48d2-a1e1-10a416817f1e,no_cumplido,2026-07-30 03:12:26.779359+00,360
92e62f50-5167-4443-b54b-cb39b6468692,2026-07-21,Oasis - A,Turno A,45634833-213d-4399-a5d7-4477a1d231f4,no_cumplido,2026-07-30 03:12:23.723836+00,360
039462a8-014c-41f3-9d9b-a77e1262f632,2026-07-21,Parajes del Sur - A,Turno A,e5c0a9a5-b7a8-45a7-8c57-c07f5bc993e6,no_cumplido,2026-07-30 03:12:27.58355+00,360
0d771144-d739-48a8-a309-eec19d6d7dea,2026-07-21,Riveras 7 - A,Turno A,dc139ffc-0d44-4ecd-bd8a-8dcf5394d972,no_cumplido,2026-07-30 03:12:28.384304+00,360
09fa0795-2c5b-4eed-8ee2-88aa0f202427,2026-07-21,Riveras 9 - A,Turno A,1838fe4c-bc27-41b7-ad72-82d0814c6f7c,no_cumplido,2026-07-30 03:12:24.828598+00,360
4cdfe57b-0998-4e76-b626-d65923fb51eb,2026-07-21,Safari - A,Turno A,be8f7aae-4f89-415a-9153-01055d7e55cf,cumplido,2026-07-30 03:12:14.404356+00,360
41bf757e-c1a5-4cb5-bc72-3c4f2d5e406c,2026-07-21,San Isidro - A,Turno A,b6ab7de7-6568-4042-b07e-ddaf74675089,no_cumplido,2026-07-30 03:12:24.437614+00,360
8e727e47-da86-46a3-9abe-864062f6f4f7,2026-07-21,Sanders - A,Turno A,9085c25d-6d1b-45d7-b00a-27778257ee8b,no_cumplido,2026-07-30 03:12:26.358843+00,360
e48a41e2-309c-45a0-ad1b-da4561a1e059,2026-07-21,Sierra Vista - A,Turno A,56f114c8-63a9-4ab4-8109-f5ee99f2e700,no_cumplido,2026-07-30 03:12:27.199525+00,360
1f49106c-35e3-4d3f-874f-3a5e0a04803c,2026-07-21,Huertas - B,Turno B,a6fe9f05-6c46-47fc-97f7-dc8ef20ed2a8,no_cumplido,2026-07-30 03:12:13.985133+00,210
ca5a63cf-c2e2-4683-a537-4947da049679,2026-07-21,Juarez Nuevo - B,Turno B,9f8bd962-f21c-4341-80e8-749e36f73624,no_cumplido,2026-07-30 03:12:16.28719+00,210
fd559446-0c55-466f-8941-6ff7e827234c,2026-07-21,Km 30 - B,Turno B,5eec3588-9b78-462f-be49-7524650aa344,no_cumplido,2026-07-30 03:12:20.349255+00,210
ed9b9ebb-a031-421e-b184-903521d6b1fe,2026-07-21,Riveras 9 - B,Turno B,d13d521d-e528-475a-b5c3-501e54e1c4cb,no_cumplido,2026-07-30 03:12:19.219896+00,210
4df709e3-2535-45f4-8bb2-e1499d8bb7ff,2026-07-21,San Jose - B,Turno B,cea86bf4-f508-43cd-be5f-7aa7b173b7ed,no_cumplido,2026-07-30 03:12:20.666463+00,210
f489bb46-f262-4f72-9c1e-ab883ecab91a,2026-07-21,San Jose Auxiliar - B,Turno B,c3cb1881-e1bd-45f9-b2fe-88c692acc452,no_cumplido,2026-07-30 03:12:17.386585+00,210
8ce66503-68d6-4837-8716-e73d24ceba37,2026-07-22,Centro - A,Turno A,987db5ed-3dc1-47e4-b049-c812c3328ad8,no_cumplido,2026-07-30 03:12:35.409009+00,360
13e6daa3-d634-4fa6-95c1-c2967f5537af,2026-07-22,Colinas - A,Turno A,24d57933-e9f1-4cb5-acbd-3ddd6f4cb9bb,no_cumplido,2026-07-30 03:12:31.883216+00,360
8962bafc-d19e-45fe-9747-8e81982a52af,2026-07-22,Finca - A,Turno A,7d735ce2-a04e-42dc-83cc-e2a288046063,no_cumplido,2026-07-30 03:12:31.441645+00,360
661841ba-e987-4cdd-9ee3-1e08fb74a63e,2026-07-22,Finca Auxiliar - A,Turno A,fc64b7e9-4316-414b-9932-4082a3bf7128,no_cumplido,2026-07-30 03:12:33.784381+00,360
33ef76a6-8601-46cc-93e0-8c6f55f90dbc,2026-07-22,Juarez Nuevo - A,Turno A,d76ae121-474c-489b-8d60-e9285fdc8665,no_cumplido,2026-07-30 03:12:36.944195+00,360
a2aaed4e-19a1-41ee-ad3b-cdae20100270,2026-07-22,Km 20 - A,Turno A,5f63b535-2b34-4abe-9446-b1cf7aa78abd,no_cumplido,2026-07-30 03:12:35.763421+00,360
4a101266-647a-4e93-a848-ce1bd909510d,2026-07-22,Km 30 - A,Turno A,c6e6a005-8407-4e35-8d10-f1de9c7984cc,no_cumplido,2026-07-30 03:12:29.871236+00,360
a6215a7f-8720-443d-9853-6030c89f9fc8,2026-07-22,Oasis - A,Turno A,16254f63-2d94-4b71-9d75-eae8d5a4e9b8,no_cumplido,2026-07-30 03:12:34.742197+00,360
cb4ebfc6-d5ca-4dcf-bc5d-c7985a995e96,2026-07-22,Parajes del Sur - A,Turno A,7880a95f-ed8b-41de-9147-603520c88178,no_cumplido,2026-07-30 03:12:30.70935+00,360
f73e7345-3eda-4bd7-9c6e-0c1d5e377ece,2026-07-22,Riveras 7 - A,Turno A,d467d305-bc10-4349-8910-1939210c34ea,no_cumplido,2026-07-30 03:12:31.080863+00,360
4d667aa9-b455-410d-a877-c98bbdf8fcf3,2026-07-22,Riveras 9 - A,Turno A,4d8546a2-d1c5-4037-a42a-919d0962a6c9,no_cumplido,2026-07-30 03:12:36.503002+00,360
0fb5d23c-52fa-4ce8-aac5-f0a2c9e7b709,2026-07-22,Safari - A,Turno A,03dc605a-95f3-48a9-bbc1-f30191687479,no_cumplido,2026-07-30 03:12:32.239023+00,360
4f6996e8-508a-4f63-bc38-835624bfab46,2026-07-22,San Isidro - A,Turno A,e6128e67-18f0-42dc-af62-bc5751e54825,no_cumplido,2026-07-30 03:12:30.333195+00,360
6cf2000a-0951-4593-b38d-c0ec47a5611a,2026-07-22,Sanders - A,Turno A,022ef97d-4ad9-443e-93f1-dd86e0e1061a,no_cumplido,2026-07-30 03:12:32.991371+00,360
331d3d68-61e8-4f80-97d3-905182c14f07,2026-07-22,Sierra Vista - A,Turno A,5adfe3c8-6f40-4cac-8195-7267eb962098,no_cumplido,2026-07-30 03:12:36.141579+00,360
6ff58edb-dde9-472e-ad5e-b9271410ff72,2026-07-22,Huertas - B,Turno B,9c6aedd0-9a35-4f2d-88e4-936d09b23861,no_cumplido,2026-07-30 03:12:33.426388+00,210
c5e6d878-8819-4cf4-9a0e-53bd3cdb1b69,2026-07-22,Juarez Nuevo - B,Turno B,49fca430-f039-4912-857a-6603eeff57d0,no_cumplido,2026-07-30 03:12:35.112255+00,210
d1ba9005-14e8-4951-90ee-7e259a57312f,2026-07-22,Km 30 - B,Turno B,b3a72f3d-54a0-4908-abf4-5fdc0843b068,no_cumplido,2026-07-30 03:12:34.094122+00,210
6cb50a8a-cb05-42c7-8754-ff4c8ce2ee2d,2026-07-22,Riveras 9 - B,Turno B,a38aceab-a2f9-4e57-92cb-774061e8c3b0,no_cumplido,2026-07-30 03:12:32.54888+00,210
1135b562-ac83-4587-9e4a-cf29c132664d,2026-07-22,San Jose - B,Turno B,8ead999b-4ce5-4a9d-9e6c-8f05aa0f7bd4,no_cumplido,2026-07-30 03:12:34.373647+00,210
eb3ed7a4-c75f-4d25-9d51-8dd64141a799,2026-07-22,San Jose Auxiliar - B,Turno B,82dc24ac-06c6-4e96-a0f5-86f87398b36e,no_cumplido,2026-07-30 03:12:37.277593+00,210
6617e432-2ccc-4705-b45d-417158df29fd,2026-07-23,Centro - A,Turno A,1a6ae903-048e-4017-a67b-3b293c21e644,no_cumplido,2026-07-30 03:12:48.031571+00,360
daec7520-326c-4b91-bb33-1ba293f1bc5a,2026-07-23,Colinas - A,Turno A,68c3228b-66bd-4605-b362-b7b86015d2a1,no_cumplido,2026-07-30 03:12:46.107012+00,360
a33f9628-87a7-42e2-8bdd-a9b7af675cb6,2026-07-23,Finca - A,Turno A,93788e34-bfe6-442c-b65e-c43bdf4caaa0,no_cumplido,2026-07-30 03:12:44.963319+00,360
eb7fcc76-7b5f-4de7-8e96-3ccad23741af,2026-07-23,Finca Auxiliar - A,Turno A,c1b159e9-991d-4d73-8d94-4d97c3c7a66c,no_cumplido,2026-07-30 03:12:42.146035+00,360
2c10bd94-815a-4f05-bfbb-105ccc9d24f5,2026-07-23,Juarez Nuevo - A,Turno A,b34a1bc2-3482-42f5-bcaa-2996aade7a51,no_cumplido,2026-07-30 03:12:42.98128+00,360
569ec881-24c8-49cd-bdc2-12d49a267733,2026-07-23,Km 20 - A,Turno A,88e141ef-973c-45a3-9774-5f1a5dd06625,no_cumplido,2026-07-30 03:12:40.528017+00,360
eab69015-5f66-49d3-b622-ccf367520589,2026-07-23,Km 30 - A,Turno A,79a48fe8-94ee-4085-a7c1-644c27098377,no_cumplido,2026-07-30 03:12:41.446354+00,360
d75ed756-714e-4505-b217-d30383fdac03,2026-07-23,Oasis - A,Turno A,147d473e-ffbc-4786-a455-23685d3caba6,no_cumplido,2026-07-30 03:12:43.382747+00,360
b1b114e5-38e7-46e8-a942-3100569f8a75,2026-07-23,Parajes del Sur - A,Turno A,893d4c53-a5dd-4fe1-91e6-6f26a09edef9,no_cumplido,2026-07-30 03:12:42.536764+00,360
420e4e4e-99d4-414e-b1f9-7b3f8068ad7f,2026-07-23,Riveras 7 - A,Turno A,8e632e4c-0730-4136-8ec3-361cba9b443b,no_cumplido,2026-07-30 03:12:44.584052+00,360
04163c9d-171e-4201-a32a-38274cfb5ea8,2026-07-23,Riveras 9 - A,Turno A,76e39b31-3bdf-4541-9073-cc66e0eeccbf,no_cumplido,2026-07-30 03:12:46.904376+00,360
96ebda1d-df35-421a-8797-8c047b6d3218,2026-07-23,Safari - A,Turno A,9aa95ba3-6efe-457f-b988-414d6553ff8e,no_cumplido,2026-07-30 03:12:45.351551+00,360
b5e21ff8-6657-43ab-a71b-a50c34c1bc1a,2026-07-23,San Isidro - A,Turno A,6a09e046-11d9-4f4f-b77c-0c1acb45ef3f,no_cumplido,2026-07-30 03:12:46.496618+00,360
1875af59-bac2-431a-bac7-6c568d2c12fa,2026-07-23,Sanders - A,Turno A,243f7c40-eaeb-45d0-9f72-d01bb1f08bd0,no_cumplido,2026-07-30 03:12:43.762008+00,360
d9b40669-da30-460a-bd37-c70fddd60d3d,2026-07-23,Sierra Vista - A,Turno A,3bbd3ed2-9641-42ff-855a-49049e089278,no_cumplido,2026-07-30 03:12:47.317396+00,360
7531c9aa-5ab0-4e48-80e7-ae4d39111caa,2026-07-23,Huertas - B,Turno B,3fdafddc-d9fd-44a7-af93-546812139e97,no_cumplido,2026-07-30 03:12:48.376407+00,210
941fed48-374a-41c9-80ef-464973ec5612,2026-07-23,Juarez Nuevo - B,Turno B,bff5a3ec-e614-4e8f-888c-830222431c6a,no_cumplido,2026-07-30 03:12:45.675028+00,210
d4ffdd71-b4ff-4cf2-862a-0774ea4c6881,2026-07-23,Km 30 - B,Turno B,ca2ae260-f6a3-4d89-84ce-2d0ee64c27b6,no_cumplido,2026-07-30 03:12:44.142932+00,210
5f29cba3-9460-41bc-822f-17d605850daa,2026-07-23,Riveras 9 - B,Turno B,360a7df8-3c94-47be-b7ad-553efb20b6e6,no_cumplido,2026-07-30 03:12:40.9107+00,210
b84c9f43-2183-4cd4-bd39-b9c8249459e8,2026-07-23,San Jose - B,Turno B,628df68a-aee7-4cf7-9fd8-781ac026f56a,no_cumplido,2026-07-30 03:12:47.695001+00,210
0847810b-9ce9-4f44-9ec7-03ad59ceeffd,2026-07-23,San Jose Auxiliar - B,Turno B,4a1d97fe-6d74-4d1c-9a3b-7606bf920a1c,no_cumplido,2026-07-30 03:12:41.789652+00,210
a52d31c6-a025-4f71-b85b-a9367a374084,2026-07-24,Centro - A,Turno A,756d96d6-b729-4c43-93b7-c502185ecaba,no_cumplido,2026-07-30 03:12:56.335916+00,360
c15fbc32-7866-487c-8922-de3f50b8d2f1,2026-07-24,Colinas - A,Turno A,a15f3876-d7f9-46e0-8fbd-9348f65e104a,no_cumplido,2026-07-30 03:12:55.948576+00,360
211eb018-0544-46a3-8cf4-b609096802b2,2026-07-24,Finca - A,Turno A,f3985b0d-a443-465d-bb56-d743dcc9c207,no_cumplido,2026-07-30 03:12:55.251381+00,360
41141338-307c-4610-a9f3-18b6e1155384,2026-07-24,Finca Auxiliar - A,Turno A,20d2064e-c66d-4d84-83fe-aced01b02f90,no_cumplido,2026-07-30 03:12:54.903177+00,360
453e55c7-88d1-4633-8c08-5c95fbb1b401,2026-07-24,Juarez Nuevo - A,Turno A,6aca24ba-5d82-4b30-9cc3-2d61764613a9,no_cumplido,2026-07-30 03:12:54.188141+00,360
c031e55a-cc64-474d-9b09-9a5283e9799e,2026-07-24,Km 20 - A,Turno A,f5eea677-f53e-4b8c-a2e4-7dfcde06b296,no_cumplido,2026-07-30 03:12:54.520431+00,360
06f8a382-ce73-4d86-86e0-1c7fa548d054,2026-07-24,Km 30 - A,Turno A,f796a1d8-9716-47d3-a465-b65b3c50b243,no_cumplido,2026-07-30 03:12:52.66848+00,360
5908bc13-77ab-4cfc-a14d-457907c21661,2026-07-24,Oasis - A,Turno A,ded2e8a4-44ea-47c7-bb08-5c1e223caabe,no_cumplido,2026-07-30 03:12:59.162442+00,360
57ea6a6c-f399-4f15-8d00-453f5ca71cad,2026-07-24,Parajes del Sur - A,Turno A,98d356c9-60fd-46d6-b498-be35c8bafa4c,no_cumplido,2026-07-30 03:12:53.105159+00,360
099bb200-5074-4dea-af9b-04acb8530210,2026-07-24,Riveras 7 - A,Turno A,48160bb9-3577-46a8-929f-6c2c535aef2f,no_cumplido,2026-07-30 03:12:58.767288+00,360
1c71e987-d941-4f4e-8b20-50024544c560,2026-07-24,Riveras 9 - A,Turno A,801b47f3-957b-49d8-a339-dd409e5774f7,no_cumplido,2026-07-30 03:12:51.87823+00,360
553687e1-ff59-4f2f-9033-aa5b4a8a045b,2026-07-24,Safari - A,Turno A,2794443c-0c2d-448e-ad38-3272fdbb8d38,no_cumplido,2026-07-30 03:12:52.275913+00,360
f47c5976-b133-44c3-af2d-ab70b107f72e,2026-07-24,San Isidro - A,Turno A,100fc42c-7334-4ced-a8f6-1c9fd9ef1c00,no_cumplido,2026-07-30 03:12:56.685952+00,360
2696e40f-901b-48c7-b54c-b40d62ce21a4,2026-07-24,Sanders - A,Turno A,7557f8c3-7e54-4080-a4e7-1fcb8083ebe9,no_cumplido,2026-07-30 03:12:58.084438+00,360
93c2b650-fe7c-43a8-b0c7-0a6f75a25fc6,2026-07-24,Sierra Vista - A,Turno A,99eb57f3-5c45-47c3-a7b2-0cf9c80bafb2,no_cumplido,2026-07-30 03:12:57.413479+00,360
0fe379e1-38b6-4611-9487-67e94034b6b6,2026-07-24,Huertas - B,Turno B,ad853f50-ef4c-46cd-989e-a6a6b15785c6,no_cumplido,2026-07-30 03:12:55.608914+00,210
860db06b-20ec-422e-9eb7-e558b799fa7e,2026-07-24,Juarez Nuevo - B,Turno B,75433585-bfdb-47c5-afa7-99337a164653,no_cumplido,2026-07-30 03:12:53.843133+00,210
dcf32eb7-d75a-4b45-a61d-baa99f483e34,2026-07-24,Km 30 - B,Turno B,bfa2f6cc-2bc8-400a-b74d-7d24a66fd454,no_cumplido,2026-07-30 03:12:53.447949+00,210
a044ff4a-c41d-4d07-becf-4eb2a4677d3d,2026-07-24,Riveras 9 - B,Turno B,f168e7cd-9c18-4af4-b6fb-3366b5017d9d,no_cumplido,2026-07-30 03:12:58.411538+00,210
afa6f30e-ddb0-42b2-bf2c-f306227a2830,2026-07-24,San Jose - B,Turno B,58615539-014e-47c0-b701-05ba0f30965c,no_cumplido,2026-07-30 03:12:57.727049+00,210
7845d620-2e66-4e36-b998-5b8c435c3b1f,2026-07-24,San Jose Auxiliar - B,Turno B,d33fc0dc-d60b-4485-93f0-66ceb9af6bf9,no_cumplido,2026-07-30 03:12:57.039789+00,210
54446cd0-29fb-467e-bf35-2b5579d21bd6,2026-07-27,Centro - A,Turno A,12c89dcc-c17c-45e9-863a-ea34f8c54534,no_cumplido,2026-07-27 19:15:28.855104+00,360
b7e20471-f49f-4699-a9e1-ac06272234c2,2026-07-27,Colinas - A,Turno A,22d95882-60d8-43ca-8912-c555b0eb4b39,no_cumplido,2026-07-27 19:15:29.335667+00,360
62822d35-c1a2-472b-8f4d-8cdc5c7b359d,2026-07-27,Finca - A,Turno A,962809df-3d3e-4d03-985d-8f409846a309,no_cumplido,2026-07-27 19:15:31.582817+00,360
bfbbbf3a-5ca2-43d2-8a19-06114d764906,2026-07-27,Finca Auxiliar - A,Turno A,155bd34f-ec47-474d-8c08-34fd9a837422,no_cumplido,2026-07-27 19:15:22.271921+00,360
78f5fe18-d7bc-44bb-86f2-2825218506ed,2026-07-27,Juarez Nuevo - A,Turno A,6a7e44ba-d82f-4d56-a6bb-311b44d8ec10,no_cumplido,2026-07-27 19:15:26.03157+00,360
855f5531-3bda-4852-b83f-cbf721e7c54d,2026-07-27,Km 20 - A,Turno A,2b595dcc-59dc-48ae-b27c-b6ebb8deca18,no_cumplido,2026-07-27 19:15:31.098281+00,360
b8be5390-6aca-44f2-b9e0-475de4b7b7f2,2026-07-27,Km 30 - A,Turno A,f700d031-62a3-482e-87ce-8a5265723c8b,no_cumplido,2026-07-27 19:15:25.085657+00,360
c25c3596-9a2f-4750-874d-9184b1280332,2026-07-27,Oasis - A,Turno A,84d16d92-9a64-4c23-a6aa-1ef57b96166a,no_cumplido,2026-07-27 19:15:22.77866+00,360
9ebe5e06-7ef2-473c-9495-cffd9dcf1a5c,2026-07-27,Parajes del Sur - A,Turno A,e1c73f9f-eaba-4382-a7f8-dc8b5ce504cb,no_cumplido,2026-07-27 19:15:23.125974+00,360
e788bf58-f0f7-4162-abf0-30cc4bf0aded,2026-07-27,Riveras 7 - A,Turno A,e864fc83-4408-4eae-b9dd-bec39348ae98,no_cumplido,2026-07-27 19:15:23.824981+00,360
e0c21d1d-a182-4ade-abc0-72470a8abd35,2026-07-27,Riveras 9 - A,Turno A,2dcc80b1-680d-4fbd-be46-5848f84c362e,no_cumplido,2026-07-27 19:15:30.094841+00,360
bc2faf85-7f1c-47a5-b5b8-134e1dae3b98,2026-07-27,Safari - A,Turno A,32257e18-3bd0-4c83-98b5-8c86059de163,no_cumplido,2026-07-27 19:15:27.769527+00,360
3fe77003-f3fd-4e14-b461-0d43904115d6,2026-07-27,San Isidro - A,Turno A,25401473-5fb7-427e-8a34-e7ef6f08ecbb,no_cumplido,2026-07-27 19:15:28.425222+00,360
80a0ef47-b5da-4131-9b61-c058d62bbf4a,2026-07-27,Sanders - A,Turno A,0b670446-a991-4391-8d40-cb918c75efae,no_cumplido,2026-07-27 19:15:24.260789+00,360
f1ca176a-878e-445f-a098-33e99acfbc12,2026-07-27,Sierra Vista - A,Turno A,e0f99015-d4bd-43d6-88d2-73a159d480b0,no_cumplido,2026-07-27 19:15:25.528874+00,360
edc8df37-37af-460e-8140-ca53b1038653,2026-07-27,Huertas - B,Turno B,a7878cf2-dd2e-45eb-b0ef-8b7540f90b0f,no_cumplido,2026-07-27 19:15:30.485722+00,210
27fa600b-b280-4f62-a09f-aa509978cf9a,2026-07-27,Juarez Nuevo - B,Turno B,13fb8eb9-99ee-4133-8322-add24e4c9ef4,no_cumplido,2026-07-27 19:15:26.403605+00,210
3ba03bf1-a9a7-4127-beef-9951e8d20fb6,2026-07-27,Km 30 - B,Turno B,18a300a2-e6c4-4a8a-a4ae-42ea722eb138,no_cumplido,2026-07-27 19:15:23.473377+00,210
86223ff3-3b83-4c60-bcf7-451e1fed862e,2026-07-27,Riveras 9 - B,Turno B,377bea60-3040-473f-aba6-d5abd81bd6ad,no_cumplido,2026-07-27 19:15:26.752507+00,210
d91acaa6-7901-47a9-8f21-5e222d4b8b17,2026-07-27,San Jose - B,Turno B,8403bcd1-709c-413a-9869-aecfc5db7d6f,no_cumplido,2026-07-27 19:15:24.607942+00,210
52ce1cca-d1b9-4d18-bca9-8303a091f4bb,2026-07-27,San Jose Auxiliar - B,Turno B,0e6918ee-7c1c-476f-9ba8-7164bff559c3,no_cumplido,2026-07-27 19:15:27.220845+00,210
fbb6d6b7-d3a5-43ca-abc9-ac6104573e04,2026-07-28,Centro - A,Turno A,e61c28de-daff-43cd-b8cd-b081250276c0,pendiente_evidencia,2026-07-28 11:05:41.36175+00,360
a18cc0db-4202-43f3-ae7f-7d04bd671360,2026-07-28,Colinas - A,Turno A,a5d34a46-72ae-4070-83c6-1bada4e39778,pendiente_evidencia,2026-07-28 11:05:41.669825+00,360
427b658e-af6b-427c-8bbb-d904f19152ca,2026-07-28,Finca - A,Turno A,27188fdd-b16a-49d1-9ae0-6f9df6d8d8ef,pendiente_evidencia,2026-07-28 11:05:41.952254+00,360
f945d569-290a-43b9-8064-01228c73c2b0,2026-07-28,Finca Auxiliar - A,Turno A,66ac3f60-e32d-4dff-af12-83ddb69e8f7f,pendiente_evidencia,2026-07-28 11:05:42.27389+00,360
fcf2c06d-fad8-4824-bc97-8b3d8f30b70a,2026-07-28,Juarez Nuevo - A,Turno A,c950d856-9f5f-4cb2-b5c5-32176dc3ba84,pendiente_evidencia,2026-07-28 11:05:42.855378+00,360
c47ae97f-85c9-4ba3-ae93-98a4ff460e92,2026-07-28,Km 20 - A,Turno A,faefb720-2e4f-4124-9172-a9648d45edbf,pendiente_evidencia,2026-07-28 11:05:42.543864+00,360
f4e2df79-983f-4abe-b109-a13d27174120,2026-07-28,Km 30 - A,Turno A,f0c159a7-bc7a-4be9-a321-b6c187df60c0,pendiente_evidencia,2026-07-28 11:05:43.170286+00,360
b685e8f5-7135-4ddf-bd93-0334cc5d8f88,2026-07-28,Oasis - A,Turno A,78ff521e-a9e8-48ef-ad22-02f50bc32171,pendiente_evidencia,2026-07-28 11:05:44.095073+00,360
c8ba4283-a77b-494b-ab49-41dd70cd39e8,2026-07-28,Parajes del Sur - A,Turno A,7b0f6795-00c1-45ae-a28e-452d70273da6,pendiente_evidencia,2026-07-28 11:05:39.861612+00,360
a9fddfcd-d2ed-4f04-950d-90450ca900e9,2026-07-28,Riveras 7 - A,Turno A,18420c95-bcca-467d-8c61-444b33cf9b1d,pendiente_evidencia,2026-07-28 11:05:40.159409+00,360
34d091ff-be35-49b8-81dc-53490c054a5d,2026-07-28,Riveras 9 - A,Turno A,143a38ae-1586-4226-b737-d5b639f98bba,pendiente_evidencia,2026-07-28 11:05:43.765347+00,360
39c0242d-1a55-441e-a8b1-87192c81402a,2026-07-28,Safari - A,Turno A,9f4e0fba-51f8-4a26-9dd9-8e309873e361,pendiente_evidencia,2026-07-28 11:05:43.467457+00,360
4cf7de1e-634c-4f2b-8dbc-43e112386add,2026-07-28,San Isidro - A,Turno A,6f92cd67-f47a-4595-880a-8b85e9042c7b,pendiente_evidencia,2026-07-28 11:05:41.060182+00,360
d2ce71de-b053-4ccb-ad67-77747dde41ab,2026-07-28,Sanders - A,Turno A,3f199a65-ed3a-4a3d-8a78-d8e58b4148ed,pendiente_evidencia,2026-07-28 11:05:40.458877+00,360
e9c898e8-06e4-4a22-b953-b05da6dbd3bd,2026-07-28,Sierra Vista - A,Turno A,fc85f2db-4fd8-4629-9c23-cc1371bef5c0,pendiente_evidencia,2026-07-28 11:05:40.755371+00,360
3446af1a-c092-493f-aac8-aabc29518ac3,2026-07-28,Huertas - B,Turno B,dea6a5d9-6764-4c7b-8c02-916bb8dc9310,no_cumplido,2026-07-28 18:00:18.518865+00,210
e7c791e6-319e-4c18-bec8-36b771fd7bf6,2026-07-28,Juarez Nuevo - B,Turno B,3faa5e0a-3888-4a14-8f1b-e6c82af64131,no_cumplido,2026-07-28 18:00:19.131622+00,210
7eeb6f16-c11e-4e84-8d56-9a6bd37c05fc,2026-07-28,Km 30 - B,Turno B,26ecb6d4-fcd7-42cd-94a2-7c29c9b70441,no_cumplido,2026-07-28 18:00:19.720156+00,210
892bbfca-e571-426a-8b70-22928cfb0631,2026-07-28,Riveras 9 - B,Turno B,808f1876-00d0-4ddb-a023-b085c9f9affd,no_cumplido,2026-07-28 18:00:17.228831+00,210
4726148e-ccaf-4ec7-a1b8-1108110c891b,2026-07-28,San Jose - B,Turno B,c2e8c841-e910-4ebf-ad9e-a5bc8d5cc108,no_cumplido,2026-07-28 18:00:16.654283+00,210
4d8bba38-24e8-4bd2-8347-8f9289e7411a,2026-07-28,San Jose Auxiliar - B,Turno B,39e2a477-835b-4226-b6f8-03a11d22196e,no_cumplido,2026-07-28 18:00:17.88228+00,210
e1dfa04b-7221-4d50-a87a-7fa8ec9ee48f,2026-07-29,Huertas - B,Turno B,a8832cc9-92f6-4991-8bc8-f4a77bc2a242,no_cumplido,2026-07-30 00:01:42.619858+00,-150
b6f37129-29e4-46a8-afe3-881b64ea812a,2026-07-29,Juarez Nuevo - B,Turno B,1bd1a4c5-3fc6-43a4-8201-02b261fac2e0,no_cumplido,2026-07-30 00:01:43.308143+00,-150
676641b0-7646-43f1-a448-051280bc1cea,2026-07-29,Km 30 - B,Turno B,9189dca3-fca8-4577-9485-23eb811658fb,no_cumplido,2026-07-30 00:01:40.480642+00,-150
b7438cd1-5227-4bb6-946c-9f0da79b05e2,2026-07-29,Riveras 9 - B,Turno B,51d4eb22-406e-47fa-aa4c-f69977cae007,no_cumplido,2026-07-30 00:01:41.867907+00,-150
6ff712a1-197a-439b-94e6-c6760b10b8ac,2026-07-29,San Jose - B,Turno B,5f312973-8072-4924-a6ef-ffd2d110d5ea,no_cumplido,2026-07-30 00:01:43.97681+00,-150
31a87c5e-fbde-4a74-9ef7-ea997e52d71b,2026-07-29,San Jose Auxiliar - B,Turno B,179f90e6-1771-44f5-a319-5575cb8aeeec,no_cumplido,2026-07-30 00:01:41.233082+00,-150
```
