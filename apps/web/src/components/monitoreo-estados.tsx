import Link from "next/link";
import type { MonitoreoRoute } from "@/lib/monitoreo-data";
import { MonitoreoMapa } from "@/components/monitoreo-map";
import { formatearDuracion } from "@/lib/local-time";

/**
 * Los tres estados de la torre que NO son "turno en vuelo"
 * (Ficha-Monitoreo §5.1 a §5.3).
 *
 * Es la misma pantalla: cambia qué ocupa el lugar del mapa. Ninguno de los
 * tres inventa un dato para llenar un hueco — si algo no se sabe, ese bloque
 * no se muestra.
 */

/** La leyenda con el punto quieto: la vista está viva, la operación no. */
export function LeyendaQuieta({
  texto,
  aviso = false,
}: {
  texto: string;
  aviso?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-sm border px-4 py-2.5 ${
        aviso
          ? "border-[var(--b-ambar)] bg-[var(--t-ambar)]"
          : "border-[var(--linea)] bg-[var(--panel2)]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`relative flex h-2 w-2 flex-none rounded-full ${
          aviso ? "bg-[var(--ambar)]" : "bg-[var(--tenue)]"
        }`}
      >
        {aviso ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--ambar)] opacity-60" />
        ) : null}
      </span>
      <p className="text-[13px] text-[var(--texto)]">{texto}</p>
    </div>
  );
}

/* ── §5.1 · Sin turno activo ─────────────────────────────────────────────── */

export function SinTurnoActivo({
  proximo,
  ultimoCierre,
  programadas,
  telemetriaViva,
  edadMinutos,
  cierreHref,
  rutasHref,
  routes,
}: {
  proximo: { nombre: string; hora: string; minutosPara: number; manana: boolean } | null;
  ultimoCierre: { turno: string; hora: string } | null;
  programadas: number | null;
  telemetriaViva: boolean;
  edadMinutos: number | null;
  cierreHref: string;
  rutasHref: string;
  /** Geometría para el mapa quieto. Sin rutas, no hay mapa que dibujar. */
  routes: MonitoreoRoute[];
}) {
  const frase = [
    "Ninguna unidad en ruta ahora mismo.",
    // Sin "el turno" delante: los turnos ya se llaman "Primer Turno", "Turno B".
    ultimoCierre
      ? `${ultimoCierre.turno} cerró a las ${ultimoCierre.hora} y quedó sellado.`
      : null,
    proximo
      ? `${proximo.manana ? "El siguiente abre mañana" : "El siguiente abre"} a las ${proximo.hora}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-5">
      <LeyendaQuieta texto="Vista en vivo. El resultado se emite al cierre." />

      <div className="rounded-sm border border-[var(--linea)] px-5 py-6">
        <p className="max-w-[60ch] text-[15px] leading-relaxed text-[var(--texto)]">{frase}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={cierreHref}
            className="rounded-sm border border-[var(--b-acero)] px-3 py-1.5 text-[12px] text-[var(--acero)] transition-colors hover:bg-[var(--t-acero)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--azul)]"
          >
            Ver el cierre del turno →
          </Link>
          <Link
            href={rutasHref}
            className="rounded-sm border border-[var(--linea-fuerte)] px-3 py-1.5 text-[12px] text-[var(--texto)] transition-colors hover:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--azul)]"
          >
            Rutas del siguiente turno →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-[var(--linea)] bg-[var(--linea)] min-[720px]:grid-cols-4">
        {proximo ? (
          <DatoQuieto
            etiqueta="Próxima salida"
            valor={proximo.hora}
            lectura={`falta ${formatearDuracion(proximo.minutosPara)} · ${proximo.nombre}`}
          />
        ) : null}
        {programadas !== null && programadas > 0 ? (
          <DatoQuieto
            etiqueta="Rutas programadas"
            valor={String(programadas)}
            lectura="en el siguiente turno"
          />
        ) : null}
        {ultimoCierre ? (
          <DatoQuieto
            etiqueta="Último cierre"
            valor={ultimoCierre.hora}
            lectura={`${ultimoCierre.turno} · verificado y sellado`}
          />
        ) : null}
        {/* Sin conteo de flota: cuántas unidades tiene el transportista es su
            operación interna, y la planta no la ve. La pregunta que este bloque
            responde —¿el silencio es normal?— no necesita el denominador. */}
        <DatoQuieto
          etiqueta="Telemetría"
          valor={telemetriaViva ? "Reportando" : "Sin lecturas"}
          lectura={
            edadMinutos === null
              ? "no hay lecturas recientes"
              : `última lectura hace ${formatearDuracion(edadMinutos)}`
          }
        />
      </div>

      {/* El mapa quieto: ciudad, destinos y trazados insinuados. Sin unidades:
          un punto dibujado con la posición de un turno que ya cerró se leería
          como movimiento de ahora. */}
      {routes.length > 0 ? <MonitoreoMapa routes={routes} quieto /> : null}
    </div>
  );
}

function DatoQuieto({
  etiqueta,
  valor,
  lectura,
}: {
  etiqueta: string;
  valor: string;
  lectura: string;
}) {
  return (
    <div className="bg-[var(--panel)] px-4 py-3">
      <p className="font-mono text-[10px] tracking-[0.13em] text-[var(--tenue)] uppercase">
        {etiqueta}
      </p>
      <p className="mt-1.5 font-[family-name:var(--fuente-archivo)] text-[20px] leading-none font-semibold text-[var(--acero)] tabular-nums">
        {valor}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--tenue)]">{lectura}</p>
    </div>
  );
}

/* ── §5.2 · Cuenta nueva ─────────────────────────────────────────────────── */

export function CuentaNueva({
  pasos,
}: {
  pasos: Array<{ titulo: string; listo: boolean; detalle: string }>;
}) {
  return (
    <div className="space-y-5">
      {/* No dice "vista en vivo": todavía no hay nada vivo que ver, y prometerlo
          antes de que exista la telemetría es una promesa que la pantalla no
          puede cumplir. */}
      <LeyendaQuieta texto="La torre todavía no puede mostrar unidades." />

      <div className="rounded-sm border border-[var(--linea)] px-5 py-6">
        <p className="max-w-[60ch] text-[15px] leading-relaxed text-[var(--texto)]">
          La torre empieza a mostrar unidades en cuanto haya rutas con turno y la
          telemetría esté conectada.
        </p>

        <ol className="mt-5 space-y-3">
          {pasos.map((p, i) => (
            <li key={p.titulo} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border font-mono text-[10px] ${
                  p.listo
                    ? "border-[var(--b-acero)] bg-[var(--t-acero)] text-[var(--acero)]"
                    : "border-[var(--linea-fuerte)] text-[var(--tenue)]"
                }`}
              >
                {p.listo ? "✓" : i + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[13px] ${
                    p.listo ? "text-[var(--tenue)]" : "text-[var(--texto)]"
                  }`}
                >
                  {p.titulo}
                  <span className="ml-2 font-mono text-[10px] tracking-[0.1em] text-[var(--tenue)] uppercase">
                    {p.listo ? "listo" : "pendiente"}
                  </span>
                </span>
                <span className="block text-[12px] leading-snug text-[var(--tenue)]">
                  {p.detalle}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ── §5.3 · Sistema sin señal ────────────────────────────────────────────────
   El estado más delicado de la pantalla. La negación va en el primer párrafo,
   antes de cualquier dato: que el sistema no vea no significa que las unidades
   no salieran. Ámbar, nunca rojo — no hay veredicto que dar.

   Y sin mapa, ni siquiera con la última posición conocida: un camión dibujado
   cerca de la planta se lee como "va llegando" aunque el dato sea de hace dos
   horas. */

export function SistemaSinSenal({
  edadMinutos,
  ultimaLectura,
  serviciosEnRiesgo,
}: {
  edadMinutos: number | null;
  ultimaLectura: string | null;
  serviciosEnRiesgo: number;
}) {
  return (
    <div className="space-y-5">
      <LeyendaQuieta texto="El sistema no está recibiendo telemetría." aviso />

      <div className="rounded-sm border border-[var(--b-ambar)] px-5 py-6">
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-[var(--texto)]">
          {/* "desde las" pide una hora suelta; aquí va la fecha completa. */}
          {ultimaLectura
            ? `No estamos recibiendo señal desde ${ultimaLectura}.`
            : "No estamos recibiendo señal."}{" "}
          <strong className="font-medium text-[var(--texto)]">
            Esto no significa que las unidades no salieron.
          </strong>{" "}
          Significa que el sistema no las está viendo.
        </p>

        <dl className="mt-5 grid grid-cols-1 gap-4 min-[560px]:grid-cols-3">
          <Medida
            etiqueta="Última lectura"
            valor={ultimaLectura ?? "—"}
            lectura={ultimaLectura ? "hora local de Juárez" : "no hay ninguna registrada"}
          />
          <Medida
            etiqueta="Tiempo sin señal"
            valor={edadMinutos === null ? "—" : formatearDuracion(edadMinutos)}
            lectura={
              edadMinutos === null ? "sin lectura previa" : "desde el último punto recibido"
            }
          />
          <Medida
            etiqueta="Servicios en riesgo"
            valor={String(serviciosEnRiesgo)}
            lectura={
              serviciosEnRiesgo === 1
                ? "servicio abierto de este turno"
                : "servicios abiertos de este turno"
            }
          />
        </dl>

        <p className="mt-5 max-w-[62ch] text-[13px] leading-relaxed text-[var(--tenue)]">
          Si la señal se restablece dentro de la ventana de evidencia del turno, los
          servicios se verifican normalmente. Si no, quedan como pendientes por evidencia
          al cierre — sin evidencia no hay incumplimiento.
        </p>
      </div>
    </div>
  );
}

function Medida({
  etiqueta,
  valor,
  lectura,
}: {
  etiqueta: string;
  valor: string;
  lectura: string;
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] tracking-[0.13em] text-[var(--tenue)] uppercase">
        {etiqueta}
      </dt>
      <dd className="mt-1.5 font-mono text-[15px] text-[var(--ambar)] tabular-nums">
        {valor}
      </dd>
      <dd className="mt-1 text-[11px] leading-snug text-[var(--tenue)]">{lectura}</dd>
    </div>
  );
}
