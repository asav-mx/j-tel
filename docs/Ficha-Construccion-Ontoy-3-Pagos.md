# Ficha de construcción · Ontoy 3.0 — pagos en modo laboratorio

**Para:** Devin. **Mergea:** Asav. **Cuándo:** después de Ontoy 2.0. No urgente.

**Estado al 22-sep-2026: no arranca.** Ontoy 2.0 **no se cierra sin el
planeador** —es su último eslabón, y ése arranca cuando haya recorridos
medidos, después del 28 de septiembre—. Ontoy 3.0 empieza **después** de que
2.0 esté cerrado, no antes. Esta ficha entra al repo hoy sólo como documento:
no autoriza escribir una línea de código.

**Procedencia.** Redactada por Asav y entregada el 22-sep-2026. El cuerpo de
abajo (§1 a §5) es su texto; el §6 es el registro de lo que se verificó contra
el repo al archivarla y de las dos preguntas que el plan del P1 tendrá que
traer con opciones.

---

## 1 · La raya, antes que nada

Esto se construye para **probar la mecánica**, no para cobrar. Regla
innegociable, decidida por Asav:

> **Prototipar y simular todo con datos falsos. NUNCA tocar dinero real de una
> persona real hasta que el abogado responda.**

Concretamente, en TODO lo de esta ficha:

- Los boletos, saldos y cobros son **de mentira** (datos sembrados).
- **No se conecta ningún procesador de pagos, banco, ni cuenta real.**
- **No se guarda dinero de nadie.** La «caja» muestra números simulados.
- Hay un **letrero visible en las tres caras**: «R&D interno · datos falsos ·
  nada de esto cobra dinero real».
- Una **valla en pruebas** que se cae si aparece una llamada a un procesador de
  pagos real o a una pasarela. El código no debe poder cobrar aunque alguien se
  equivoque.

Lo que queda FUERA hasta el abogado y la decisión de empresa (MX vs USA): cómo
se custodia el dinero, si se venden viajes o se guarda saldo, el reparto real a
transportistas, la facturación. La ficha construye la **forma**, no el negocio.

## 2 · Diseños de referencia

No se copia código; son el norte visual.

- Pase + validador: https://claude.ai/artifact/TPgfayqkjRtfbsL5H6Mipi
- La caja de J-Staff: https://claude.ai/artifact/TWFhHG5QTtVRgypQ4UMmib

Aterrizados en la identidad de Ontoy 2.0. Se leen al llegar al P2 y al P4; el
P1 no tiene pantalla y no los necesita.

## 3 · Ley y decisiones ya tomadas

- Se venden **viajes**, no se guarda saldo en pesos (suposición hasta el
  abogado).
- El boleto es un **objeto digital firmado por J-Tel** — no blockchain. J-Tel es
  el único firmante; el validador verifica la firma **sin internet**.
- Cuenta del pasajero **opcional**: ver camiones nunca la pide; la cuenta sirve
  para recuperar viajes si se pierde el teléfono.
- El dinero vive **dentro de J-Tel** (J-Finance descartado).
- Tarifa la fija el gobierno del estado; Ontoy sólo la muestra, atribuida.
- El efectivo sigue: Ontoy es otra forma de pagar, no la única.

## 4 · Las tres caras, en cuatro PRs

### PR P1 · El boleto firmado (el cimiento, sin pantalla)

La mecánica criptográfica, en el dominio, con datos falsos:

- Una llave de firma **de laboratorio** (generada para pruebas, NO la de
  producción — ésa vivirá en una bóveda cuando exista). Deja escrito que es de
  laboratorio.
- Emitir un boleto: objeto firmado con {id, ruta, emitido, vence, un solo uso}.
- Verificar un boleto **sin red**: la firma es de J-Tel, no está vencido, no se
  ha quemado. Funciones puras con sus pruebas.
- El QR **rota cada pocos segundos** (para que una captura no sirva) — la lógica
  del código rotante, probada.
- Detección de doble uso: un boleto quemado no pasa dos veces.
- Elige la librería de firma (no hay ninguna instalada aún); dila en el plan.

### PR P2 · El pase del pasajero (en `apps/publico`)

La pestaña «Pase» de Ontoy deja de ser lugar reservado:

- Comprar viajes **simulado** (paquetes y viaje por viaje) — sin cobro real.
- El pase con su QR rotante, el folio, «funciona sin señal».
- Al portador y con cuenta (las dos, la cuenta opcional).
- Vías alternas: QR impreso, código corto. Efectivo se menciona, no se procesa.
- Los boletos viven en el **almacenamiento local del teléfono**; se queman al
  usarse. Sin señal se aceptan con un tope y se concilian después.
- Letrero de R&D visible.

### PR P3 · El validador (app nueva, o vista en `apps/publico`)

El lector del camión, corriendo en un **celular** (para laboratorio; el aparato
industrial es harina de otra sesión):

- Cámara que lee el QR, verifica **sin internet** con la llave pública.
- Pip + verde/rojo. Memoria de boletos quemados del día.
- Sincroniza al tener señal; ahí salta el doble uso.
- Plan B: código corto tecleado.
- El «pip» y el verde salen **del aparato del camión**, nunca del teléfono del
  pasajero (una captura de sonido no debe poder engañar al chofer).

### PR P4 · La caja de J-Staff (en `apps/web`)

El libro del dinero, con datos **simulados**:

- «Hoy»: cuánto se juntó (falso), por vía, sin señal por conciliar.
- «Balance» por transportista: cobrado − comisión = a pagar. La comisión es una
  **perilla** (arranca en 5%, con nota de que el número real sale del abogado).
- Autorización de pago en dos modos (a la vista / a mano), con el retenido si un
  lector no sincronizó.
- «Lectores»: salud de cada validador.
- Cada viaje es un renglón que **no se borra** (la misma ley de la medición).

## 5 · Reglas de la casa

Plan corto antes de cada PR; rama por tarea; **Asav mergea**; datos falsos
sembrados en la desechable; la valla anti-cobro-real en todos. Si algo empuja
hacia tocar dinero real, para y dilo — gana la raya.

---

## 6 · Registro del archivado (22-sep-2026)

### 6.1 · Lo que se verificó contra el repo

- **No hay instalada ninguna librería de firma** (`jose`, `jsonwebtoken`,
  `@noble/*`, `tweetnacl`, `libsodium`…) en ningún `package.json` del monorepo.
  La §4 del P1 dice la verdad: la elige el plan del P1.
- **No hay instalado ningún SDK de procesador de pagos** (Stripe, Conekta,
  Mercado Pago, Openpay, PayPal…). La valla anti-cobro de la §1 **nace en
  verde**: su primer trabajo es que siga así, no limpiar algo existente.

### 6.2 · Dónde NO entra todavía

Esta ficha **no se anota en `docs/Mapa-De-La-Casa.md`**. Ese mapa describe la
casa que existe, y Ontoy 3.0 no existe ni ha empezado; anotarlo ahí sería
pintar lo que no existe. Se anota el día que el P1 se mergee.

### 6.3 · Las dos preguntas que el plan del P1 debe traer con opciones

Salieron al leer la ficha, y **las decide Asav**, no quien construya:

**a) La tolerancia de deriva de reloj del QR rotante — es una decisión con
número.** Un código que rota por tiempo exige que el teléfono del pasajero y el
validador estén de acuerdo en qué hora es, y en el momento de validar **ninguno
de los dos tiene red**. Eso obliga a fijar una tolerancia de deriva, y esa
tolerancia **es exactamente la ventana en la que una captura de pantalla
todavía sirve**: más tolerancia es más cómodo para el pasajero y más ancha la
puerta para la captura; menos tolerancia cierra la puerta y rechaza boletos
buenos de teléfonos con el reloj corrido. El plan del P1 la plantea **con
opciones y su costo de cada lado**, y Asav elige. Quien construya no la decide.

**b) El doble uso «sin red» sólo puede ser local, y el P1 promete eso.** Un
boleto quemado en el validador A no le consta al validador B hasta que los dos
sincronicen. Dentro de un mismo aparato la detección es absoluta; entre
aparatos es **diferida**, y salta al sincronizar —que es justo lo que ya dice el
P3—. El P1 escribe esa distinción en sus funciones y en sus pruebas: promete lo
que puede sostener, no más.

### 6.4 · Decidido por Asav el 23-sep-2026, sobre el plan del P1

Las dos preguntas de §6.3, contestadas. **Mandan sobre el resto de esta ficha.**

**La librería de firma: `@noble/curves` (Ed25519).** Elegida por dónde corre el
código, no por moda: el validador verifica **en el navegador de un teléfono
cualquiera y sin red**, y una implementación en JavaScript puro quita la
pregunta de si el aparato la soporta. Se descartaron WebCrypto nativo —Ed25519
llegó tarde a los navegadores, y falla justo en los teléfonos de la gente que va
a usar Ontoy— y `jose`, cuyo JWT es varias veces más largo que un boleto a la
medida, y aquí el largo es lo que tarda una cámara en enganchar el código.

**a) Tolerancia de deriva de reloj: ±2 min** (ventana de 30 s, 4 ventanas hacia
cada lado). Una captura de pantalla sirve **4 min 30 s**, y ese número está
calculado en una sola constante del código con su prueba, para que moverlo se
lea en voz alta. Razón de Asav: la ventana sólo alcanza para el mismo camión,
donde el validador ya recuerda lo quemado y lo rechaza —así que ser generoso
cuesta poco—, y ±30 s castigaría a gente honesta con el reloj corrido.

**b) Doble uso: se dice tal cual** (opción A). Absoluto dentro de un aparato,
diferido entre aparatos hasta sincronizar. Acotarlo atando el boleto a un
circuito o a una franja **se decide en el P3**, cuando se sepa cada cuánto
sincronizan los lectores de verdad: fijar hoy ese número sería inventarlo antes
de medirlo.

**Construido en el PR P1** (`packages/domain/src/boleto.ts` y
`boleto-llave.ts`), con la valla de la §1 en `scripts/verificar-sin-cobro.mjs`.

---

## 7 · El PR P3.5 — el libro de viajes y la sincronización (23-sep-2026)

**No estaba en la §4 de esta ficha, y hace falta.** La ficha iba del P3 (el
lector) al P4 (la caja), y entre los dos faltaba lo que hace que el ciclo
cierre: **los pagos no tenían lado servidor**. Nada se guardaba en la base, el
boleto vivía sólo en el teléfono y lo quemado sólo en la memoria del lector, así
que en la prueba física el pase enseñaba siempre el mismo boleto, el lector
decía «ya se usó hoy» y no había cómo salir de ahí.

### 7.1 · Lo que se construyó

- **`ticket_operations`, el libro** (migración 0054): renglones que **sólo se
  insertan** —un trigger rechaza `UPDATE`, `DELETE` y `TRUNCATE`—, con lo
  observado en cada quemado: lector, unidad asignada, circuito asignado, hora
  del lector y hora del servidor. **No es `ledger_entries`**, que es la bitácora
  del árbitro y cuelga de un viaje y una ocurrencia que un boleto no tiene.
- **`validators` y `validator_assignments`**: los lectores, con la ley 6.5 de
  los aparatos (baja con fecha y motivo, la fila no se borra) pero **concepto
  propio**.
- **`validator_syncs`**: cada vez que un lector habla, traiga o no quemados.
- **La sincronización**: el lector firma su lote, el servidor re-verifica la
  firma de J-Tel de cada boleto y **levanta el doble uso entre aparatos**.
- **El cierre del ciclo**: el pase pregunta por sus folios en uso, pasa a
  `confirmado` —el estado que el P2 dejó declarado y vacío— y ofrece el
  siguiente.

### 7.2 · Decidido por Asav el 23-sep-2026

**a) Sincronización oportunista (A1).** Sube en cuanto hay señal; reintenta con
esperas crecientes hasta un minuto. **Lector mudo = 4 h de servicio sin
contacto**, en una sola constante con su prueba
(`HORAS_DE_SERVICIO_PARA_MUDO`), **provisional hasta medir**. De servicio y no
de reloj: un camión dormido en el patio no está mudo. **El lector late aunque no
traiga quemados** — un camión vacío no es un lector mudo.

**b) Concepto propio para el lector**, no `devices`. La razón es dura:
`device_assignments_unidad_una_vigente` (0039) dice *una unidad, un aparato*, y
un camión trae GPS **y** lector; reusar `devices` obligaría a aflojar el candado
que le dice al archivador de qué unidad es cada punto.

**c) A qué se ata un viaje para el reparto: sólo se anota.** El libro guarda lo
observado, que es lo que el reparto necesitará, **sin decidirlo**. Es de la
Pieza 10 (8.14) y no se construye aquí. El boleto sigue naciendo con
`cualquier-circuito`.

**d) La escritura entra por `apps/publico`** (opción d1), con su regla de
firewall en `docs/Procedimiento-Firewall-Publico.md`. Lo que decide quién
escribe **no es una sesión, es la firma del lote**.

**e) El pase pregunta en claro (e1), y sólo por los folios en uso.** El servidor
**no guarda las consultas**. La declaración de datos se actualizó antes del
merge (`docs/Ontoy-Declaracion-De-Datos.md`).

### 7.3 · Las tres correcciones de Asav, y lo que cada una cambió

1. **«Circuito asignado», no «el que servía».** Sale de
   `circuit_unit_assignments`, que es **plan**; el circuito recorrido se
   derivará del GPS y no vive en el libro. La columna se llama como lo que es.
2. **El libro no pierde renglones.** Sus referencias van **directo** a `units` y
   `circuits` con `ON DELETE RESTRICT` —`circuit_unit_assignments` sí cae en
   cascada, y colgar de ella habría dejado que borrar un circuito se llevara
   viajes quemados—, y la base rechaza `UPDATE`, `DELETE` y `TRUNCATE` con su
   prueba que lo intenta y falla. **Costo aceptado:** una unidad con viajes en
   el libro ya no se puede borrar, ni la cuenta que la contiene.
3. **Lector robado.** La baja **revoca su llave en el instante**: sus lotes se
   rechazan y el intento queda registrado en `validator_syncs`. Y cada quemado
   viaja con el boleto entero para que el servidor **re-verifique la firma de
   J-Tel**: la llave del lector es suya, pero la de J-Tel no.

### 7.4 · Lo que el P3.5 dejó abierto

- **La caja (P4)** sigue siendo el siguiente PR: la pantalla de «Hoy», el
  balance por transportista, la perilla de comisión y la salud de los lectores.
  El libro ya declara el renglón `conciliado` para que el P4 no tenga que
  migrarlo.
- **`emitido` está declarado y vacío**, como estuvo `confirmado` hasta hoy: lo
  llenará J-Tel el día que emita los boletos de su lado en vez del teléfono.
- **La pantalla de «Lectores»** es del P4. Mientras tanto, el alta se hace con
  `pnpm --filter @jtel/db escenario-lector`, sólo contra la desechable.
- **El número de las 4 h** se revisa cuando alguien mida cuánto dura un tramo
  sin cobertura en la ciudad.
