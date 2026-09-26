"use client";

import { tituloArriba } from "@/lib/ontoy/titulo-de-fila";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProntoEnLaCalle } from "@/components/ontoy/pronto-en-la-calle";
import {
  FRACCION,
  alSoltar,
  masAbajo,
  masArriba,
  type AlturaDeLaHoja,
} from "@/lib/ontoy/alturas-de-la-hoja";
import { useAltoDeLaBarra } from "@/lib/ontoy/alto-de-la-barra";
import { tinoEnLaParada } from "@/lib/ontoy/munecos";
import { GlifoCarta, GlifoEstrella, GlifoEstrellaSi } from "@/components/ontoy/glifos";
import { ligaDeLaParada, mandadaEnPalabras, mandarParada } from "@/lib/ontoy/mandar-parada";

export interface LlegadaEnLaHoja {
  /** Lo que se lee grande: «4–7 min», «Sin unidad a la vista», «Fuera de horario». */
  rotulo: string;
  /**
   * El rótulo **partido en cifra y unidad**, cuando lo es: `{ valor: "3",
   * unidad: "paradas" }`. Con esto la hoja dibuja el número grande y su palabra
   * chica, como el diseño.
   *
   * Va aparte y **no se deduce del rótulo**. Partir «a 3 paradas» con una
   * expresión aquí sería adivinar la forma de una frase que se arma en otro
   * archivo: el día que diga «a 1 parada» en singular, o «iba a 3 paradas», el
   * corte se equivoca en silencio. Quien construye el rótulo tiene el número;
   * lo manda.
   *
   * Los rótulos que **no son una cifra** —«Fuera de horario», «Preguntando…»—
   * no lo traen, y la hoja los dibuja enteros.
   */
  cifra?: { valor: string; unidad: string };
  /** El número de la unidad, para su placa. Sólo cuando hay una unidad medida. */
  placa?: string;
  /** La frase de apoyo. Va aparte del rótulo para que el rótulo no se vuelva una oración. */
  apoyo: string;
  /** El dato está vivo ahora: lleva el punto verde. **Sólo eso lo lleva.** */
  enVivo?: boolean;
  /** Es dato viejo: se apaga, y dice de cuándo es. Nunca se borra (escalera, 8.9). */
  vieja?: boolean;
  /**
   * Es la POSICIÓN VIEJA de una unidad («iba a 3 paradas»): lo último que se vio,
   * no dónde está. Se dice en pasado, **sin número grande** y con el anillo hueco
   * del dato viejo (8.9; decisión de ASAV, 22-sep).
   */
  pasada?: boolean;
}

/**
 * La hoja de una parada: lo que se sabe de ella, y la salida (8.10).
 *
 * ## Las dos cosas nunca se funden (8.3)
 *
 * Arriba, **lo medido**: qué unidad viene y en qué rango. Abajo, separada por su
 * línea, **la promesa**: cada cuántos minutos pasa. Son dos afirmaciones de
 * naturaleza distinta —una la midió el GPS hace segundos, la otra la declaró el
 * concesionario— y el pasajero tiene derecho a saber cuál está leyendo. Fundir
 * «pasa cada 12 min» con «viene en 4» produce una sola frase que nadie puede
 * verificar.
 *
 * Y la promesa se muestra **siempre**, aunque no haya una sola unidad en vivo
 * (8.2): vale por sí sola, como el horario impreso en un poste.
 *
 * ## La salida
 *
 * Cerrar con el botón, con la tecla de escape o tocando fuera. Tres salidas
 * porque la hoja tapa el mapa, y una hoja que no se sabe cerrar sobre un mapa
 * que el pasajero necesita es un callejón (8.10).
 *
 * ## Las tres alturas, y por qué NUNCA saca al pasajero del mapa
 *
 * La hoja se arrastra entre **asomada, media y completa** (las fracciones y el
 * veredicto al soltar, en `alturas-de-la-hoja.ts`). Esto no es un adorno: es lo
 * que permite que tocar una parada deje de ser un viaje a otra pantalla.
 *
 * Antes, tocar a Tino en el mapa de la ciudad abría la ruta entera con su lista
 * de paradas, y el pasajero perdía de vista dónde estaba parado justo cuando
 * acababa de señalarlo. Ahora la respuesta llega **encima del mapa**, y bajarla
 * a la asomada devuelve el mapa sin perder la parada.
 *
 * En la asomada no hay velo ninguno: el mapa se sigue usando —arrastrar,
 * acercar, tocar otra parada— porque a esa altura la hoja acompaña, no
 * interrumpe. De la media hacia arriba sí hay uno, pero **transparente**: sólo
 * recoge el toque de fuera para cerrar (8.10). Que no tiña está medido contra
 * las láminas, y el porqué está escrito junto a la regla en `ontoy.css`.
 */
export function HojaDeParada({
  nombre,
  direccion,
  llegadas,
  porArrancar,
  cerrada = false,
  promesa,
  promesaDeclarada = false,
  guardada,
  sePuedeGuardar,
  color,
  alGuardar,
  alCerrar,
  alturaInicial = "media",
  fija = false,
  porQue = null,
  haciaDonde = null,
  delLetrero = null,
  grupos = null,
  direccionDosSentidos = null,
}: {
  nombre: string;
  /** «Dirección → Centro». Sale de los datos del circuito, nunca del código. */
  direccion: string;
  llegadas: LlegadaEnLaHoja[];
  /** El color de la ruta, para la franja de las placas. */
  /**
   * La ruta todavía no arranca. Cuando viene, **reemplaza a las llegadas y a la
   * promesa**: no hay unidad que contar ni frecuencia que prometer sobre un
   * servicio que no ha salido.
   */
  porArrancar?: { ruta: string; arrancaEl: string | null } | null;
  /** La ruta está fuera de horario: Páris duerme, con sus «z» (lámina 2-mapa/13). */
  cerrada?: boolean;
  /** La promesa publicada, ya en palabras. Siempre visible (8.2) — salvo por arrancar. */
  promesa: string;
  /**
   * Si esa promesa **la declaró la concesión**. De eso depende que lleve su
   * firma al lado, y no de cómo esté escrita.
   *
   * Es la regla del #377 aplicada aquí: **el rótulo sigue la fuente, no el
   * estado.** «Esta ruta no publica cada cuánto pasa» es una frase nuestra
   * sobre un hueco — firmarla «según la concesión» le atribuiría a alguien
   * algo que justamente no dijo, que es la ley de no exponer al operador
   * invertida.
   */
  promesaDeclarada?: boolean;
  guardada: boolean;
  /** `false` cuando el navegador no deja guardar. Se dice, no se esconde el botón. */
  sePuedeGuardar: boolean;
  color: string;
  alGuardar: () => void;
  alCerrar: () => void;
  /** Con qué altura nace. La hoja de un toque nace en la media (§2 del diseño). */
  alturaInicial?: AlturaDeLaHoja;
  /**
   * **La hoja que se asoma sola, y que por eso no se cierra.**
   *
   * «Abajo del mapa siempre se asoma» (ASAV, 25-sep). Cerrarla dejaría el mapa
   * sin lo único que contesta sin tocar nada, así que sus tres salidas —el
   * botón, la tecla de escape y tocar fuera— y arrastrarla hasta abajo **la
   * regresan a la asomada** en vez de quitarla. Tampoco se roba el foco al
   * aparecer: nadie la abrió, y mover el foco a su botón cada vez que se abre
   * el mapa le quitaría el lugar a quien navega con teclado.
   */
  fija?: boolean;
  /**
   * Por qué se asoma ésta —«La más cerca de ti · a 90 m en línea recta», «Tu
   * parada guardada»—. En la altura asomada reemplaza al renglón de la ruta,
   * como en la lámina; la ruta y el sentido bajan a la fila (ver `haciaDonde`).
   */
  porQue?: string | null;
  /** «hacia Centro». En la asomada, título de la primera fila. */
  haciaDonde?: string | null;
  /**
   * **Se llegó escaneando el letrero de esta parada** — su `qr_slug`, para
   * poder mandarla. La hoja saluda —«Estás en esta parada»—, Páris sonríe, y
   * guardar se ofrece como en la lámina `5-paradas/04`; ya guardada, «Guardada»
   * y «Mándala» (`05`). `null` en cualquier otro camino a la hoja.
   */
  delLetrero?: string | null;
  /**
   * Las llegadas **por sentido**, cuando la parada sirve a los dos. Se enseñan
   * sólo con la hoja hasta arriba, como la lámina `03-hoja-completa`; en la
   * media y en la asomada manda `llegadas`, que es un sentido.
   */
  grupos?: Array<{ sentido: string; titulo: string; llegadas: LlegadaEnLaHoja[] }> | null;
  /** «Ruta ‹nombre› · paran los dos sentidos» — el renglón de la hoja completa. */
  direccionDosSentidos?: string | null;
}) {
  const cerrarRef = useRef<HTMLButtonElement | null>(null);
  const [altura, setAltura] = useState<AlturaDeLaHoja>(alturaInicial);
  /**
   * La fracción mientras el dedo la tiene. `null` cuando no se está arrastrando,
   * y entonces manda `altura`.
   *
   * Son dos cosas distintas a propósito: durante el arrastre la hoja sigue al
   * dedo **sin transición** —si la tuviera, iría siempre un poco atrás y se
   * sentiría pegajosa—, y al soltar vuelve a mandar la altura, que sí se anima.
   */
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  /* Dónde termina la hoja: arriba de la barra, que no se tapa (8.10). Ver el hook. */
  const altoBarra = useAltoDeLaBarra();

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (fija) setAltura("asomada");
      else alCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    if (!fija) cerrarRef.current?.focus();
    return () => window.removeEventListener("keydown", alTeclear);
  }, [alCerrar, fija]);

  /** Lo que hacen las salidas: la fija baja a la asomada; la tocada se cierra. */
  const salir = useCallback(() => {
    if (fija) setAltura("asomada");
    else alCerrar();
  }, [fija, alCerrar]);

  /**
   * El arrastre del asa.
   *
   * **Los oyentes van en `window`, no en el asa**, y esto ya costó una vez: en
   * «Tus paradas» los puse en el asa con `setPointerCapture` y, como React mueve
   * el nodo al reordenar, el `pointerup` nunca llegaba y la lista se quedaba
   * «arrastrando» para siempre. Aquí el nodo no se mueve, pero el dedo sí sale
   * de un asa de 5 px de alto en cuanto empieza a moverse: en el asa, el gesto
   * se perdería en el primer milímetro.
   */
  const alAgarrar = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const alto = window.innerHeight;
      if (!alto) return;
      const mover = (ev: PointerEvent) => {
        /* La hoja ocupa de su borde hasta abajo: la fracción es lo que queda
           debajo del dedo. */
        setArrastrando(Math.min(1, Math.max(0, (alto - ev.clientY) / alto)));
      };
      const soltar = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", mover);
        window.removeEventListener("pointerup", soltar);
        window.removeEventListener("pointercancel", soltar);
        setArrastrando(null);
        const veredicto = alSoltar((alto - ev.clientY) / alto);
        if (veredicto === "cerrar") salir();
        else setAltura(veredicto);
      };
      window.addEventListener("pointermove", mover);
      window.addEventListener("pointerup", soltar);
      window.addEventListener("pointercancel", soltar);
    },
    [salir],
  );

  const fraccion = arrastrando ?? FRACCION[altura];
  /**
   * **La cabecera compacta de la asomada**, como la lámina `01-mapa-asomada`:
   * el nombre y debajo por qué se asoma, sin Tino. A esa altura la hoja tiene
   * 31.8 % de la pantalla y Tino se comería el renglón que contesta; además,
   * el Tino de esa parada ya está en el mapa, justo encima.
   *
   * Durante el arrastre se decide por la altura que tenía al agarrarla, no por
   * la fracción del dedo: si no, la cabecera cambiaría de forma a media
   * arrastrada y la hoja brincaría bajo el dedo.
   */
  const compacta = altura === "asomada";
  /* En la asomada y en la hoja del letrero, «hacia Centro» baja a la fila: el
     renglón de arriba lo ocupa el porqué, o nadie (la lámina `04` no lo lleva). */
  const tituloDeLaFila = (compacta && porQue) || delLetrero ? haciaDonde : null;
  /**
   * **En la asomada, una sola fila**: la próxima llegada. La lámina pone una
   * sola dentro de su tarjeta cerrada, y la regla de ASAV dice «su ruta y su
   * llegada», en singular. Con todas, la segunda asomaba cortada por la barra —
   * medio renglón que no se puede leer y que obliga a subir la hoja para saber
   * qué decía—. Al subirla aparecen todas.
   */
  /* La del letrero también enseña una: «estás aquí, esto es lo que viene» (lámina 04). */
  const filas = compacta || delLetrero ? llegadas.slice(0, 1) : llegadas;
  /** Lo que se dijo al tocar «Mándala», si hubo algo que decir. */
  const [mandada, setMandada] = useState<string | null>(null);
  const alMandar = useCallback(async () => {
    if (!delLetrero) return;
    const liga = ligaDeLaParada(window.location.origin, delLetrero);
    const r = await mandarParada({ nombre, liga, nav: navigator });
    setMandada(mandadaEnPalabras(r, liga));
  }, [delLetrero, nombre]);
  /** Los dos sentidos se ven sólo arriba, y sólo si hay dos que enseñar. */
  const verDosSentidos = altura === "completa" && !!grupos && grupos.length > 1;
  /**
   * El renglón de debajo del nombre: en la asomada, por qué se asoma; arriba
   * del todo con los dos sentidos, «paran los dos sentidos»; si no, la ruta y
   * su sentido. Las dos primeras no pueden coincidir: una es la altura más baja
   * y la otra la más alta.
   */
  const subtitulo =
    compacta && porQue
      ? porQue
      : verDosSentidos && direccionDosSentidos
        ? direccionDosSentidos
        : direccion;

  return (
    <>
      {/*
        * **El velo sólo de la media hacia arriba.** En la asomada el mapa se
        * sigue usando; un velo ahí apagaría justo lo que el pasajero está
        * mirando y convertiría una hoja que acompaña en una que interrumpe.
        */}
      {altura !== "asomada" && (
        <button
          type="button"
          className="ontoy-scrim transparente"
          style={{ ["--alto-barra" as string]: `${altoBarra}px` }}
          aria-label={fija ? "Bajar la hoja" : "Cerrar"}
          onClick={salir}
        />
      )}
      <section
        className={`ontoy-hoja${arrastrando !== null ? " arrastrando" : ""}`}
        style={{
          ["--alto-hoja" as string]: String(fraccion),
          ["--alto-barra" as string]: `${altoBarra}px`,
        }}
        role="dialog"
        aria-modal="false"
        aria-label={`Parada ${nombre}`}
      >
        {/*
          * El asa es un control de verdad, no un adorno: se arrastra con el dedo
          * y **sube y baja con las flechas**. Un arrastre no es alcanzable con
          * teclado ni con un conmutador, y sin las flechas quien navega así se
          * quedaría con la altura con la que abrió.
          */}
        <button
          type="button"
          className="ontoy-hoja-asa"
          onPointerDown={alAgarrar}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") { e.preventDefault(); setAltura(masArriba(altura)); }
            if (e.key === "ArrowDown") { e.preventDefault(); setAltura(masAbajo(altura)); }
          }}
          aria-label={`Alto de la hoja: ${altura}. Usa las flechas para subirla o bajarla.`}
        >
          <span aria-hidden="true" />
        </button>
        <div className="ontoy-hoja-cuerpo">
        <div className="ontoy-hoja-cabeza">
          {/*
            * **Tino, de la parada que estás mirando.** Mira de lado —«de allá
            * viene»— sólo cuando hay una unidad medida en camino; al frente
            * cuando no la hay, y dormido cuando la ruta está cerrada.
            *
            * La mirada sale de lo mismo que la fila de abajo, así que no puede
            * decir una cosa distinta de la que dice el dato: es la misma
            * pregunta contestada dos veces, y contestada una sola vez.
            */}
          {!compacta && (
          <span
            className="ontoy-hoja-tino"
            aria-hidden="true"
            dangerouslySetInnerHTML={{
              __html: tinoEnLaParada({
                color,
                mirada: porArrancar || cerrada ? "dormido" : llegadas.some((l) => l.enVivo) ? "de-lado" : "al-frente",
                guardada,
                /* El letrero la pide; si no, sonríe si es tuya (lo decide `guardada`). */
                sonrie: delLetrero ? true : undefined,
              }),
            }}
          />
          )}
          <h2 className="ontoy-hoja-nombre">
            {delLetrero && <span className="ontoy-hoja-saludo">Estás en esta parada</span>}
            {nombre}
          </h2>
          {/*
            * La fija asomada no lleva ✕: ya está en su altura más baja y no hay
            * a dónde cerrarla. Arriba de la asomada sí lo lleva, y la regresa.
            */}
          {!(fija && compacta) && (
            <button
              ref={cerrarRef}
              type="button"
              className="ontoy-cerrar"
              onClick={salir}
              aria-label={fija ? "Bajar la hoja" : "Cerrar"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
        {!delLetrero && (
          <p className={`ontoy-hoja-dir${compacta && porQue ? " por-que" : ""}`}>{subtitulo}</p>
        )}

        {/*
          * **Por arrancar reemplaza a todo lo de abajo**, no se suma.
          *
          * La 8.2 dice que la promesa se muestra siempre, «como el horario
          * impreso en un poste». Un poste de una ruta que no ha salido no
          * tiene horario impreso todavía: lo que tiene es la fecha en que lo
          * va a tener. Enseñar «pasa cada 15 min» aquí sería prometer sobre
          * algo que nadie ha operado ni medido.
          */}
        {porArrancar ? (
          <ProntoEnLaCalle color={color} ruta={porArrancar.ruta} arrancaEl={porArrancar.arrancaEl} />
        ) : (
          <>
        {/*
          * Lo MEDIDO, **dentro de su tarjeta**. El estándar la describe —hueso,
          * radio 22, anillo arena, separador de 1 px entre filas— y no es
          * decoración: la tarjeta es lo que dice dónde termina lo que midió el
          * GPS y dónde empieza la promesa, que va fuera y debajo. Sin ella, las
          * dos cosas son una lista sola (8.3).
          */}
        {verDosSentidos ? (
          /*
           * **Los dos sentidos, cada uno con su título y su tarjeta** — la
           * lámina `03-hoja-completa`. Un título por grupo y no una columna
           * «sentido» en cada fila: el pasajero busca primero hacia dónde va,
           * y luego qué viene.
           */
          grupos!.map((g) => (
            <section key={g.sentido} className="ontoy-hoja-grupo" aria-label={g.titulo}>
              <h3 className="ontoy-hoja-sentido">{g.titulo}</h3>
              <div className="ontoy-hoja-medido">
                {g.llegadas.map((l, i) => (
                  <FilaDeLlegada key={i} l={l} color={color} />
                ))}
              </div>
            </section>
          ))
        ) : (
        <div className="ontoy-hoja-medido">
        {filas.map((l, i) => (
          /* En la asomada, la primera fila lleva «hacia Centro» (ver `tituloDeLaFila`). */
          <FilaDeLlegada key={i} l={l} color={color} titulo={i === 0 ? tituloDeLaFila : null} />
        ))}
        </div>
        )}

        {/* LA PROMESA, separada por su línea y siempre presente (8.2, 8.3). */}
        <p className="ontoy-hoja-promesa">
          <span>{promesa}</span>
          {promesaDeclarada && <span className="ontoy-hoja-firma">según la concesión</span>}
        </p>
          </>
        )}
        {/*
          * **«Guarda tu parada» baja al final y se vuelve el botón principal.**
          *
          * Era una pastilla chica arriba, junto al nombre. Es **la** acción de
          * esta hoja —lo que convierte «una parada» en «tu parada»— y el
          * estándar pide un solo botón principal por pantalla, al final, con
          * sus 52 px de alto. Arriba competía por el lugar con la salida y se
          * leía como un adorno del título.
          */}
        {delLetrero ? (
          <LetreroGuardar
            guardada={guardada}
            sePuedeGuardar={sePuedeGuardar}
            alGuardar={alGuardar}
            alMandar={alMandar}
            mandada={mandada}
          />
        ) : (
          <>
        <button
          type="button"
          className={`ontoy-boton ontoy-boton-principal ontoy-hoja-guardar${guardada ? " guardada" : ""}`}
          onClick={alGuardar}
          disabled={!sePuedeGuardar}
          aria-pressed={guardada}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
          </svg>
          {guardada ? "Guardada" : "Guarda tu parada"}
        </button>

        <p className="ontoy-hoja-nota">
          {/*
            Aquí decía «la guarda en tu teléfono, no en ningún servidor», y la
            valla de `textos-de-privacidad` la tumbó con razón: una promesa
            absoluta sobre el destino de un dato afirma sobre TODA la pantalla,
            y en ésta los mosaicos del mapa sí se le piden a un tercero. El
            texto dice para qué sirve, que es lo que el pasajero necesita.
          */}
          {sePuedeGuardar
            ? "Guardar una parada la deja a la mano en este teléfono. No hace falta cuenta."
            : "Tu navegador no deja guardar nada en este teléfono, así que el atajo no está disponible. Todo lo demás funciona igual."}
        </p>
          </>
        )}
        </div>
      </section>
    </>
  );
}

/**
 * **Guardar y mandar, en la hoja a la que se llegó por el letrero** — láminas
 * `5-paradas/04` (sin guardar) y `05` (guardada).
 *
 * Sin guardar, una tarjeta que dice para qué sirve —«Así la próxima vez Inicio
 * ya te dice a cuántas paradas viene»— y UN botón principal, «Guárdala». Quien
 * escaneó está parado ahí: es el momento en que guardar tiene más sentido, y
 * la tarjeta lo dice en vez de sólo ofrecerlo.
 *
 * Guardada, dos botones secundarios: «Guardada» —que la quita, como el de la
 * hoja de siempre— y «Mándala». Y la nota dice dónde quedó.
 */
function LetreroGuardar({
  guardada,
  sePuedeGuardar,
  alGuardar,
  alMandar,
  mandada,
}: {
  guardada: boolean;
  sePuedeGuardar: boolean;
  alGuardar: () => void;
  alMandar: () => void;
  mandada: string | null;
}) {
  if (!guardada) {
    return (
      <div className="ontoy-letrero-guardar">
        <p className="ontoy-letrero-guardar-titulo">¿La usas seguido? Guárdala.</p>
        <p className="ontoy-letrero-guardar-ayuda">
          {sePuedeGuardar
            ? "Así la próxima vez Inicio ya te dice a cuántas paradas viene."
            : "Tu navegador no deja guardar nada en este teléfono, así que el atajo no está disponible. Todo lo demás funciona igual."}
        </p>
        <button
          type="button"
          className="ontoy-boton ontoy-boton-principal ontoy-letrero-guardala"
          onClick={alGuardar}
          disabled={!sePuedeGuardar}
          aria-pressed={false}
        >
          <GlifoEstrella />
          Guárdala
        </button>
      </div>
    );
  }
  return (
    <>
      <div className="ontoy-letrero-dos">
        <button type="button" className="ontoy-boton ontoy-letrero-secundario" onClick={alGuardar} aria-pressed>
          <GlifoEstrellaSi />
          Guardada
        </button>
        <button type="button" className="ontoy-boton ontoy-letrero-secundario" onClick={alMandar}>
          <GlifoCarta />
          Mándala
        </button>
      </div>
      {/* `aria-live`: lo que se dijo al mandar tiene que oírse, no sólo verse. */}
      <p className="ontoy-hoja-nota ontoy-letrero-nota" aria-live="polite">
        {mandada ?? "Ya está en Inicio y en Tus paradas."}
      </p>
    </>
  );
}

/**
 * **Un renglón de llegada**: placa, lo que se sabe, y la cifra o el rótulo.
 *
 * Salió de la hoja a su propio componente cuando la hoja completa empezó a
 * pintar dos grupos (uno por sentido): copiar este JSX dos veces habría sido
 * la forma segura de que un día digan dos cosas distintas.
 *
 * `titulo`, cuando viene, va en negrita encima del apoyo —«hacia Centro»—.
 */
function FilaDeLlegada({
  l,
  color,
  titulo = null,
}: {
  l: LlegadaEnLaHoja;
  color: string;
  titulo?: string | null;
}) {
  /* Un destino largo sube a su renglón, a todo lo ancho: ver `tituloArriba`. */
  const arriba = tituloArriba(titulo);
  return (
          <div
            className={`ontoy-llegada${l.cifra ? " con-cifra" : ""}${l.vieja ? " vieja" : ""}${l.pasada ? " pasada" : ""}${arriba ? " titulo-arriba" : ""}`}
          >
            {arriba && <b className="ontoy-llegada-titulo ontoy-llegada-titulo-arriba">{titulo}</b>}
            {l.placa && (
              <span className="ontoy-placa" style={{ ["--ruta" as string]: color }}>
                {l.placa}
              </span>
            )}
            <span className="ontoy-llegada-dicho">
              {titulo && !arriba && <b className="ontoy-llegada-titulo">{titulo}</b>}
              <span className="ontoy-llegada-apoyo">
                {l.enVivo && <span className="ontoy-punto-vivo" aria-hidden="true" />}
                {l.pasada && <span className="ontoy-punto-viejo" aria-hidden="true" />}
                {l.apoyo}
              </span>
            </span>
            {/*
              * Con cifra, el número grande y su palabra chica. Sin ella, el
              * rótulo entero —«Fuera de horario» no tiene un número que agrandar,
              * y agrandarle la primera palabra lo volvería un titular falso.
              */}
            {l.cifra ? (
              <span className="ontoy-llegada-cifra">
                <b className="cifra">{l.cifra.valor}</b>
                <span className="ontoy-llegada-unidad">{l.cifra.unidad}</span>
              </span>
            ) : (
              <span className="ontoy-llegada-rotulo cifra">{l.rotulo}</span>
            )}
          </div>
  );
}
