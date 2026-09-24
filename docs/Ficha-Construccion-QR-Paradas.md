# Ficha de construcción — El QR de las paradas

**Para:** Devin · **De:** Asav, con Claude · **Fecha:** 23 de septiembre de 2026
**Ley que manda:** Marco, Pieza 8 (8.1, 8.2, 8.4, 8.7, 8.8b) y Pieza 9 (9.8, 9.8b). Si esta ficha choca con el Marco, gana el Marco.

---

## 1 · Qué es

Un letrero en el poste de cada parada con un QR. El pasajero lo escanea y Ontoy se abre **en esa parada**: qué ruta pasa ahí y cuándo pasa el siguiente camión, con la promesa y lo medido por separado (8.3).

El QR es la única pieza de Ontoy que **se imprime en lámina y se atornilla**. Lo que se imprime no se puede corregir: la dirección que lleva adentro tiene que funcionar durante años.

## 2 · Lo que ya existe (verificado en `main`)

- `circuit_stops.qr_slug` desde la 0025: único, obligatorio, vive en la **identidad** de la parada y no en su versión. Si la parada se mueve media cuadra, el QR sigue sirviendo.
- `circuit_stops.retired_at`: retirar una parada no la borra.
- Ontoy ya tiene la hoja de una parada (`hoja-de-parada.tsx`) y la ruta pública `/c/[slug]`.
- **Lo que falta:** una ruta pública que reciba el `qr_slug`, la imagen del QR y la forma de imprimirlo. Hoy el slug no lo lee nadie.

## 3 · Decisiones de Asav

| # | Pregunta | Decisión |
|---|---|---|
| a | ¿Qué abre el QR? | **La parada de ese circuito, abierta en Ontoy**: la hoja de la parada con su ruta, su color, su tabla por franja y la llegada del siguiente camión. La parada es parte de su circuito (9.8), así que un QR = una parada de un circuito. |
| b | ¿Cómo se imprime? | **Una hoja por parada** desde J-Staff, y un botón **«Imprimir todas las paradas de este circuito»** que saca una por página. |
| c | ¿Qué dirección lleva adentro? | **`https://ontoy.app/p/<qr_slug>`**. Corta —el QR sale con menos puntos y engancha más rápido—, en el dominio de la plataforma y sin nombre de transportista. **Esta dirección no cambia nunca.** |

*(Las tres son recomendación de Claude; Asav las confirma antes de construir.)*

### Enmiendas de Asav del 23 de septiembre de 2026

| # | Decisión |
|---|---|
| d | **El diseño es el 1b de «Ontoy QR»**: banda del color de la ruta, Tino, «¿Cuándo pasa? Escanea.», módulos carbón sobre blanco, Ontoy al centro, corrección **H**, 8 cm de mínimo. Sale del skill `ontoy-design`. |
| e | **Sí se imprime de un circuito sin publicar**, con el aviso en pantalla. Voltea el punto 6 de abajo: imprimir, repartir y atornillar toma días, y exigir la publicación antes obliga a prometerle algo a un pasajero días antes de que haya un letrero en un poste. |
| f | **El QR de un circuito no publicado dice «Este letrero todavía no está activo»** — el **mismo texto** que un código inventado, para no revelar nada (8.4). |

**Lo que la (e) NO cambia:** lo que contesta el código. Un circuito sin publicar sigue respondiendo igual que un slug inventado. Lo que cambia es que la impresora no espera a la publicación.

## 4 · Qué se construye

**En Ontoy (`apps/publico`)**
1. La ruta `/p/[qrSlug]`. Resuelve la parada y abre Ontoy en su hoja, con el camino de regreso a Inicio (toda pantalla tiene su salida).
2. **Los cuatro casos, y ninguno es un 404 mudo:**
   - Parada vigente de circuito publicado → abre su hoja.
   - Parada **retirada** → «Esta parada ya no está en servicio» y la ruta a la que pertenecía, si sigue publicada. El letrero sigue en el poste aunque la parada ya no exista, y el pasajero merece saber por qué.
   - Circuito **no publicado** → contesta igual que un slug inventado (8.4: lo no publicado no existe para la app).
   - Slug que no existe → lo mismo que el caso anterior.
3. **La visita no identifica a nadie** (8.7). Sin cookie nueva, sin guardar quién escaneó. Si se cuenta, entra al contador anónimo de aperturas que ya existe, con su misma regla.

**En J-Staff (casa nueva, cuarto Circuitos)**
4. En `Ver ‹parada›` y en la lista de paradas del circuito: **«Imprimir letrero»**.
5. En el expediente del circuito: **«Imprimir todas las paradas»**.
6. ~~**Sólo se imprime de circuitos publicados.** Un circuito sin publicar enseña el botón desactivado con su razón escrita al lado: un letrero pegado en la calle que no abre nada es una promesa falsa.~~ → **Reemplazado por la enmienda (e) del 23-sep.** El argumento era cierto y le faltaba el calendario. Ahora **se imprime igual**, y el aviso va en la pantalla —donde lo lee quien manda a la impresora y todavía puede decidir—, diciendo qué va a contestar el código hasta que se publique.

**La hoja impresa (tamaño carta, vertical) — el 1b, enmienda (d)**
- **Banda del color de la ruta** a sangre arriba: es lo que se ve desde lejos y lo que distingue dos rutas en el mismo paradero.
- **Tino**, del color de la ruta, con su placa. **Sin minutos**: un «3′» impreso en un poste sería un número correcto el día que se imprimió mintiendo para siempre a alguien que está esperando de verdad. Los minutos los dice la app, que es la que los mide.
- **«¿Cuándo pasa? Escanea.»** como titular.
- El **nombre de la ruta en placa carbón** y el nombre de la parada al lado (el color es identidad, nunca estado: 8.8c, y el nombre siempre lo acompaña).
- El QR de **9 × 9 cm** —la ficha pedía 8 de mínimo, y un mínimo no es una medida de diseño—, **módulos carbón sobre blanco** con su margen, **corrección H**, y **Ontoy al centro**.
- **La dirección escrita en texto** (`ontoy.app/p/…`), para quien no tiene cámara o no sabe escanear.
- El wordmark **¿Ontoy?** abajo.
- **Nada del transportista**: ni su nombre, ni su logo. La plataforma no se viste de ninguno.

**Por qué H, medido:** la hoja de diseño dice «corrección alta, por eso aguanta a Ontoy en el centro», y ésa **no es la razón**: un disco centrado que tapa el 22 % del lado le quita el 4 % de los cuadritos, y eso lo sobrevive hasta M. Lo que H compra es la calle — con cuatro calcomanías o rayones simulados, M lee el **25 %** de las veces y H el **85 %**. Cuesta cuadritos más chicos en los mismos 9 cm (33 en vez de 29 con un slug corto), que es una razón más para que los `qr_slug` sigan siendo cortos.

## 5 · Lo que no hace

- No inventa llegadas: si no hay unidad en vivo, la hoja enseña la promesa, igual que el horario impreso en un poste (8.2).
- No pide cuenta ni ubicación para abrir.
- No genera el QR en un servicio externo: la imagen se genera en nuestro código. Un QR que depende de un tercero se muere el día que ese tercero cambie.

## 6 · Un riesgo que hay que cerrar en el mismo PR

`circuit_stops.circuit_id` tiene **`ON DELETE CASCADE`**: si alguien borra un circuito, sus paradas desaparecen, y con ellas cada QR impreso de ese circuito. Una lámina en la calle no se entera de que su circuito se borró.

Que se proponga, con su costo, cómo impedirlo: que un circuito se **retire** y no se borre (como las paradas), o que la base rechace el borrado. Si toca migración, va con su hoja en `docs/correcciones/`.

## 7 · Cómo se sabe que está hecho

- Asav imprime la hoja de una parada de Oasis–Centro, la escanea con su teléfono y Ontoy se abre en esa parada.
- Las pruebas cubren los cuatro casos del punto 2, y una prueba falla si alguien cambia el formato de la dirección.
- Capturas en el PR: la hoja impresa, la parada abierta, la parada retirada.

## 8 · Cuándo entra

**Después de que `ontoy.app` esté vivo** (registro terminado, apuntado a Vercel y contestando con Ontoy) y **después del 29**. Se puede construir desde ya en su rama.
