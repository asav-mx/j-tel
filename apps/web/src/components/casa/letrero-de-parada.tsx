import {
  CORRECCION_DEL_LETRERO,
  direccionDelLetrero,
  direccionDelLetreroEnPalabras,
} from "@jtel/domain";
import { TinoDeLaLamina } from "@/components/casa/ontoy-impreso";
import {
  CodigoQrImpreso,
  type FormaDeLasEsquinas,
  type FormaDeLosModulos,
} from "@/components/casa/codigo-qr-impreso";

/**
 * **La hoja que se imprime, se plastifica y se atornilla a un poste.**
 *
 * Es el uso **1b** de `Ontoy QR.dc.html` del skill `ontoy-design`: tarjeta Hueso,
 * banda del color de la ruta, Tino, «¿Cuándo pasa? Escanea.», el código en un
 * recuadro blanco redondeado con los módulos en **puntitos** carbón, las tres
 * esquinas como **ojos redondeados** que miran al centro, la cara de la ruta en
 * medio y la dirección escrita.
 *
 * Es la única pantalla del producto cuyo destino no es una pantalla, y eso decide
 * su forma: fondo claro fijo —una piel oscura en papel es un cartucho de tinta—,
 * medidas en centímetros y no en píxeles, y **nada del transportista**: ni su
 * nombre ni su logo. El color de la ruta sí va —es identidad, no estado (8.8c)—
 * y **siempre con su nombre**, en la banda, en Tino y en la placa.
 *
 * ## Qué cuesta cada mitad del dibujo, medido
 *
 * Medido sobre **estos renders**, no sobre una plantilla: se recorta el código de
 * la captura y se reduce a la resolución que una cámara de teléfono entrega a un
 * metro, con menos contraste, desenfoque y ruido; 25 tiradas por celda,
 * decodificando con jsQR — el mismo lector que trae el validador.
 *
 * A 13 cm, qué fracción de las tiradas lee:
 *
 * | | prev. 1920 (4.9 px/cuad) | prev. 1280 (3.3) | prev. 960 (2.5) |
 * |---|---|---|---|
 * | puntitos + ojos (el 1b) | 100 % | 32–72 % | **0 %** |
 * | cuadrados + ojos | 100 % | 76–100 % | **0 %** |
 * | cuadrados + esquinas normales | 100 % | 100 % | **92–100 %** |
 *
 * **Las dos mitades cuestan, y no lo mismo:**
 *
 *  - **Los puntitos** cuestan la columna de en medio: de 76–100 % bajan a
 *    32–72 % con la cámara típica.
 *  - **Los ojos redondeados** cuestan la de abajo, y cuestan más: a 2.5 px por
 *    cuadrito **no lee nada** con ojos, ni con puntitos ni con cuadrados, y con
 *    esquinas normales lee al 92 %.
 *
 * Eso da vuelta a lo que yo había reportado, que era que los puntitos eran el
 * problema. Y agrandar el código no compra la columna de en medio: a 15 y 17 cm
 * los cuadrados con esquinas normales siguen al 100 % y lo demás sigue flojo.
 *
 * ⚠ **Lo que esta medición NO es:** teléfonos frente a un poste. Es un modelo con
 * **un solo decodificador**, y ahí está su límite más importante: los de los
 * teléfonos reales (VisionKit de Apple, ML Kit de Google) son bastante más
 * tolerantes con los patrones de búsqueda estilizados que jsQR — es justo de lo
 * que viven los miles de QR de marca con esquinas redondeadas que sí escanean.
 * Además sus celdas rebotan: el muestreo hace *aliasing* contra la rejilla. Esto
 * dice **qué está en juego y de qué tamaño**; no fija un porcentaje ni decide.
 *
 * ## Las tres variantes, para decidir con teléfonos
 *
 * La pantalla de impresión saca las tres de la misma parada
 * (`?modulos=cuadritos`, `?esquinas=normales`). Son tres y no dos porque con dos
 * hojas no se puede saber cuál de las dos mitades estorba.
 *
 * ## Por qué H
 *
 * No es «para aguantar la cara del centro»: ésa tapa el 24 % del lado y le quita
 * el ~6 % de los cuadritos, y eso lo sobrevive hasta M. H es para **la calle** —
 * con cuatro calcomanías o rayones simulados, M lee el 25 % de las veces y H el
 * 85 %.
 *
 * ## Por qué un solo `<path>` para los puntitos
 *
 * Son ~1 100 cuadritos. Con un `<circle>` por puntito, una hoja de 40 paradas
 * serían decenas de miles de nodos y el navegador se arrodilla justo cuando
 * alguien le da a imprimir.
 */

/**
 * Cómo se dibujan los módulos de datos. `puntitos` es el 1b aprobado.
 */
export type { FormaDeLosModulos, FormaDeLasEsquinas };

/**
 * Cómo se dibujan las tres esquinas — el patrón que el lector usa para
 * **encontrar** el código.
 *
 * `ojos` son los ojos redondeados del diseño, la firma del 1b. `normales` es el
 * patrón de siempre, un 7×7 de módulos cuadrados.
 *
 * **Existe porque medirlo dio vuelta a lo que yo había dicho.** Los ojos
 * redondeados cuestan MÁS que los puntitos: a 13 cm y 2.5 px por cuadrito (la
 * previsualización de 960 a un metro), con ojos no lee nada —ni con puntitos ni
 * con cuadrados— y con esquinas normales lee al 92 %. Si la prueba con teléfonos
 * reales sólo comparara puntitos contra cuadrados, no podría distinguir cuál de
 * las dos mitades es la que estorba.
 */

/**
 * Cómo se nombra la variante **en el título de la página**, que es de donde el
 * navegador saca el nombre del archivo PDF.
 *
 * La de por omisión —el 1b— no se nombra: su archivo es el normal, y ponerle
 * «puntitos y ojos» a lo que ya es el diseño sólo ensucia el nombre.
 *
 * **Cubre las cuatro combinaciones, no las tres que la pantalla ofrece.** Los dos
 * parámetros son independientes, así que `?esquinas=normales` a secas es una URL
 * alcanzable; si no tuviera nombre, ese PDF saldría llamándose como el de por
 * omisión siendo otro dibujo — y a la imprenta le llegarían dos archivos con el
 * mismo nombre y distinto contenido.
 */
export function varianteEnElTitulo(
  modulos: FormaDeLosModulos,
  esquinas: FormaDeLasEsquinas,
): string | undefined {
  if (modulos === "puntitos" && esquinas === "ojos") return undefined;
  if (modulos === "cuadritos" && esquinas === "ojos") return "cuadrados";
  if (modulos === "cuadritos" && esquinas === "normales") return "cuadrados y esquinas normales";
  return "esquinas normales";
}

/** El radio del puntito, en cuadritos. Del diseño 1b. */
const RADIO_DEL_PUNTITO = 0.44;
/** La zona tranquila que el estándar pide, en cuadritos. Del diseño 1b. */
const ZONA_TRANQUILA = 4;
/** Cuánto del lado tapa la cara del centro. Del diseño 1b: 24 %, siempre impar. */
const CARA_TAPA_DEL_LADO = 0.24;
/** Cuánto se corre la pupila de cada esquina hacia el centro, en cuadritos. */
const LAS_ESQUINAS_MIRAN = 0.35;

export function LetreroDeParada({
  parada,
  ruta,
  sitio,
  modulos = "puntitos",
  esquinasComo = "ojos",
}: {
  parada: { nombre: string; qrSlug: string };
  ruta: { nombre: string; colorHex: string };
  /** De dónde cuelga la dirección impresa. Se pasa para poder probar contra un preview. */
  sitio?: string;
  /** El 1b es `puntitos`; `cuadritos` es la variante que se está probando. */
  modulos?: FormaDeLosModulos;
  /** El 1b son `ojos`; `normales` es el patrón de siempre. */
  esquinasComo?: FormaDeLasEsquinas;
}) {
  return (
    <section className="letrero">
      <div className="letrero-tarjeta">
        {/* La banda: el color de la ruta, a sangre. Lo que se ve desde lejos. */}
        <div className="letrero-banda" style={{ background: ruta.colorHex }} aria-hidden="true" />

        <div className="letrero-cuerpo">
          <div className="letrero-encabezado">
            <TinoDeLaLamina ruta={ruta.nombre} colorHex={ruta.colorHex} />
            <div className="letrero-dicho">
              <h1 className="letrero-pregunta">¿Cuándo pasa? Escanea.</h1>
              {/* El color nunca va solo: la placa lleva el nombre de la ruta. */}
              <p className="letrero-ruta">
                <span className="letrero-placa">{ruta.nombre}</span>
                <span className="letrero-parada">{parada.nombre}</span>
              </p>
            </div>
          </div>

          <div className="letrero-caja-del-codigo">
            <CodigoQrImpreso
              parada={parada}
              ruta={ruta}
              sitio={sitio}
              modulos={modulos}
              esquinasComo={esquinasComo}
              className="letrero-qr"
            />
          </div>

          {/* La dirección escrita, y nada debajo: ya dice `ontoy.app` en su
              primera palabra, y un pie repitiéndola se leía doble (ASAV, 24-sep). */}
          <p className="letrero-direccion">{direccionDelLetreroEnPalabras(parada.qrSlug, sitio)}</p>
        </div>
      </div>
    </section>
  );
}
