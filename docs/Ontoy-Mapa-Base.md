# El mapa base de Ontoy — el archivo, su recorte y su crédito

**Qué es.** Un archivo `.pmtiles` de 18 MB con Ciudad Juárez y El Paso, en
`apps/publico/public/mapa/`. Es el fondo del mapa de la app, y lo sirve este
mismo servidor. **Los 18 MB no los baja el pasajero:** el navegador pide por
rangos los pedazos que mira, que en una sesión son uno o dos megas.

**Decisión de ASAV del 21 de septiembre de 2026**, escrita en
`apps/publico/src/lib/ontoy/mapa-base.ts`: Protomaps servido desde nuestro propio
almacenamiento.

## En qué va

| | |
|---|---|
| **El archivo en el repo, con su guion y su valla** | hecho |
| **El estilo (la ropa de Ontoy) y la conexión a la app** | su propio PR, con capturas |
| **El mapa sin red** (que el service worker guarde el archivo) | pendiente, ver abajo |

Hasta que entre el PR del estilo, **la app sigue pidiendo los mosaicos a
OpenStreetMap**: el archivo está en el repo y nadie lo usa. Van separados a
propósito — el archivo pesa 14 MB y el estilo se revisa mirándolo; un PR con las
dos cosas no deja revisar ninguna.

## Por qué está aquí y no se pide a nadie

Hasta hoy el fondo son los mosaicos públicos de `tile.openstreetmap.org`, y
eso tenía dos problemas, uno de cada tipo:

1. **Su política de uso prohíbe el uso en producción.** Es infraestructura
   donada; el remedio de ellos contra el abuso es bloquear por `User-Agent`, o
   sea **el mapa se apaga un día, en la calle, para todos**.
2. **Un tercero veía hacia dónde mira el pasajero.** Cada mosaico era una
   petición suya, con su IP y —por las coordenadas del mosaico— aproximadamente
   qué parte de la ciudad estaba viendo. La app nunca mandó su ubicación a nadie;
   el fondo del mapa sí contaba algo.

Con el archivo servido por nosotros las dos se acaban: las peticiones van **al
mismo servidor que ya sirve la app**, que es el único que de todos modos ve al
pasajero llegar.

## No son mosaicos: es un archivo que se lee por rangos

`.pmtiles` es un archivo con todos los mosaicos adentro y un índice. El navegador
pide **los pedazos que necesita** con `Range`, como se lee un disco. No hace falta
ningún programa que sirva mosaicos: hace falta un servidor que entienda `Range`,
y el nuestro lo entiende.

Los datos son de **OpenStreetMap** (ODbL) y el recorte, del build global de
**Protomaps** (BSD-3). **El crédito a OpenStreetMap se queda en el mapa** aunque
las peticiones ya no vayan a ellos: el crédito es por los *datos*, y no cambia
porque cambie quién sirve el archivo. Son dos cosas distintas y conviene no
confundirlas — una es licencia, la otra es privacidad.

## Cómo se regenera

```
pnpm --filter @jtel/publico mapa:traer            # el build de hoy
pnpm --filter @jtel/publico mapa:traer 20260924   # un build concreto
```

El guion (`scripts/traer-mapa.mjs`) explica la caja, los zooms y qué hay que
mover a mano después. **No corre en CI ni al compilar, a propósito:** si corriera,
compilar volvería a depender de que un servidor ajeno contestara — que es
exactamente lo que este archivo vino a quitar. Es la misma decisión que la de las
fuentes (`apps/publico/src/app/fuentes/LEEME.md`).

## Por qué la caja es más grande que la ciudad

La primera caja iba pegada a Juárez (`-106.75,31.50 → -106.15,31.95`, 13.7 MB). De
cerca se veía perfecta; **al alejar en un teléfono alto enseñaba un vacío de borde
recto** donde se acababa el recorte — la pantalla es más alta que ancha y pedía más
grados de los que había. Un mapa que se acaba en una línea horizontal no se lee como
«hasta aquí llega el recorte»: se lee como que la app está rota.

La caja de hoy (`-107.00,31.20 → -105.95,32.20`) cuesta **4.8 MB más en el repo y cero
para el pasajero**. Va con dos cosas más, y las tres valen juntas: **piso de zoom** en
z10 —donde la ciudad entera con El Paso cabe en la pantalla— para que no se llegue al
borde alejando, y **límites de arrastre** para que no se llegue por un costado. Lo mide
`mapa-base.test.ts`.

## La fecha va en el nombre, y no es decoración

`juarez-20260924.pmtiles` trae el día del build del que salió. Al refrescar el
mapa **cambia la dirección**, así que ningún teléfono ni ningún CDN puede seguir
sirviendo el mapa viejo desde su caché. Con un nombre fijo no habría forma de
sacarlos de ahí.

`mapa-base.test.ts` se cae si el archivo y `FECHA_DEL_MAPA` no coinciden, y si
queda un `.pmtiles` de más.

## El mapa sin red, que hoy es una pérdida

El service worker guarda hoy **hasta 300 mosaicos** de los que el pasajero ya
miró, así que sin señal ve el pedazo de ciudad por donde anduvo. Con un archivo
leído por rangos eso **deja de funcionar**: las respuestas parciales (`206`) no se
pueden guardar en la caché del navegador, y el mismo mecanismo no sirve.

Se puede hacer mejor de lo que había —guardar el archivo **completo** la primera
vez que alguien abre el mapa y servir los rangos desde ahí: 14 MB una vez, contra
los ~15 MB que ya gastaban 300 mosaicos, y sin señal se tiene **toda la ciudad, en
todos los zooms**, no nada más lo que se miró—. Es su propio PR y no entra al
mismo que el estilo.

**Mientras no entre, esto es una pérdida y no un empate**, y va dicho aquí para
que nadie cierre el frente creyendo que quedó parejo.
