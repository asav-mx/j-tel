import { direccionDelLetreroEnPalabras, numeroDeLaRuta } from "@jtel/domain";
import { CodigoQrImpreso, type FormaDeLasEsquinas, type FormaDeLosModulos } from "@/components/casa/codigo-qr-impreso";
import { TinoDeLaLamina } from "@/components/casa/ontoy-impreso";

/**
 * **La lámina de parada de 40 × 60 cm** — el dibujo del paquete «Lanzamiento»
 * (`docs/diseno/app-v1/diseno/Lanzamiento.dc.html`), puesta a salir del dato.
 *
 * Es la pieza grande, la que se atornilla al poste y se ve desde la otra
 * banqueta. El letrero de carta sigue existiendo y es otra cosa: el de carta es
 * para imprimir en una oficina y pegar hoy; éste va a una imprenta.
 *
 * ## Todo sale del dato, y por eso hubo que decidir dos cosas
 *
 * El dibujo traía dos renglones que en la base no existen:
 *
 * 1. **La calle** («Av. Tecnológico y Calle 16»). No hay campo de calle: lo que
 *    hay es `name`, que se captura libre. **La lámina imprime el nombre de la
 *    parada** y no inventa un renglón (ASAV, 24-sep). Una parada bien nombrada
 *    ya dice su cruce; una mal nombrada se arregla renombrándola, que es lo que
 *    hay que arreglar de todos modos antes de mandar nada a la imprenta.
 *
 * 2. **El «Parada 536» del pie.** Tampoco existe, y encima engaña: «Parada N»
 *    es el nombre **por omisión** que el servidor le pone a una parada sin
 *    nombre, no un código. Va el **`qr_slug`** (ASAV, 24-sep), que es el único
 *    identificador real, único y estable que una parada tiene — y el mismo que
 *    ya va impreso en la dirección de debajo del QR. Si alguien reporta que una
 *    lámina está rota, se ubica sola.
 *
 * ## Y un renglón que se quita: la frecuencia
 *
 * El dibujo dice «Pasa cada 12–15 min · según la concesión». **Fuera** (ASAV,
 * 24-sep), y es la corrección más importante de las tres: **la lámina se
 * atornilla por años y la promesa cambia por franja**. Una frecuencia impresa
 * es verdad el día que se imprime y empieza a mentir en la siguiente franja
 * horaria — y no hay despliegue que corrija una lámina; hay que mandar a alguien
 * con una escalera.
 *
 * Lo que sí dice la lámina es dónde está la promesa viva: detrás del QR.
 *
 * ## Y por qué sale con CUADRADOS y no con los puntitos del 1b
 *
 * Porque medido, **los puntitos no se leen**. Rasterizando el mismo código a
 * cinco tamaños y pasándolo por jsQR:
 *
 * | Variante | Leídos |
 * |---|---|
 * | puntitos + ojos (el 1b) | **1 de 5** |
 * | cuadrados + ojos | 5 de 5 |
 * | cuadrados + esquinas normales | 5 de 5 |
 *
 * **Los ojos redondeados no cuestan nada** —son la firma del diseño y se
 * quedan—; lo que rompe la lectura son los puntitos. La nota del repo suponía
 * lo contrario.
 *
 * El letrero de carta **no cambia**: ése se reimprime en una oficina el mismo
 * día. Ésta va a una imprenta y se atornilla por años, así que ante una duda
 * medida sobre si se lee, lo que sale por omisión es lo que lee. Quien quiera
 * el 1b lo pide con `?modulos=puntitos`.
 *
 * ⚠ **jsQR es un lector, no todos.** Las cámaras de iPhone y Android traen el
 * suyo y suelen ser más tolerantes con los módulos redondos. Esto no dice que
 * el 1b sea ilegible en la calle; dice que **hay un lector estándar que no lo
 * lee**, y que eso se decide con teléfonos frente a un poste antes de mandar
 * nada a imprimir.
 */

/** 40 × 60 cm a 300 puntos por pulgada, que es lo que pide una imprenta. */
export const LAMINA_ANCHO_CM = 40;
export const LAMINA_ALTO_CM = 60;

export function LaminaDeParada({
  parada,
  ruta,
  sitio,
  modulos = "cuadritos",
  esquinasComo = "ojos",
}: {
  /** `nombre` es el `name` de su versión vigente; `qrSlug`, su identidad. */
  parada: { nombre: string; qrSlug: string };
  /** `nombre` es el del circuito; `colorHex`, el color capturado, sin corregir. */
  ruta: { nombre: string; colorHex: string };
  sitio?: string;
  modulos?: FormaDeLosModulos;
  esquinasComo?: FormaDeLasEsquinas;
}) {
  /*
   * El número —«51» de «Ruta 51 · Centro–Tecnológico»— es lo único que va en
   * una placa: la de Páris y la chapa. **Sin número no hay placa ni chapa**: la
   * ruta va con su franja de color y su nombre como texto (ASAV, 26-sep: nunca
   * iniciales). El nombre largo va siempre al lado, porque **el color nunca va
   * solo** (8.8c) y un número suelto tampoco dice de qué ruta es.
   */
  const numero = numeroDeLaRuta(ruta.nombre);

  return (
    <section className="lamina">
      <div className="lamina-hoja">
        {/* La franja de arriba: la marca, y el dominio para quien no escanea. */}
        <header className="lamina-cabecera">
          <span className="lamina-wordmark">¿Ontoy?</span>
          <span className="lamina-dominio">ontoy.app</span>
        </header>

        <div className="lamina-cuerpo">
          <div className="lamina-quien">
            <TinoDeLaLamina ruta={ruta.nombre} colorHex={ruta.colorHex} />
            <div>
              <h1 className="lamina-titulo">Esta es tu parada.</h1>
              {/*
               * El nombre de la parada, tal como está capturado. Es el renglón
               * que el dibujo llamaba «la calle»: no hay campo de calle, y esto
               * es lo que hay — sin inventar nada.
               */}
              <p className="lamina-donde">{parada.nombre}</p>
            </div>
          </div>

          <hr className="lamina-raya" />

          <div className="lamina-escaneo">
            <div className="lamina-caja-del-codigo">
              <CodigoQrImpreso
                parada={parada}
                ruta={ruta}
                sitio={sitio}
                modulos={modulos}
                esquinasComo={esquinasComo}
                className="lamina-qr"
              />
            </div>

            <div className="lamina-dicho">
              <h2 className="lamina-escaneame">Escanéame.</h2>
              {/*
               * **A cuántas paradas**, no en minutos: mientras la velocidad del
               * corredor no esté calibrada la app no da minutos (8.9b), y una
               * lámina que prometa minutos los prometería durante años.
               */}
              <p className="lamina-promesa">
                Te digo a cuántas paradas viene tu camión, con su posición real.
              </p>
              <p className="lamina-gratis">Sin descargar nada. Sin cuenta.</p>
            </div>
          </div>

          <div className="lamina-ruta">
            {/*
              * Con número, la chapa del color de la ruta con su número. Sin
              * número, la franja de color: identifica la ruta sin inventarle un
              * identificador, y el nombre de al lado dice cuál es.
              */}
            {numero ? (
              <span className="lamina-chapa" style={{ background: ruta.colorHex }}>
                <span className="lamina-chapa-texto">{numero}</span>
              </span>
            ) : (
              <span className="lamina-franja" style={{ background: ruta.colorHex }} aria-hidden="true" />
            )}
            <div>
              <p className="lamina-ruta-nombre">{ruta.nombre}</p>
              {/*
               * Aquí iba «Pasa cada 12–15 min · según la concesión». No va: la
               * lámina dura años y la promesa cambia por franja. Lo que se dice
               * es dónde vive la promesa viva.
               */}
              <p className="lamina-ruta-pie">Horarios y avisos, en la app</p>
            </div>
          </div>

          {/* Para quien no trae cámara, no sabe escanear o tiene la pantalla rota. */}
          <p className="lamina-direccion">{direccionDelLetreroEnPalabras(parada.qrSlug, sitio)}</p>
        </div>

        <footer className="lamina-pie">
          {/*
           * El `qr_slug`, que es el código real de esta parada. Donde el dibujo
           * ponía «Parada 536» — que no es un código sino el nombre por omisión
           * de una parada sin nombre.
           */}
          <span className="lamina-codigo">{parada.qrSlug}</span>
          <span>Horarios y avisos según la concesión</span>
        </footer>
      </div>
    </section>
  );
}
