import Link from "next/link";
import { getRepos } from "@/lib/db";
import { UnitShell } from "@/components/unit-shell";
import type { UnitPageContext } from "@/lib/unit-context";
import { operationalUnitLabel } from "@/lib/operational-scope";
import { withAccount } from "@/lib/account-context";
import { unitBasePath, unitComplianceHref, unitConfigHubHref } from "@/lib/unit-routes";
import { localDateIso } from "@/lib/local-time";
import { dayForDateQuery, JTTEL_TZ } from "@jtel/domain";

/**
 * El inicio de una unidad operativa — cara planta y campus.
 *
 * Contesta "¿estoy bien?" antes de que el usuario lea nada más, y lo contesta
 * con **conteos, no con juicio**. La distinción de la ficha: un pendiente
 * abierto es el mismo número mañana aunque el motor mejore; un porcentaje de
 * cumplimiento no. Por eso aquí no hay ni uno solo, y el widget que los
 * mostraría está declarado como espacio reservado en vez de escondido.
 *
 * La bandeja manda. Si los widgets crecieran más que ella, esta pantalla se
 * volvería un tablero de monitoreo — que es justo lo que el producto existe
 * para eliminar.
 */

const mono = "font-[family-name:var(--fuente-mono)]";

function fechaLarga(tz: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: tz,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function soloHora(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * El titular cuenta **asuntos, no servicios**.
 *
 * Sumar los servicios de los renglones daría un número más grande y más falso:
 * los pendientes son todos los que siguen abiertos —sin importar de cuándo— y
 * los no cumplidos son los de un cierre concreto. Sumar un acumulado histórico
 * con el corte de un día produce una cifra correcta de aritmética que no
 * describe nada, y que además se contradice con el "2 asuntos abiertos" que la
 * bandeja muestra dos renglones más abajo.
 *
 * Así lo dice la ficha, además: su ejemplo "Tres cosas te necesitan" va con
 * una bandeja de tres renglones, no con la suma de sus servicios.
 *
 * No lleva el énfasis en ámbar que la ficha reserva para "vence mañana": ese
 * énfasis necesita una fecha límite, y el plazo del pendiente no está acordado
 * —`plazoCierreEn` sigue en null. Pintar urgencia sin un reloj detrás sería
 * inventarle presión al usuario.
 */
function titular(asuntos: number): string {
  if (asuntos === 0) return "Hoy nada te necesita.";
  if (asuntos === 1) return "Una cosa te necesita.";
  return `${asuntos} cosas te necesitan.`;
}

/**
 * Los turnos de hoy, dichos como hechos de calendario.
 *
 * `pickActiveShift` devuelve el último turno que ya arrancó, y eso NO es lo
 * mismo que un turno en curso: `shifts.startTime` es una hora nominal sin
 * duración, así que el sistema no sabe si el turno sigue corriendo o terminó
 * hace seis horas. Llamarle "turno activo" sería afirmar algo que el dato no
 * sostiene.
 *
 * Lo que sí se puede decir: cuál entró y cuál sigue.
 */
function turnosDelDia(
  shifts: Array<{ id: string; name: string; startTime: string }>,
  ahoraMinutos: number,
): { ultimoQueEntro: { name: string; hora: string } | null; siguiente: { name: string; hora: string } | null } {
  const ordenados = [...shifts]
    .map((s) => ({ name: s.name, hora: String(s.startTime).slice(0, 5) }))
    .sort((a, b) => a.hora.localeCompare(b.hora));

  const enMinutos = (hhmm: string) => {
    const [h = 0, m = 0] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  let ultimoQueEntro: { name: string; hora: string } | null = null;
  let siguiente: { name: string; hora: string } | null = null;
  for (const t of ordenados) {
    if (enMinutos(t.hora) <= ahoraMinutos) ultimoQueEntro = t;
    else if (!siguiente) siguiente = t;
  }
  return { ultimoQueEntro, siguiente };
}

export async function UnitDashboard({ ctx }: { ctx: UnitPageContext }) {
  const repos = getRepos();
  const { client, unit, scope } = ctx;
  const unitLabel = operationalUnitLabel(unit);
  const base = unitBasePath(unit);
  const hoy = localDateIso();

  const [conteoTotal, ultimoSello, shifts] = await Promise.all([
    repos.occurrences.countByStatusForScope(scope),
    repos.occurrences.ultimoSelloForScope(scope),
    repos.routes.getShiftsForScope(scope),
  ]);

  // El cierre más reciente: sus cifras salen del día que se selló, no de la
  // historia entera. "190 no cumplidos" acumulados desde siempre alarman sin
  // decir de cuándo.
  const conteoDelCierre = ultimoSello
    ? await repos.occurrences.countByStatusForScope(
        scope,
        dayForDateQuery(ultimoSello.serviceDate),
        dayForDateQuery(ultimoSello.serviceDate),
      )
    : null;

  const pendientes = conteoTotal.pendiente_evidencia;
  const noCumplidosDelCierre = conteoDelCierre?.no_cumplido ?? 0;
  // Asuntos, no servicios: cada renglón de la bandeja es una cosa que te necesita.
  const asuntos = (pendientes > 0 ? 1 : 0) + (noCumplidosDelCierre > 0 ? 1 : 0);

  const tz = JTTEL_TZ;
  const ahoraMinutos = Number(
    new Intl.DateTimeFormat("es-MX", { timeZone: tz, hour: "2-digit", hour12: false }).format(
      new Date(),
    ),
  ) * 60 +
    Number(
      new Intl.DateTimeFormat("es-MX", { timeZone: tz, minute: "2-digit" }).format(new Date()),
    );
  const turnos = turnosDelDia(
    shifts.map((s) => ({ id: s.id, name: s.name, startTime: String(s.startTime) })),
    ahoraMinutos,
  );

  const configurado = shifts.length > 0;

  return (
    <UnitShell client={client} unit={unit} title={unitLabel}>
      <h1 className="mt-7 mb-2.5 max-w-[24ch] font-[family-name:var(--fuente-archivo)] text-[clamp(28px,5vw,42px)] leading-[1.02] font-bold tracking-[-0.022em]">
        {titular(asuntos)}
      </h1>

      <p className={`text-[12.5px] ${mono} text-[var(--tenue)]`}>
        {fechaLarga(tz)}
        {ultimoSello ? (
          <>
            {" · último sello "}
            <span className="text-[var(--acero)]">{soloHora(ultimoSello.selladoEn, tz)}</span>
            {" del "}
            <span className="text-[var(--acero)]">{ultimoSello.serviceDate}</span>
          </>
        ) : (
          " · todavía no se ha sellado ningún servicio en este sitio"
        )}
      </p>

      {!configurado ? (
        /*
         * Cuenta nueva: el inicio enseña la cadena de configuración, no un
         * tablero vacío. Un cero aquí no significa "todo bien" — significa que
         * todavía no hay nada que juzgar, y confundir las dos cosas es lo peor
         * que puede hacer esta pantalla.
         */
        <div className="mt-8 border border-[var(--linea)] border-l-2 border-l-[var(--azul)] bg-[var(--panel)] px-5 py-4">
          <p className="text-[15px] font-medium text-[var(--texto)]">
            Esta unidad todavía no está configurada.
          </p>
          <p className="mt-1.5 max-w-[66ch] text-[13.5px] text-[var(--tenue)]">
            Sin turnos ni rutas no hay servicios que verificar, y el silencio de esta pantalla no
            quiere decir que todo esté bien: quiere decir que no hay nada medido todavía.
          </p>
          <p className="mt-3 text-[13px]">
            <Link href={unitConfigHubHref(unit, client.slug)} className="text-[var(--azul)]">
              Abrir la oficina y configurar →
            </Link>
          </p>
        </div>
      ) : (
        <Bandeja
          slug={client.slug}
          base={base}
          unitLabel={unitLabel}
          pendientes={pendientes}
          noCumplidos={noCumplidosDelCierre}
          fechaCierre={ultimoSello?.serviceDate ?? null}
          verificadosDelCierre={conteoDelCierre?.total ?? 0}
        />
      )}

      <Widgets
        slug={client.slug}
        base={base}
        compliance={unitComplianceHref(unit, client.slug)}
        ultimoSello={ultimoSello}
        selladosDelCierre={conteoDelCierre?.total ?? 0}
        turnos={turnos}
        tz={tz}
        hoy={hoy}
      />

      <ModulosNoContratados />
    </UnitShell>
  );
}

/**
 * La bandeja — la zona dominante.
 *
 * Orden: lo prevenible antes de lo ya sellado. Un pendiente todavía puede
 * resolverse solo si llega el archivo; un no cumplido ya está sellado y lo que
 * queda es administrarlo.
 *
 * El tercer renglón de la ficha —el hallazgo preventivo— no se dibuja: la
 * detección de deriva y agrupamiento es de Ola 3 y no existe. Se declara abajo
 * en vez de esconderse.
 */
function Bandeja({
  slug,
  base,
  unitLabel,
  pendientes,
  noCumplidos,
  fechaCierre,
  verificadosDelCierre,
}: {
  slug: string;
  base: string;
  unitLabel: string;
  pendientes: number;
  noCumplidos: number;
  fechaCierre: string | null;
  verificadosDelCierre: number;
}) {
  const renglones = [
    pendientes > 0
      ? {
          clave: "pendientes",
          tono: "ambar" as const,
          cifra: pendientes,
          afirmacion:
            pendientes === 1
              ? "Un servicio quedó sin resultado por falta de evidencia."
              : `${pendientes} servicios quedaron sin resultado por falta de evidencia.`,
          detalle:
            "No cuentan como incumplimiento ni como cumplido. Si llega la telemetría archivada, se verifican solos.",
          href: withAccount(`${base}/pendiente-por-evidencia`, slug),
          accion: "Ver la bandeja",
        }
      : null,
    noCumplidos > 0 && fechaCierre
      ? {
          clave: "no-cumplidos",
          tono: "rojo" as const,
          cifra: noCumplidos,
          afirmacion:
            noCumplidos === 1
              ? "Un servicio no se cumplió en el último cierre."
              : `${noCumplidos} servicios no se cumplieron en el último cierre.`,
          detalle: `Del cierre del ${fechaCierre}. Ya están sellados: lo que queda es la consecuencia que diga el contrato.`,
          href: withAccount(`${base}/cierre?fecha=${fechaCierre}`, slug),
          accion: "Abrir el cierre",
        }
      : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null);

  if (renglones.length === 0) {
    return (
      <div className="mt-8 border border-[var(--linea)] bg-[var(--panel)] px-5 py-5">
        <p className="text-[15px] font-medium text-[var(--texto)]">
          Nada quedó abierto en {unitLabel}.
        </p>
        <p className="mt-1.5 max-w-[66ch] text-[13.5px] text-[var(--tenue)]">
          {fechaCierre
            ? `El último cierre — el del ${fechaCierre} — dejó ${verificadosDelCierre} ${verificadosDelCierre === 1 ? "servicio verificado" : "servicios verificados"} y ningún pendiente.`
            : "Todavía no hay cierres con resultado en este sitio."}
        </p>
      </div>
    );
  }

  return (
    <section className="mt-8">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--linea)] pb-2">
        <h2
          className={`text-[11px] font-semibold tracking-[.14em] text-[var(--tenue)] uppercase ${mono}`}
        >
          Lo que te necesita
        </h2>
        <span className={`text-[11px] ${mono} text-[var(--tenue)]`}>
          {renglones.length === 1 ? "1 asunto abierto" : `${renglones.length} asuntos abiertos`}
        </span>
      </header>

      <ul className="grid gap-px bg-[var(--linea)]">
        {renglones.map((r) => (
          <li
            key={r.clave}
            className="flex flex-wrap items-start gap-4 bg-[var(--panel)] px-4 py-4 sm:flex-nowrap"
          >
            {/*
             * La marca cuadrada con su cifra. Ámbar y rojo son legítimos aquí y
             * solo aquí: cada uno representa servicios concretos con ese
             * resultado, no un agregado ni un estado de la pantalla.
             */}
            <span
              className={`flex h-11 w-11 flex-none items-center justify-center rounded-[2px] border text-[17px] font-bold tabular-nums ${mono} ${
                r.tono === "ambar"
                  ? "border-[var(--b-ambar)] bg-[var(--t-ambar)] text-[var(--ambar)]"
                  : "border-[var(--b-rojo)] bg-[var(--t-rojo)] text-[var(--rojo)]"
              }`}
            >
              {r.cifra}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-[var(--texto)]">{r.afirmacion}</p>
              <p className="mt-1 max-w-[74ch] text-[12.5px] text-[var(--tenue)]">{r.detalle}</p>
            </div>
            <Link
              href={r.href}
              className="flex-none rounded-[2px] border border-[var(--linea-fuerte)] px-3.5 py-2 text-[12px] text-[var(--texto)] transition-colors hover:border-[var(--azul)] hover:text-[var(--azul)]"
            >
              {r.accion} →
            </Link>
          </li>
        ))}
      </ul>

      {/*
       * El renglón que la ficha pide y todavía no existe. Se declara en vez de
       * omitirse: el usuario ve que la plataforma va a tener esa capacidad y
       * por qué hoy no la muestra.
       */}
      <p className={`mt-2.5 text-[11.5px] ${mono} text-[var(--tenue)]`}>
        Los hallazgos preventivos —deriva de una ruta, huecos que se concentran en una unidad—
        entran cuando exista su detección. Hoy no hay ninguno que mostrar, y no se pinta un cero
        que parezca tranquilidad.
      </p>
    </section>
  );
}

/**
 * Los widgets acompañan; nunca dominan. Cada uno es una puerta a su sección con
 * una línea de estado — nunca una gráfica, que en el inicio está prohibida.
 */
function Widgets({
  slug,
  base,
  compliance,
  ultimoSello,
  selladosDelCierre,
  turnos,
  tz,
  hoy,
}: {
  slug: string;
  base: string;
  compliance: string;
  ultimoSello: { selladoEn: Date; serviceDate: string } | null;
  selladosDelCierre: number;
  turnos: {
    ultimoQueEntro: { name: string; hora: string } | null;
    siguiente: { name: string; hora: string } | null;
  };
  tz: string;
  hoy: string;
}) {
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-3">
      <Link
        href={withAccount(`${base}/cierre${ultimoSello ? `?fecha=${ultimoSello.serviceDate}` : ""}`, slug)}
        className="block rounded-lg border border-[var(--linea)] bg-[var(--panel)] p-5 transition hover:border-[var(--azul)]"
      >
        <h3 className="text-[14.5px] font-semibold text-[var(--texto)]">Cierre del turno</h3>
        <p className={`mt-2 text-[12.5px] ${mono} text-[var(--tenue)]`}>
          {ultimoSello ? (
            <>
              Último cierre{" "}
              <span className="text-[var(--acero)]">{soloHora(ultimoSello.selladoEn, tz)}</span> ·{" "}
              <span className="text-[var(--acero)]">{selladosDelCierre}</span>{" "}
              {selladosDelCierre === 1 ? "servicio sellado" : "servicios sellados"}
            </>
          ) : (
            "Sin cierres todavía"
          )}
        </p>
      </Link>

      <Link
        href={withAccount(`${base}/monitoreo`, slug)}
        className="block rounded-lg border border-[var(--linea)] bg-[var(--panel)] p-5 transition hover:border-[var(--azul)]"
      >
        <h3 className="text-[14.5px] font-semibold text-[var(--texto)]">Monitoreo</h3>
        <p className={`mt-2 text-[12.5px] ${mono} text-[var(--tenue)]`}>
          {turnos.ultimoQueEntro || turnos.siguiente ? (
            <>
              {turnos.ultimoQueEntro ? (
                <>
                  <span className="text-[var(--acero)]">{turnos.ultimoQueEntro.name}</span> entró{" "}
                  <span className="text-[var(--acero)]">{turnos.ultimoQueEntro.hora}</span>
                </>
              ) : null}
              {turnos.ultimoQueEntro && turnos.siguiente ? " · " : null}
              {turnos.siguiente ? (
                <>
                  <span className="text-[var(--acero)]">{turnos.siguiente.name}</span> entra{" "}
                  <span className="text-[var(--acero)]">{turnos.siguiente.hora}</span>
                </>
              ) : null}
            </>
          ) : (
            "Sin turnos configurados"
          )}
        </p>
      </Link>

      {/*
       * Espacio reservado, deliberado y honesto. El usuario ve que la
       * plataforma tiene la capacidad y por qué todavía no la muestra — la
       * misma disciplina del pendiente por evidencia aplicada al producto.
       *
       * No es un enlace: se ve, se entiende, no se entra.
       */}
      <div className="rounded-lg border border-dashed border-[var(--linea-fuerte)] bg-[var(--panel)] p-5">
        <h3 className="text-[14.5px] font-semibold text-[var(--tenue)]">Cumplimiento</h3>
        <p className="mt-2 max-w-[42ch] text-[12.5px] text-[var(--tenue)]">
          La cifra del periodo, cuando la verificación alcance su umbral de confianza. No se
          publica un porcentaje que todavía se mueve.
        </p>
        <p className={`mt-2.5 text-[11px] ${mono} text-[var(--tenue)]`}>
          <Link href={compliance} className="text-[var(--azul)] hover:underline">
            Ver los servicios uno por uno →
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * Los módulos que esta cuenta no tiene contratados. Borde punteado y su
 * requisito declarado — **nunca se esconden**: el instrumento enseña lo que va
 * a poder hacer.
 */
function ModulosNoContratados() {
  const modulos = [
    { nombre: "Quejas", requisito: "requiere el módulo de quejas" },
    { nombre: "Pre-nómina", requisito: "requiere el módulo de choferes" },
    { nombre: "Panorama corporativo", requisito: "requiere una cuenta con varias plantas" },
  ];
  return (
    <section className="mt-10">
      <h2
        className={`mb-3 text-[10px] font-semibold tracking-[.14em] text-[var(--tenue)] uppercase ${mono}`}
      >
        No contratado
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {modulos.map((m) => (
          <div
            key={m.nombre}
            className="rounded-lg border border-dashed border-[var(--linea)] px-4 py-3"
          >
            <p className="text-[13px] text-[var(--tenue)]">{m.nombre}</p>
            <p className={`mt-0.5 text-[11px] ${mono} text-[var(--tenue)]`}>{m.requisito}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
