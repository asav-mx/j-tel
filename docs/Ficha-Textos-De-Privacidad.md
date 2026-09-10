# Ficha — Los textos de privacidad de la cara pública

**Fecha: 6 de septiembre de 2026.** App pública del transporte concesionado.
Frente: Tramo JB. Sin migración. **El comportamiento no cambia en nada.**

---

## Qué cambió

| Pantalla | Antes | Ahora |
|---|---|---|
| Vista de la ruta | «Tu ubicación se usa **solo en este teléfono. No se envía a ningún servidor**.» | «Tu ubicación se usa **para calcular cuándo llega tu camión**.» |
| Buscador | «A dónde vas y dónde estás se usan **solo en este teléfono. No se envían a ningún servidor**.» | «A dónde vas y dónde estás se usan **para contestarte**.» |

**Se retira la promesa absoluta de servidor. Los textos describen el PARA QUÉ,
no juran el DÓNDE para siempre.**

## Por qué la frase vieja no se sostenía

Era cierta de lo que hacemos nosotros, y está medida: no existe ninguna petición
que mande la ubicación ni el destino. Eso **no cambió y no cambia con esta
ficha**.

Lo que no se sostenía era la afirmación completa que el lector recibe. Los
mosaicos del mapa se piden a `tile.openstreetmap.org` por `z/x/y`, y el mapa se
encuadra a lo que el pasajero está mirando. Ninguna coordenada suya viaja, y aun
así un tercero puede inferir la zona con precisión de un mosaico.

**Quien lee «no se envía a ningún servidor» entiende «nadie afuera puede saber
por dónde ando», y eso es más de lo que la pantalla sostiene.** Es la §D del
Marco aplicada a nuestra propia redacción: el dato correcto, la afirmación
completa no. Y cae del lado que más cuesta — **la promesa es nuestra y quien la
lee es el pasajero**.

## Y una segunda razón, que es la que decidió la forma del arreglo

Una promesa sobre **el dónde** ata a la arquitectura futura. «No se envía a
ningún servidor» tendría que revisarse el día que aparezca cualquier cosa que
mande algo: una alerta que el pasajero pida, un pago, un mosaico servido desde
nuestro propio origen. Ninguna de ésas rompe el espíritu de la promesa, y todas
rompen su letra.

Una frase sobre **el para qué** no. «Se usa para calcular cuándo llega tu
camión» sigue siendo verdad o deja de serlo por una razón que sí importa: que el
dato se use para otra cosa.

## ⚠ Lo que esto cuesta, dicho en voz alta

**La regla deja de estar escrita donde el pasajero la lee.**

Hasta hoy, «nada suyo sale del teléfono» era una promesa pública, y una promesa
pública es un testigo externo: alguien podía leerla en la pantalla y reclamarnos
si dejaba de ser cierta. Ahora la regla vive sólo en el código y en los
documentos.

No es una regresión de comportamiento —la petición que mandaría la ubicación
sigue sin existir— pero sí es **un guardián menos**, y conviene no descubrirlo
después. Lo que queda cuidándola:

- **La forma, no la disciplina.** En el buscador no hay ninguna petición de red
  en el camino de la búsqueda: no hay una que revisar. En la vista de la ruta,
  `watchPosition` y la proyección corren en el teléfono y al servidor sólo se le
  pide el circuito.
- Los encabezados de los dos componentes, que lo declaran como lo primero que
  esos archivos existen para no hacer.
- La entrada de `DESPUES.md` sobre el buscador de direcciones, que es donde la
  regla se pondría a prueba de verdad.

## La valla

`textos-de-privacidad.test.ts` lee los dos componentes y exige que **ninguno
diga «ningún servidor» ni «solo en este teléfono»**, ignorando los comentarios
que explican por qué.

No es una prueba de función: es una prueba de **decisión**. La frase vieja era
cierta y sonaba mejor, así que **quien la vuelva a poner va a creer que está
reparando una regresión de privacidad** — que es exactamente el caso que una
valla tiene que atrapar. Si alguien la restaura a propósito, esto se cae y se
actualiza a propósito.

Se comprobó rompiéndola: con la frase vieja de vuelta, las dos pruebas fallan;
restaurada, verde.

## Lo que NO cambia

Nada del comportamiento. Ni una petición nueva, ni una menos. Sin migración, sin
cambio de contrato, sin tocar el camino de ingestión.

Y no cambia la ley: **la ubicación y el destino siguen sin salir del teléfono.**
Lo único que cambió es qué prometemos por escrito, y hasta dónde.

## Lo que esta ficha NO afirma

Que los mosaicos dejen de filtrar la zona. Siguen pidiéndose a un tercero, y la
salida de servirlos desde nuestro propio origen sigue abierta —ahora sin la
urgencia de sostener una frase—. Si algún día se toma, estos textos no hay que
tocarlos: no dependen de dónde vivan los mosaicos, que es justamente lo que se
buscaba al escribirlos así.
