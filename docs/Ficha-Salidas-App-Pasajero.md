# Ficha — Toda pantalla del pasajero necesita su propia salida

**Fecha: 4 de septiembre de 2026.** App pública del transporte concesionado.
Frente: Tramo JB. Sin migración.

---

## La regla, en una frase

> **En la app del pasajero, una pantalla sin salida en la pantalla es una
> pantalla sin salida.** No hay botón de atrás del navegador que la rescate.

## Por qué, y esto es lo que hay que saber antes de agregar la siguiente

`app/manifest.ts` declara **`display: "standalone"`**. Instalada en la pantalla
de inicio —que es como la va a traer un pasajero que la usa a diario— la app
corre **sin barra de navegador: sin flecha de atrás, sin barra de direcciones y
sin pestañas.**

En el navegador, una pantalla sin salida es una incomodidad: se pica atrás y ya.
Instalada, la misma pantalla es una puerta cerrada, y la única salida que le
queda al pasajero es cerrar la app entera y volverla a abrir.

**La diferencia no se ve desarrollando**, y ahí está la trampa: en el escritorio,
con Chrome abierto y su flecha de atrás a la izquierda, la pantalla se ve
perfectamente usable. El defecto sólo existe donde no se está mirando.

## El caso que lo enseñó — el buscador, 4 de septiembre

«¿A dónde vas?» se construyó en el #370 con su barra de arriba: la chapa de
identidad y el interruptor de tema. **Ninguna liga de regreso, en toda la
pantalla.** Se entra desde dos lados —la hoja de la vista de la ruta y la
portada cuando hay varias— y no se salía de ninguno.

Se vio en producción, en un teléfono. No lo encontró ninguna prueba, y no por
descuido de las pruebas: **no había ningún valor equivocado que comparar.** Lo
que faltaba era un elemento, y una prueba de datos no ve un hueco en una barra.

## Las tres decisiones del arreglo, con su razón

**1 · Es una liga de verdad, nunca `history.back()`.**

Quien abre el buscador de frío —una liga compartida, el arranque de la app
instalada— **no tiene historia a la cual volver**, y ahí `back()` no hace nada.
Un control que no hace nada es peor que ninguno: el que lo pica ya se creyó que
hay salida, y descubre que no la hay después de confiar.

Por eso la función que decide el destino, `salidaDelBuscador`, **no puede
devolver `null`**. La forma es la valla: si pudiera, la pantalla tendría que
decidir qué hacer sin destino, y la respuesta fácil ahí es exactamente el
`back()` que no funciona.

**2 · Regresa a donde estaba, y el `desde` se coteja.**

La liga de la vista de la ruta lleva `?desde=<slug>`, y con eso la salida vuelve
a **esa** ruta. Sin el parámetro, a la portada.

El parámetro viaja en la URL, así que lo escribe quien quiera. **Se coteja
contra los circuitos publicados**, en el servidor, que es quien ya tiene la
lista: sin el cotejo, `?desde=lo-que-sea` produciría un botón rotulado «Volver a
la ruta» que aterriza en un 404 — un letrero prometiendo algo que no está detrás
de la puerta. Es la misma familia que el §D: el control era correcto, y lo falso
lo ponía su rótulo.

**3 · Enseña sólo la flecha, y el destino lo dice el nombre accesible.**

Arriba a la izquierda ya significa «regresar» en cualquier teléfono, y el ancho
que ahorra lo gana el nombre de la ruta, que es información de verdad. El
pasajero al que más le sirve esta app trae el teléfono más chico.

Lo que **no** se ahorra es el destino para quien no ve el dibujo: el
`aria-label` dice «Volver a la ruta» o «Volver al inicio», según a dónde vaya de
verdad.

## Qué revisar al agregar una pantalla nueva

1. ¿Tiene una salida **visible sin scrollear**? Una liga al pie de un panel que
   se desplaza no cuenta: es el mismo encierro con otro nombre.
2. ¿La salida es una liga con destino, o un `back()` disfrazado?
3. Si el destino depende de un parámetro, ¿se cotejó contra algo real?
4. ¿Se vio **a 320 px de ancho**, que es donde la barra de arriba se pelea por
   el espacio?

## El inventario de hoy

| Pantalla | Salida |
|---|---|
| `/c/[slug]` — la ruta | Es la portada de hecho: con un circuito publicado, `/` redirige aquí |
| `/buscar` | **La flecha de arriba a la izquierda** — este arreglo |
| `/` — la portada | Lista las rutas; no necesita salir de ningún lado |
| `not-found` | «Ver las rutas» |

## Lo que esta ficha NO afirma

Que se haya probado en la app instalada de verdad, ni siquiera con el modo
emulado.

La revisión se hizo en navegador con teléfono simulado —390, 360 y 320 px, los
dos temas, contra la compilación de producción—. **Se intentó forzar
`display-mode: standalone` por CDP y no tomó**: la consulta
`matchMedia("(display-mode: standalone)")` seguía devolviendo `false`, así que
esa corrida no probó nada del modo instalado y no se cuenta como si lo hubiera
probado.

Lo que sostiene la premisa de esta ficha no es una corrida: es el
`display: "standalone"` declarado en `app/manifest.ts`, que se puede leer. Lo
que sigue pendiente es instalarla en un teléfono físico y comprobar ahí que
tampoco hay flecha de atrás — se hace sola el día de la prueba de campo.
