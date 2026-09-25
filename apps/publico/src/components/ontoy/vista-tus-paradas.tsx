"use client";

import { useEffect, useRef, useState } from "react";
import { Ontoy } from "@/components/ontoy/ontoy-muneco";
import { tinoEnLaParada } from "@/lib/ontoy/munecos";
import type { ParadaGuardada } from "@/lib/ontoy/paradas-guardadas";
import type { RutaDeLaCiudad } from "@/lib/ontoy/forma";
import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";

/**
 * **«Tus paradas»** — la lista de las guardadas, con su orden y su papelera.
 *
 * ## Por qué es una pantalla y no una quinta pestaña
 *
 * La barra tiene cuatro lugares y eso es ley (8.8). Ésta cuelga de Inicio, como
 * la ruta abierta cuelga del Mapa: se entra tocando «Tus paradas» y se sale por
 * la flecha, que es la salida que la 8.10 exige.
 *
 * ## El orden importa, y por eso se puede cambiar
 *
 * El orden del arreglo **es** el orden de Inicio: la primera guardada es la que
 * sale arriba, con su tarjeta grande. Quien toma dos rutas quiere decidir cuál
 * es la de todos los días — hoy el orden lo decide en qué orden las guardó, que
 * no es una decisión, es un accidente.
 *
 * ## Se arrastra con el dedo **y con el teclado**
 *
 * El asa responde a las flechas además de al arrastre. No es un extra: un
 * control que sólo se puede arrastrar deja fuera a quien no puede hacer ese
 * gesto, y además **no se puede probar sin un dedo** — con las flechas, el
 * reordenar tiene una prueba que no depende de mirar.
 */
export function VistaTusParadas({
  guardadas,
  rutas,
  paradas,
  alVolver,
  alReordenar,
  alQuitar,
  alReponer,
  alAbrirRuta,
}: {
  guardadas: ParadaGuardada[];
  rutas: RutaDeLaCiudad[];
  /** La lista pública de la ciudad, para poder decir el nombre de cada parada. */
  paradas: ParadaDeLaCiudad[];
  alVolver: () => void;
  alReordenar: (desde: number, hasta: number) => void;
  alQuitar: (parada: string) => { g: ParadaGuardada; en: number } | null;
  alReponer: (g: ParadaGuardada, en: number) => void;
  alAbrirRuta: (circuitoId: string, parada?: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [quitada, setQuitada] = useState<{ g: ParadaGuardada; en: number; nombre: string } | null>(null);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const lista = useRef<HTMLUListElement | null>(null);

  /*
   * El aviso de «quitaste» se va solo a los 8 s. No antes: leer la frase,
   * entender qué se fue y decidir si era un error no cabe en cuatro segundos, y
   * el deshacer es la única forma de recuperar una parada que ya se borró del
   * teléfono.
   */
  useEffect(() => {
    if (!quitada) return;
    const id = setTimeout(() => setQuitada(null), 8000);
    return () => clearTimeout(id);
  }, [quitada]);

  /*
   * **Mientras la lista de la ciudad no llega, no se inventa un nombre.**
   *
   * El teléfono guarda el slug de la parada, no su nombre; el nombre sale de la
   * lista pública. La primera versión ponía «Tu parada» de relleno, y eso se
   * lee como el nombre de verdad — es el §E del Marco: completar un hueco para
   * que la pantalla se vea entera. Aquí se dice que se está preguntando.
   */
  const listaLista = paradas.length > 0;
  const nombreDe = (p: string) =>
    paradas.find((x) => x.id === p)?.nombre ?? (listaLista ? "Esta parada ya no está en su ruta" : "Preguntando…");
  const rutaDe = (r: string) => rutas.find((x) => x.circuito_id === r) ?? null;

  if (guardadas.length === 0) {
    /*
     * El vacío de esta pantalla SÍ es de pantalla completa, al revés que en
     * Inicio: aquí no hay nada más que enseñar. En Inicio están las rutas de la
     * ciudad debajo, y taparlas sería quitarle al pasajero lo que vino a ver.
     */
    return (
      <div className="ontoy-vista">
        <Cabeza alVolver={alVolver} editando={false} alAlternarEditar={null} />
        <section className="ontoy-completa ontoy-completa-dentro">
          <Ontoy pose="al-frente" tamano={128} />
          <h2 className="ontoy-completa-titular">Guarda tu parada y aquí te digo cuándo pasa.</h2>
          <p className="ontoy-completa-ayuda">Búscala en el mapa o en Ir a, y toca la estrella.</p>
          <button type="button" className="ontoy-boton ontoy-boton-principal" onClick={alVolver}>
            Buscar mi parada
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="ontoy-vista">
      <Cabeza alVolver={alVolver} editando={editando} alAlternarEditar={() => setEditando((e) => !e)} />

      <ul className="ontoy-guardadas" ref={lista}>
        {guardadas.map((g, i) => {
          const ruta = rutaDe(g.ruta);
          const color = ruta?.color_hex ?? "#2A2E37";
          return (
            <li
              key={g.parada}
              className={`ontoy-guardada${arrastrando === i ? " arrastrando" : ""}`}
              data-indice={i}
            >
              <span
                className="ontoy-guardada-tino"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: tinoEnLaParada({ color, mirada: "al-frente" }) }}
              />
              <button
                type="button"
                className="ontoy-guardada-abrir"
                onClick={() => alAbrirRuta(g.ruta, g.parada)}
                disabled={editando}
              >
                <span className="ontoy-guardada-nombre">{nombreDe(g.parada)}</span>
                <span className="ontoy-guardada-ruta">
                  {arrastrando === i ? "Arrastrando…" : (ruta?.nombre ?? "Su ruta")}
                </span>
              </button>

              {editando && (
                <>
                  <button
                    type="button"
                    className="ontoy-guardada-quitar"
                    aria-label={`Quitar ${nombreDe(g.parada)}`}
                    onClick={() => {
                      const q = alQuitar(g.parada);
                      if (q) setQuitada({ ...q, nombre: nombreDe(g.parada) });
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                    </svg>
                  </button>
                  <Asa
                    indice={i}
                    total={guardadas.length}
                    nombre={nombreDe(g.parada)}
                    lista={lista}
                    alReordenar={alReordenar}
                    alArrastrar={setArrastrando}
                  />
                </>
              )}
            </li>
          );
        })}
      </ul>

      <p className="ontoy-pie">
        {editando
          ? "Arrastra el asa para cambiarlas de lugar. La primera es la que sale arriba en Inicio."
          : "El orden manda: la primera es la que Inicio enseña con su próximo camión."}
      </p>

      {/*
        * El aviso de quitada, con su deshacer. Va abajo, encima de la barra, y
        * **no bloquea nada**: quitar no es un error y no se pide perdón por
        * ello — se ofrece volver atrás.
        */}
      {quitada && (
        <div className="ontoy-deshacer" role="status">
          <span>
            Quitaste <b>{quitada.nombre}</b>.
          </span>
          <button
            type="button"
            onClick={() => {
              alReponer(quitada.g, quitada.en);
              setQuitada(null);
            }}
          >
            Deshacer
          </button>
        </div>
      )}
    </div>
  );
}

function Cabeza({
  alVolver,
  editando,
  alAlternarEditar,
}: {
  alVolver: () => void;
  editando: boolean;
  /** `null` cuando no hay nada que editar: un botón que no hace nada enseña a no tocarlo. */
  alAlternarEditar: (() => void) | null;
}) {
  /*
   * **Dos renglones, no tres columnas.**
   *
   * La primera versión ponía flecha · título · «Listo» en una sola fila. El
   * título es de 28 px y «Tus paradas» es ancho: la columna de en medio quedaba
   * estrecha, la línea de contexto se partía en dos, y el conjunto se veía
   * torcido — el título no empezaba donde empiezan los renglones de abajo.
   *
   * Arriba los controles, abajo el título con todo el ancho. Lo enseñó la
   * captura.
   */
  return (
    <header className="ontoy-guardadas-cabeza">
      <div className="ontoy-guardadas-controles">
        <button type="button" className="ontoy-volver" onClick={alVolver} aria-label="Volver a Inicio">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M19.5 12H5M11 5.5 4.5 12l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {alAlternarEditar && (
          <button type="button" className="ontoy-guardadas-editar" onClick={alAlternarEditar}>
            {editando ? "Listo" : "Editar"}
          </button>
        )}
      </div>
      <h1 className="ontoy-inicio-titulo">Tus paradas</h1>
      <p className="ontoy-inicio-contexto">Se quedan en este teléfono, sin cuenta</p>
    </header>
  );
}

/**
 * **El asa**: se arrastra con el dedo y se mueve con las flechas.
 *
 * El arrastre va con eventos de puntero —los mismos para dedo, ratón y lápiz—
 * y calcula el destino **midiendo dónde caen los renglones**, no adivinando su
 * alto: con nombres de una y de dos líneas los renglones no miden lo mismo, y
 * una constante los mandaría al lugar equivocado en cuanto una parada se llame
 * «Fraccionamiento Praderas del Sur Segunda Etapa».
 */
function Asa({
  indice,
  total,
  nombre,
  lista,
  alReordenar,
  alArrastrar,
}: {
  indice: number;
  total: number;
  nombre: string;
  lista: React.RefObject<HTMLUListElement | null>;
  alReordenar: (desde: number, hasta: number) => void;
  alArrastrar: (i: number | null) => void;
}) {
  /** En qué índice cae una coordenada Y, medida contra los renglones de verdad. */
  const indiceEn = (y: number): number => {
    const filas = [...(lista.current?.querySelectorAll<HTMLElement>(".ontoy-guardada") ?? [])];
    for (let i = 0; i < filas.length; i++) {
      const r = filas[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return filas.length - 1;
  };

  return (
    <button
      type="button"
      className="ontoy-guardada-asa"
      aria-label={`Mover ${nombre}. Flechas arriba y abajo para cambiarla de lugar.`}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" && indice > 0) {
          e.preventDefault();
          alReordenar(indice, indice - 1);
        } else if (e.key === "ArrowDown" && indice < total - 1) {
          e.preventDefault();
          alReordenar(indice, indice + 1);
        }
      }}
      onPointerDown={(e) => {
        /* Sólo el gesto de arrastrar; un toque suelto deja el foco para las flechas. */
        if (e.pointerType === "mouse" && e.button !== 0) return;
        /*
         * **Los escuchas van en la VENTANA, no en el asa.**
         *
         * Al reordenar, React **mueve el nodo** del renglón dentro de la lista.
         * Con los escuchas y la captura del puntero colgados del asa, ese
         * movimiento se lleva la captura y el `pointerup` no vuelve nunca:
         * quedaba «Arrastrando…» pegado en el renglón después de soltar, y sólo
         * se quitaba recargando. Lo enseñó la captura, no una prueba.
         *
         * En la ventana, soltar siempre llega — se suelte donde se suelte, e
         * incluso fuera de la pantalla.
         */
        alArrastrar(indice);
        let actual = indice;

        const alMover = (ev: PointerEvent) => {
          const destino = indiceEn(ev.clientY);
          if (destino !== actual && destino >= 0) {
            alReordenar(actual, destino);
            actual = destino;
          }
        };
        const alSoltar = () => {
          alArrastrar(null);
          window.removeEventListener("pointermove", alMover);
          window.removeEventListener("pointerup", alSoltar);
          window.removeEventListener("pointercancel", alSoltar);
        };
        window.addEventListener("pointermove", alMover);
        window.addEventListener("pointerup", alSoltar);
        window.addEventListener("pointercancel", alSoltar);
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        {[8, 12, 16].flatMap((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />))}
      </svg>
    </button>
  );
}
