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
