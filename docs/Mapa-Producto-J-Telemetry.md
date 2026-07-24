# Mapa de Producto — J-Telemetry

**Tipo:** documento de referencia. Entra al repo por PR en `docs/`. No es especificación de pantallas — es el mapa de qué es cada producto, para quién, en qué fase, y qué NO es.

**Jerarquía:** el `Marco-Limpio-J-Telemetry-MAESTRO.md` manda. Si algo aquí choca con el Marco, gana el Marco. Este mapa organiza y extiende lo que el Marco ya anticipa (Pieza 2: las dos caras; capa programable; futuro del pasajero).

**Origen:** sesión de diseño de UI, 22 jul 2026. Consolidación de los descubrimientos: preventivo/correctivo, producto de flota de día completo, micro–macro, y la lista de valor por tipo de cliente aportada por Asav.

---

## 1. Los dos clientes de J-Tel

J-Tel vende a **dos tipos de cuenta, y ambos son clientes comerciales**:

| | Cuenta cliente (corporativo/planta) | Cuenta carrier |
|---|---|---|
| **Qué compra** | Confianza: el veredicto que sostiene pagos y descuentos | Operación: la gestión de su flota y su defensa |
| **Producto núcleo** | El árbitro (veredictos + expedientes) | La flota de día completo |
| **Existe sin contrato** | No — se enciende con contrato | Sí — la flota vale sola |

"Cliente" dentro del sistema nombra el rol contractual (quien audita). Comercialmente, los dos pagan. Cada verificación genera valor en ambas puntas — esa es la simetría del negocio.

---

## 2. Producto carrier — la flota de día completo

**Tesis:** el contrato ocupa ~20-30% del día de cada unidad. El resto del día es donde vive el costo del carrier, y hoy nadie se lo mide.

**Principio de recolección:** la ventana y la geocerca son reglas de **qué se enseña al cliente**, no de qué se recolecta. Se ingesta el día completo; cada cara ve su recorte.

### 2.1 Superficies (de macro a micro, mismo idioma)

1. **Flota** — 52 tiras de 24h, KPIs del día, hallazgos ordenados por cuándo cuestan.
2. **Unidad** — la misma tira de cerca: segmentos, tabla del día, signos vitales, hallazgos propios.
3. **Segmento/expediente** — un viaje o un servicio con su detalle.
4. **Torre en vivo** — estado actual de la flota + **prealertas** ("faltan 40 min para el deadline y la unidad no sale"). No es vigilancia para juzgar (eso lo hace el árbitro solo); es awareness operativo.

### 2.2 Hallazgos del producto de flota (catálogo inicial)

- **Preventivo espejo** — la misma deriva/patrón que verá el cliente, mostrada al carrier ANTES. "Corrígelo antes de que tu cliente vea un rojo." Mismo motor, consecuencia volteada.
- **Kilómetro muerto** — traslados vacíos, circuitos repetidos, puntos de espera mal ubicados.
- **Ralentí** — motor encendido sin movimiento. El GPS lo delata (posición fija + reporte activo).
- **Flota ociosa** — unidades sin producir; capacidad parada medida, decisión del admin.
- **Salud del equipo GPS** — huecos por unidad, patrón (p.ej. al arrancar motor), diagnóstico. Conecta directo al dinero: hueco en ventana = pendiente = servicio que ni se cobra ni se defiende.

### 2.3 Registro de choferes y pre-nómina

- **Registro de choferes** (el Marco ya lo contempla): licencias, médicos, capacitación, y la **asignación declarada** chofer–unidad–turno, capturada por el Coordinador.
- **Regla de honestidad:** el GPS identifica unidades, no personas. El eslabón chofer–viaje = asignación declarada + viaje medido. Sin declaración no hay inferencia.
- **Pre-nómina** (sí): "chofer X: N viajes identificados en la quincena, unidades, horas" — el reporte que alimenta la nómina del carrier.
- **Nómina completa (NO):** J-Tel no corre nóminas (IMSS, impuestos, incidencias). Frontera de producto.

### 2.4 Combustible y rendimiento

- **Registro de cargas de diésel** — manual al inicio (litros, fecha, unidad, quién capturó). El Marco ya lo lista.
- **Rendimiento** = km medidos por GPS ÷ litros cargados. El GPS ya pone la mitad de la fórmula.
- Diseñar el modelo de datos desde ahora; la fuente de captura evoluciona (manual → hardware → copiloto) sin rediseño.

### 2.5 Estado de cuenta del contrato

- Documento mensual derivado de hechos sellados: "julio: 412 servicios, 396 cumplidos, 9 descuentos, rebate 2%, total a facturar X". Exportable. La pre-factura que hoy arma un contador a mano.
- **Contabilidad completa (NO):** J-Tel no es software contable. Frontera de producto.

---

## 3. Producto cliente — el árbitro y sus derivados

### 3.1 Núcleo (diseñado)
- **Jornada** (correctivo): los veredictos del turno, excepciones primero, lo limpio en cajón.
- **Expediente**: el porqué de cada veredicto, recortado por cara (planta ve hasta la geocerca; sin unidad acreditada no hay trazas).
- **Preventivo**: hallazgos ordenados por cuándo revientan (camino candidato, deriva, escalón contractual, huecos).
- **Panorama corporativo**: pantalla propia, mismo idioma, agregado de plantas.

### 3.2 Quejas — la mitad cualitativa (nuevo, prioritario)
- El GPS mide si el camión llegó; la queja mide si el servicio fue digno (chofer, estado de la unidad, trato).
- **Mismo riel que el circuito de incidentes, flecha volteada:** planta → carrier, con folio, evidencia y rastro. Mata el WhatsApp/correo de las 6 am.
- Los dos sentidos del riel:
  - Carrier → planta: motivo excusable (ya en ficha pendiente de desarrollo).
  - Planta → carrier: queja de servicio (nuevo).
- Un servicio puede estar 100% cumplido y ser mal servicio. Las dos mitades juntas = expediente completo.

### 3.3 Demanda real (fase 2, atada a hardware)
- Conteo de abordaje — capacidad instalada vs. real por zona ("zona X al 40%, zona Y al 70%").
- Deriva: rediseño de rutas con datos, licitaciones con demanda real (no estimada), mapa de zonas (eficiencia, rotación, seguridad).
- El Marco ya anticipa al pasajero como usuario futuro (habilita ausentismo por adelantado).
- **Regla de honestidad:** el GPS no cuenta personas. Sin sensor de abordaje, no se afirma demanda.
- **Datos de empleados** (domicilios, rotación): data personal — requiere marco legal propio. Va con abogado, junto con el renglón de uso de datos del contrato.

---

## 4. Fases

**Fase 1 (ahora):** árbitro completo + flota sobre ventanas ampliándose a día completo vía Archivador.
**Fase 1.5:** quejas bidireccionales · registro de choferes + asignaciones · cargas de diésel manuales · estado de cuenta · prealerta en torre.
**Fase 2 (con hardware propio):** ingesta 24h nativa (Traccar + equipos propios) · conteo de abordaje · demanda real · pre-nómina completa · capa programable / copiloto AI.

**Dependencia estructural:** el producto de flota de día completo necesita ingesta 24h. Por Umbrella, eso multiplica el costo de consultas — **el producto de flota es el business case del hardware propio.** La estrategia de datos y el producto se justifican mutuamente.

---

## 5. Pendientes de definición

- **Lenore** — mencionado como AI interno / copiloto. No existe en ningún documento del proyecto. Definir: qué es, qué audita, dónde vive. Asiento natural: la "capa programable" del carrier (Marco, Pieza 2). *(Pendiente de que Asav lo describa.)*
- **Tiers comerciales** — el orden natural ya existe (carrier básico → carrier verificado → cliente → fase 2); precios y nombres, después.
- **Renglón contractual de uso de datos** — J-Tel usa data agregada para mejorar el motor. Va en contrato/términos, con abogado.

---

## 6. Las fronteras (lo que J-Tel NO es)

1. No es software contable (sí: estado de cuenta del contrato).
2. No corre nóminas (sí: pre-nómina derivada de viajes).
3. No afirma lo que no midió: sin sensor no hay conteo de pasajeros; sin asignación declarada no hay chofer–viaje; sin evidencia no hay incumplimiento.
4. No resucita al monitorista: la torre es awareness y prealerta, nunca vigilancia para juzgar.
5. El código nunca conoce nombres — cuentas, plantas, rutas, calles y personas son datos, no constantes.
