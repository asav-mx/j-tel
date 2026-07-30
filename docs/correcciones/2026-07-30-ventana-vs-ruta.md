# Ventana de observación vs. duración real de la ruta

**Generado:** 2026-07-30 · solo lectura, no toca el motor, hechos ni cron.

Origen: en Huertas-B, 96% de los puntos GPS caen a <150 m del trazado
(mediana 60 m) pero el 45% inicial del KML (9.5 km contiguos) no tiene NI
UN punto porque la ventana de observación abre después de que la ruta ya
arrancó. El match se mide contra el KML completo → no puede pasar de ~55%
aunque se maneje perfecto. Esto mide cuántas rutas más comparten ese
problema estructural, en Tecma 47 y Campus Santos Dumont.

**Método:** por cada ruta, 2 ocurrencias representativas (las más
tempranas con viaje). Búsqueda de telemetría AMPLIA (deadline −4h a
+3h, sin el recorte de la ventana configurada) para encontrar la mejor
candidata real. `match_max%` = fracción de waypoints del KML cuyo punto
más cercano (≤120 m) cae DENTRO de la ventana configurada del contrato —
el techo matemático de lo que ese contrato puede llegar a medir, para esa
ruta, sin importar qué tan bien maneje el carrier.

| Contrato | Ruta | Turno | Ventana (min) | Duración real (min) | KML (km) | Match máx. % | Umbral % | ¿Condenada? |
|---|---|---|---:|---:|---:|---:|---:|---|
| TECMA Campus Santos Dumont - Juarez Bus | Sanders | Segundo Turno | 115 | 370 | 12.3 | 37.5 | 60 | **SÍ** |
| Tecma 47 - Transporte Personal | Huertas - B | Turno B | 105 | 96 | 29.5 | 44.3 | 60 | **SÍ** |
| Tecma 47 - Transporte Personal | San Jose - B | Turno B | 105 | 229 | 31.8 | 45.3 | 60 | **SÍ** |
| Tecma 47 - Transporte Personal | Riveras 7 - A | Turno A | 105 | 258 | 24.9 | 45.9 | 60 | **SÍ** |
| Tecma 47 - Transporte Personal | San Jose Auxiliar - B | Turno B | 105 | 282 | 36.2 | 46.3 | 60 | **SÍ** |
| Tecma 47 - Transporte Personal | Km 30 - B | Turno B | 105 | 191 | 32.1 | 47.7 | 60 | **SÍ** |
| Tecma 47 - Transporte Personal | Parajes del Sur - A | Turno A | 105 | 73 | 31.2 | 48.5 | 60 | **SÍ** |
| Tecma 47 - Transporte Personal | Riveras 9 - B | Turno B | 105 | 217 | 22.5 | 49.3 | 60 | **SÍ** |
| TECMA Campus Santos Dumont - Juarez Bus | Km 30 | Turno B | 115 | 205 | 17.4 | 50.0 | 60 | **SÍ** |
| TECMA Campus Santos Dumont - Juarez Bus | Juarez Nuevo | Primer Turno | 115 | 42 | 11.9 | 52.0 | 60 | **SÍ** |
| TECMA Campus Santos Dumont - Juarez Bus | Riveras | Turno B | 115 | 143 | 27.4 | 54.3 | 60 | **SÍ** |
| TECMA Campus Santos Dumont - Juarez Bus | Finca | Turno B | 115 | 91 | 20.2 | 55.8 | 60 | **SÍ** |
| Tecma 47 - Transporte Personal | Juarez Nuevo - B | Turno B | 105 | 106 | 20.0 | 56.6 | 60 | **SÍ** |
| Tecma 47 - Transporte Personal | Km 30 - A | Turno A | 105 | 117 | 34.7 | 56.8 | 60 | **SÍ** |
| Tecma 47 - Transporte Personal | Sierra Vista - A | Turno A | 105 | 104 | 34.1 | 57.4 | 60 | **SÍ** |
| Tecma 47 - Transporte Personal | Centro - A | Turno A | 105 | 53 | 17.7 | 58.8 | 60 | **SÍ** |
| TECMA Campus Santos Dumont - Juarez Bus | Km 30 | Segundo Turno | 115 | 205 | 20.3 | 62.5 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Riveras 7 | Primer Turno | 115 | 239 | 31.8 | 63.3 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Oasis | Turno B | 115 | 124 | 13.0 | 65.3 | 60 | no |
| Tecma 47 - Transporte Personal | Finca Auxiliar - A | Turno A | 105 | 53 | 28.6 | 65.8 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Oasis | Segundo Turno | 115 | 335 | 10.4 | 70.1 | 60 | no |
| Tecma 47 - Transporte Personal | Riveras 9 - A | Turno A | 105 | 60 | 21.9 | 70.3 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Juarez Nuevo | Segundo Turno | 115 | 79 | 9.5 | 71.2 | 60 | no |
| Tecma 47 - Transporte Personal | Finca - A | Turno A | 105 | 53 | 27.9 | 72.0 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | San Jose | Segundo Turno | 115 | 194 | 26.1 | 72.2 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Haciendas | Primer Turno | 115 | 65 | 14.3 | 74.8 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Finca Auxiliar | Primer Turno | 115 | 82 | 30.4 | 76.0 | 60 | no |
| Tecma 47 - Transporte Personal | San Isidro - A | Turno A | 105 | 76 | 26.7 | 76.9 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Sierra Vista | Turno B | 115 | 147 | 24.5 | 77.1 | 60 | no |
| Tecma 47 - Transporte Personal | Oasis - A | Turno A | 105 | 97 | 24.2 | 78.9 | 60 | no |
| Tecma 47 - Transporte Personal | Juarez Nuevo - A | Turno A | 105 | 75 | 19.3 | 78.9 | 60 | no |
| Tecma 47 - Transporte Personal | Safari - A | Turno A | 105 | 90 | 21.3 | 79.2 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Colinas | Primer Turno | 115 | 55 | 7.7 | 79.5 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Km 30 | Primer Turno | 115 | 318 | 20.5 | 79.8 | 60 | no |
| Tecma 47 - Transporte Personal | Colinas - A | Turno A | 105 | 82 | 26.0 | 79.8 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Haciendas | Segundo Turno | 115 | 132 | 18.0 | 80.7 | 60 | no |
| Tecma 47 - Transporte Personal | Sanders - A | Turno A | 105 | 79 | 20.2 | 82.9 | 60 | no |
| Tecma 47 - Transporte Personal | Km 20 - A | Turno A | 105 | 52 | 15.0 | 83.6 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Oasis | Primer Turno | 115 | 67 | 15.7 | 85.2 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Sierra Vista | Primer Turno | 115 | 192 | 26.0 | 85.8 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Finca | Primer Turno | 115 | 115 | 19.5 | 88.5 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Sanders | Primer Turno | 115 | 105 | 18.2 | 89.6 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Parajes del Sur | Primer Turno | 115 | 112 | 20.0 | 91.3 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | San Isidro | Primer Turno | 115 | 159 | 14.8 | 91.7 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Riveras | Segundo Turno | 115 | 67 | 7.3 | 92.3 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Km 27 | Primer Turno | 115 | 76 | 15.5 | 95.4 | 60 | no |
| TECMA Campus Santos Dumont - Juarez Bus | Huertas | Segundo Turno | 115 | 66 | 5.8 | 98.5 | 60 | no |

## Impacto en hechos sellados

- **TECMA Campus Santos Dumont - Juarez Bus:** 41/171 `no_cumplido` caen en ruta condenada.
- **Tecma 47 - Transporte Personal:** 153/268 `no_cumplido` caen en ruta condenada.
- **Total: 194/439 no_cumplido son, por construcción, imposibles de aprobar en la ruta representativa medida.**
