import Link from "next/link";
import { Glifo, type EstadoGlifo } from "@/components/casa/glifo";

/**
 * La pieza — la unidad básica del lenguaje, y la forma de llegar a una ficha.
 *
 * Del skill: **nada se muestra como renglón de tabla.** Todo se muestra como
 * pieza: un objeto con su glifo, su nombre, su dato y su estado, con aire
 * alrededor. Una lista de piezas se lee como cuatro objetos, no como una tabla
 * de cuatro filas; ésa es toda la diferencia.
 *
 * Cuatro partes, siempre en este orden:
 *
 *   glifo    la forma que dice el estado — nunca decorativo
 *   nombre   lo que la identifica, en tipografía de titular
 *   apoyo    dos o tres palabras; nunca una oración
 *   dato     el único número que importa, con su palabra, a la derecha
 *
 * ## Por qué está en el cascarón y no en un cuarto
 *
 * Porque la regla 2 del mapa se cumple aquí: «a una ficha se llega **tocando
 * una pieza**, desde cualquier lugar donde esa cosa aparezca, y siempre con
 * camino de regreso». La pieza es el *tocando*. Si cada cuarto inventara el
 * suyo, el camino a las fichas sería distinto en cada pantalla.
 *
 * Cuando `ficha` viene, la pieza entera es el área tocable —no un enlace
 * escondido dentro— y se comporta como enlace de verdad: se puede abrir en otra
 * pestaña, copiar la dirección y llegar con el teclado. Sin `ficha` no finge
 * ser tocable: ni cursor de mano, ni hover.
 *
 * `edad` no tiene valor por omisión a propósito. El skill dice que toda cosa
 * viva muestra la edad de su último dato **sin excepción**, y una omisión
 * silenciosa es justo la mentira que esa regla vino a impedir: un punto de hace
 * tres horas dibujado igual que uno de hace diez segundos. Quien dibuje una
 * pieza viva tiene que decir de cuándo es.
 *
 * Lo que **no** es vivo —un papel, cuyo dato es una fecha y no una lectura— pasa
 * `edad={null}` a la vista: es una decisión escrita, no un olvido.
 *
 * `apagada` baja la pieza a 60 %: lo que ya está al día suelta el peso para que
 * el ojo vaya solo a lo que pide algo.
 */
export function Pieza({
  estado,
  rumbo,
  nombre,
  apoyo,
  dato,
  etiqueta,
  edad,
  ficha,
  apagada = false,
}: {
  /**
   * La forma que dice el estado. Opcional: una pieza que liga a otra cosa sin
   * afirmar su estado —una relación, un historial— va sin glifo. El skill: si
   * no dice algo, no va.
   */
  estado?: EstadoGlifo;
  rumbo?: number;
  /** El número económico, el nombre de la ruta — lo que la identifica. */
  nombre: string;
  /** Dos o tres palabras. Nunca una oración. */
  apoyo: string;
  /** El único número que importa. */
  dato: string;
  /** Su palabra: la unidad, el estado, lo que sea que el número significa. */
  etiqueta: string;
  /** La edad del último dato: `hace 14 s`, `06:41`. Obligatoria en lo vivo; `null` en lo que no lo es. */
  edad: string | null;
  /** La ficha a la que se llega tocando. Sin ella, la pieza no es tocable. */
  ficha?: string;
  /** Lo que ya está al día, a 60 %. */
  apagada?: boolean;
}) {
  const cuerpo = (
    <>
      {estado && (
        <span className="mt-[2px] flex-none">
          <Glifo estado={estado} rumbo={rumbo} />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[19px] leading-tight"
          style={{ fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.01em" }}
        >
          {nombre}
        </span>
        <span className="mt-1 block truncate text-[13px] text-[var(--tenue)]">{apoyo}</span>
      </span>

      <span className="flex-none text-right">
        <span data-medida className="block text-[15px] leading-tight">
          {dato}
        </span>
        <span
          data-medida
          className="mt-1 block text-[10.5px] uppercase tracking-[0.12em] text-[var(--tenue)]"
        >
          {etiqueta}
        </span>
        {/* La edad va abajo del dato y en tenue: acompaña siempre, sin competir
            con el número que la pieza vino a decir. */}
        {edad !== null && (
          <span data-medida className="mt-1 block text-[11px] text-[var(--tenue)]">
            {edad}
          </span>
        )}
      </span>
    </>
  );

  const forma = `flex w-full items-start gap-4 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-3.5 text-left${
    apagada ? " opacity-60" : ""
  }`;

  if (!ficha) return <div className={forma}>{cuerpo}</div>;

  return (
    <Link
      href={ficha}
      className={`${forma} cursor-pointer transition-colors hover:bg-[var(--roce)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]`}
    >
      {cuerpo}
    </Link>
  );
}
