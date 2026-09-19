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
 *
 * `alTocar` es la otra forma de tocar, la de Flota en vivo: la pieza señala su
 * unidad en el mapa en vez de navegar (la ficha va en el mapa, «Ver 10254»).
 * Es un botón de verdad, con `aria-pressed`, no un div con clic.
 *
 * **La flecha ›** sale sola con `ficha` (aprobada por ASAV con el prototipo de
 * C4, como PR aparte): distingue a simple vista lo que lleva a otra pantalla de
 * lo que no, sin depender del hover. Con `alTocar` no va, porque no se navega.
 *
 * `datoVivo` pone el dato en cobre. Sólo para un dato que está vivo ahora —la
 * edad de lo que transmite—: el skill reserva el cobre para la vida.
 *
 * `apoyoQueEnvuelve` deja que el apoyo baje de renglón en celular en vez de
 * cortarse con «…». Lo pide Servicios especiales (prototipo de Vernier V1): su
 * apoyo lleva el motivo del sello, y cortado a media palabra a 375 px deja de
 * decir por qué.
 *
 * `datoNoCumplido` pone el dato en `--ladrillo`: la hora del sello de un no
 * cumplido (ficha Vernier §2). Es el único uso del ladrillo fuera del glifo, y
 * el ladrillo es exclusivo del sello: no sirve para nada más.
 *
 * `compacta` es la fila del archivero de Expedientes (ficha V2 §3): nombre y
 * apoyo en un solo renglón, glifo y letra más chicos. 84 unidades en filas
 * compactas son tres pantallas y se recorren; en piezas altas son quince.
 *
 * **Compacta y apagada no baja la opacidad:** pasa el texto a `--tenue`, que
 * cumple el 4.5:1 solo. Al 60 % el texto medía 2.32:1 en clara y 2.41:1 en
 * oscura (19 sep 2026). La jerarquía la cargan la sección y el glifo, no la
 * ilegibilidad del texto (Asav). La pieza alta sigue al 60 % hasta que se
 * decida igual para las demás pantallas.
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
  alTocar,
  seleccionada = false,
  datoVivo = false,
  datoNoCumplido = false,
  apoyoQueEnvuelve = false,
  compacta = false,
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
  /** Lo que ya está al día: a 60 % la pieza alta; en tenue, sin opacidad, la compacta. */
  apagada?: boolean;
  /** Tocar hace algo en la misma pantalla en vez de navegar. Excluye `ficha`. */
  alTocar?: () => void;
  /** Con `alTocar`: la pieza señalada ahora. */
  seleccionada?: boolean;
  /** El dato está vivo ahora: va en cobre. */
  datoVivo?: boolean;
  /** El dato es la hora del sello de un no cumplido: va en ladrillo. */
  datoNoCumplido?: boolean;
  /** En celular el apoyo baja de renglón en vez de cortarse. */
  apoyoQueEnvuelve?: boolean;
  /** La fila de una línea del archivero. */
  compacta?: boolean;
}) {
  const cuerpo = (
    <>
      {estado && (
        <span className={compacta ? "flex-none self-center" : "mt-[2px] flex-none"}>
          <Glifo estado={estado} rumbo={rumbo} tamano={compacta ? 16 : undefined} />
        </span>
      )}

      {compacta ? (
        // Si nombre y apoyo no caben en el renglón, el apoyo baja en vez de
        // cortarse: «en bo…» a 375 px ya no dice dónde está.
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 self-center">
          <span
            className={`flex-none text-[16px] leading-tight${apagada ? " text-[var(--tenue)]" : ""}`}
            style={{ fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.01em" }}
          >
            {nombre}
          </span>
          <span className="max-w-full truncate text-[13px] text-[var(--tenue)]">{apoyo}</span>
        </span>
      ) : (
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-[19px] leading-tight"
            style={{ fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.01em" }}
          >
            {nombre}
          </span>
          <span
            className={`mt-1 block truncate text-[13px] text-[var(--tenue)]${
              apoyoQueEnvuelve ? " max-sm:overflow-visible max-sm:whitespace-normal" : ""
            }`}
          >
            {apoyo}
          </span>
        </span>
      )}

      <span className="flex-none text-right">
        <span
          data-medida
          className={`block ${compacta ? "text-[13.5px]" : "text-[15px]"} leading-tight${
            datoVivo ? " text-[var(--senal)]" : datoNoCumplido ? " text-[var(--ladrillo)]" : compacta && apagada ? " text-[var(--tenue)]" : ""
          }`}
        >
          {dato}
        </span>
        <span
          data-medida
          className={`${compacta ? "mt-0.5 text-[10px]" : "mt-1 text-[10.5px]"} block uppercase tracking-[0.12em] text-[var(--tenue)]`}
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

      {/* La flecha: lo que lleva a otro lado se distingue sin pasar el mouse,
          que en el celular no existe. Sólo con `ficha`: una pieza que señala en
          la misma pantalla (`alTocar`) no va a ningún lado y no la lleva. */}
      {ficha && !alTocar && (
        <span
          aria-hidden="true"
          className="-ml-1 flex-none self-center text-[20px] leading-none text-[var(--tenue)]"
          style={{ fontFamily: "var(--letra-lectura)" }}
        >
          ›
        </span>
      )}
    </>
  );

  // Un solo color de borde por pieza: dos clases de borde juntas quedan a merced
  // del orden del CSS generado.
  const borde = alTocar && seleccionada ? "border-[var(--tinta)]" : "border-[var(--linea)]";
  const forma = `flex w-full ${compacta ? "items-center gap-3 px-3.5 py-2" : "items-start gap-4 px-4 py-3.5"} rounded-lg border ${borde} bg-[var(--pieza)] text-left${
    apagada && !compacta ? " opacity-60" : ""
  }`;

  if (alTocar) {
    return (
      <button
        type="button"
        onClick={alTocar}
        aria-pressed={seleccionada}
        className={`${forma} cursor-pointer transition-colors hover:bg-[var(--roce)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]`}
      >
        {cuerpo}
      </button>
    );
  }

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
