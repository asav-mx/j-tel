/**
 * Inicio corporativo — los datos de "¿dónde tengo que mirar hoy?".
 *
 * Dos reglas gobiernan lo que sale de aquí:
 *
 * **Toda cifra que pueda alarmar trae su alcance temporal.** La versión
 * anterior contaba desde siempre —"1837 servicios · 469 no cumplidos"— y eso es
 * §D del Marco: un dato correcto que alarma sin informar, porque no dice de
 * cuándo. Aquí las cifras son de HOY, y el pendiente trae la antigüedad del más
 * viejo.
 *
 * **Lo programado no se cuenta como historia.** Las ocurrencias se generan por
 * adelantado; contarlas junto a las juzgadas infla el total con servicios que
 * todavía no ocurren. `sin_hecho` viaja aparte y significa "programado, aún sin
 * juzgar" — no es un cuarto veredicto.
 */

import { getRepos } from "@/lib/db";
import { JTTEL_TZ, localDateIso, type OperationalUnit } from "@jtel/domain";

/** Un día de la tira. `programados === 0` no existe: ese día no trae cuadro. */
export type DiaTira = {
  dia: string;
  programados: number;
  cumplido: number;
  no_cumplido: number;
  pendiente_evidencia: number;
  sin_hecho: number;
};

export type SitioResumen = {
  unidad: OperationalUnit;
  href: string;
  /** "Campus" o "Planta independiente" — nunca "unidad". */
  tipo: string;
  transportistas: string[];
  /** Cifras de HOY, no acumuladas. */
  hoy: { servicios: number; pendientes: number; sinVerificar: number };
  /** Pendientes abiertos del sitio, sin recorte temporal — el alcance del aviso. */
  pendientesAbiertos: number;
  tira: DiaTira[];
  configurado: boolean;
};

export type InicioCorporativoData = {
  cuentaNombre: string;
  slug: string | null;
  fechaHoy: string;
  sitios: SitioResumen[];
  totalPlantas: number;
  transportistas: string[];
  /** Del conjunto, hoy. */
  sumado: { servicios: number; pendientes: number; sinVerificar: number };
  /** Pendientes abiertos de todo el alcance, sin recorte temporal — con su edad. */
  pendientesAbiertos: number;
  diasDelPendienteMasViejo: number | null;
  /** Los sitios que concentran pendientes, para que el aviso pueda comparar. */
  sitiosConPendientes: Array<{ nombre: string; pendientes: number }>;
};

export const DIAS_TIRA = 14;

function diasEntre(desde: Date, hasta: Date): number {
  return Math.floor((hasta.getTime() - desde.getTime()) / 86_400_000);
}

/**
 * Rellena la ventana con los días que la base no devolvió.
 *
 * **Un día sin renglón es un día sin servicios programados**, y por eso sale
 * con `programados: 0` en vez de omitirse: la tira necesita sus catorce
 * casillas, y la casilla vacía significa "no se programó", nunca "no hay
 * datos". Si esa distinción no se pudiera hacer, la tira no se dibujaría.
 */
export function completarTira(
  dias: string[],
  crudos: Array<Omit<DiaTira, "programados">>,
): DiaTira[] {
  const porDia = new Map(crudos.map((d) => [d.dia, d]));
  return dias.map((dia) => {
    const d = porDia.get(dia);
    if (!d) {
      return {
        dia,
        programados: 0,
        cumplido: 0,
        no_cumplido: 0,
        pendiente_evidencia: 0,
        sin_hecho: 0,
      };
    }
    return {
      ...d,
      dia,
      programados: d.cumplido + d.no_cumplido + d.pendiente_evidencia + d.sin_hecho,
    };
  });
}

/** Los N días civiles que terminan hoy, incluido hoy. */
export function ventanaTira(hoy: Date): { desde: Date; hasta: Date; dias: string[] } {
  const hasta = hoy;
  const desde = new Date(hoy.getTime() - (DIAS_TIRA - 1) * 86_400_000);
  const dias: string[] = [];
  for (let i = 0; i < DIAS_TIRA; i++) {
    dias.push(localDateIso(new Date(desde.getTime() + i * 86_400_000), JTTEL_TZ));
  }
  return { desde, hasta, dias };
}

export async function loadInicioCorporativo(
  clientAccountId: string,
  opts: { nombre: string; slug: string | null; ahora?: Date },
): Promise<InicioCorporativoData> {
  const repos = getRepos();
  const ahora = opts.ahora ?? new Date();
  const hoyIso = localDateIso(ahora, JTTEL_TZ);
  const { desde, hasta, dias } = ventanaTira(ahora);

  const [unidades, contratos, pendienteMasViejo, conteoAbiertos] = await Promise.all([
    repos.clients.getOperationalUnits(clientAccountId),
    repos.contracts.findForClient(clientAccountId),
    repos.occurrences.pendienteMasViejoForClientAccount(clientAccountId),
    repos.occurrences.countByStatusForClientAccount(clientAccountId),
  ]);

  const { contractMatchesScope } = await import("@/lib/operational-scope");
  const { unitDashboardHref } = await import("@/lib/unit-routes");

  const sitios = await Promise.all(
    unidades.map(async (unidad): Promise<SitioResumen> => {
      const scope =
        unidad.kind === "plant"
          ? ({ kind: "plant" as const, plantId: unidad.id })
          : ({ kind: "plant_group" as const, plantGroupId: unidad.id });

      const contratosDelSitio = contratos.filter((c) => contractMatchesScope(c, scope));

      const [hoyConteo, abiertosConteo, tiraCruda] = await Promise.all([
        // Solo hoy: el alcance temporal viaja en la consulta, no en una nota.
        repos.occurrences.countByStatusForScope(scope, ahora, ahora),
        // Sin recorte: los pendientes abiertos del sitio. Tiene que ser el
        // MISMO alcance que el total del aviso — comparar "22 de siempre"
        // contra "3 de hoy" en una sola frase es §D con otro disfraz.
        repos.occurrences.countByStatusForScope(scope),
        repos.occurrences.tiraDiariaForScope(scope, desde, hasta),
      ]);

      const tira = completarTira(dias, tiraCruda);

      return {
        unidad,
        href: unitDashboardHref(unidad, opts.slug ?? ""),
        tipo: unidad.kind === "plant_group" ? "Campus" : "Planta independiente",
        transportistas: [
          ...new Set(
            contratosDelSitio
              .map((c) => (c as { carrier?: { name?: string } }).carrier?.name)
              .filter((n): n is string => Boolean(n)),
          ),
        ],
        hoy: {
          servicios: hoyConteo.total,
          pendientes: hoyConteo.pendiente_evidencia,
          sinVerificar: hoyConteo.sin_hecho,
        },
        pendientesAbiertos: abiertosConteo.pendiente_evidencia,
        tira,
        configurado: contratosDelSitio.length > 0,
      };
    }),
  );

  const totalPlantas = unidades.reduce(
    (n, u) => n + (u.kind === "plant_group" ? u.memberPlants.length : 1),
    0,
  );

  const transportistas = [...new Set(sitios.flatMap((s) => s.transportistas))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  return {
    cuentaNombre: opts.nombre,
    slug: opts.slug,
    fechaHoy: hoyIso,
    sitios,
    totalPlantas,
    transportistas,
    sumado: {
      servicios: sitios.reduce((n, s) => n + s.hoy.servicios, 0),
      pendientes: sitios.reduce((n, s) => n + s.hoy.pendientes, 0),
      sinVerificar: sitios.reduce((n, s) => n + s.hoy.sinVerificar, 0),
    },
    pendientesAbiertos: conteoAbiertos.pendiente_evidencia,
    diasDelPendienteMasViejo: pendienteMasViejo ? diasEntre(pendienteMasViejo, ahora) : null,
    // Para que el aviso pueda comparar: un número solo no dice si es mucho.
    // Mismo alcance que `pendientesAbiertos`, a propósito.
    sitiosConPendientes: sitios
      .filter((s) => s.pendientesAbiertos > 0)
      .map((s) => ({ nombre: s.unidad.name, pendientes: s.pendientesAbiertos }))
      .sort((a, b) => b.pendientes - a.pendientes),
  };
}
