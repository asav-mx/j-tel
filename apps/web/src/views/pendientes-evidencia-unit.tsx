import Link from "next/link";
import {
  loadPendientesEvidencia,
  type CasoPendiente as CasoPendienteData,
} from "@/lib/pendientes-evidencia-data";
import { UnitShell } from "@/components/unit-shell";
import { ChipResultado } from "@/components/chip-resultado";
import {
  AfirmacionPendiente,
  BarraCobertura,
  MedidaCobertura,
  NotaHonestaPendiente,
  TiraVentana,
  UltimaSenal,
  rielPendiente,
} from "@/components/caso-pendiente-evidencia";
import type { BandaPendientes } from "@/lib/pendientes-evidencia-data";
import { HistoriaDelSello, PuntoHistoriaSello } from "@/components/historia-del-sello";
import { withAccount } from "@/lib/account-context";
import type { UnitPageContext } from "@/lib/unit-context";
import { operationalUnitLabel } from "@/lib/operational-scope";

/**
 * Pendiente por evidencia — cara planta.
 *
 * El estado más honesto del producto hecho pantalla (PLAN-v1, Ola 1): todo lo
 * que el árbitro no pudo juzgar por falta de señal, sin importar cuándo se
 * detectó. **Esta vista deriva de hechos ya sellados. Cargarla no verifica ni
 * escribe ningún resultado.**
 *
 * No hay fecha ni turno seleccionable — es una bandeja, no un corte de un día.
 */

function titular(n: number): string {
  if (n === 0) return "Ningún servicio quedó sin resultado.";
  if (n === 1) return "Un servicio quedó sin resultado.";
  return `${n} servicios quedaron sin resultado.`;
}

/**
 * La declaración de límite, antes de cualquier dato.
 *
 * Existe para contestar por adelantado la lectura equivocada más probable: un
 * gerente que lee "pendiente" como "falla" y le reclama al carrier algo que no
 * pasó. Por eso va arriba de todo y no al pie — al pie ya sería tarde.
 *
 * Ámbar en el borde porque es el color propio del estado, no un rojo atenuado.
 */
function DeclaracionDeLimite() {
  return (
    <div className="mt-6 border border-[var(--linea)] border-l-2 border-l-[var(--ambar)] bg-[var(--panel)] px-5 py-4">
      <p className="max-w-[68ch] text-[15px] font-medium text-[var(--texto)]">
        El sistema no vio lo suficiente para juzgar estos servicios.
      </p>
      {/*
       * La frase no nombra una causa. Decía "la evidencia no alcanzó el mínimo
       * que el contrato pide", y eso solo es cierto en una parte de la bandeja:
       * hay pendientes con la cobertura muy por encima del umbral que quedaron
       * así porque no se pudo atribuir la llegada a ninguna ruta, o porque la
       * ventana no alcanzó a cubrir el arranque. La causa concreta la dice cada
       * tarjeta, leída del ledger; aquí arriba solo va lo que vale para todas.
       */}
      <p className="mt-1.5 max-w-[68ch] text-[13.5px] text-[var(--tenue)]">
        No cuentan como incumplimiento <b className="font-medium text-[var(--texto)]">ni como
        cumplido</b>. A cada uno le faltó algo distinto para poder emitir un resultado —abajo se
        dice qué—, y forzar un veredicto sobre lo que no se alcanzó a observar sería inventarlo.
      </p>
    </div>
  );
}

/**
 * La banda de estado.
 *
 * Tres renglones, no cuatro: el "más próximo a cerrar" que pedía la ficha
 * necesita un plazo, y no hay plazo acordado en el contrato — dibujarlo como
 * valor de demostración metería en pantalla un reloj que nadie pactó. El hueco
 * queda reservado en `plazoCierreEn`, igual que en el resto de la pantalla.
 *
 * El renglón del medio es el que carga el mensaje: enseña que el pendiente no
 * es un callejón sin salida.
 */
function Banda({ banda, tz }: { banda: BandaPendientes; tz: string }) {
  const mes = new Intl.DateTimeFormat("es-MX", {
    timeZone: tz,
    month: "long",
  }).format(new Date(banda.mesDesde));

  const celdas: Array<{ cifra: string; lectura: string }> = [
    {
      cifra: String(banda.abiertos),
      lectura: banda.abiertos === 1 ? "abierto ahora" : "abiertos ahora",
    },
    {
      cifra: String(banda.resueltosSolosEsteMes),
      lectura: `se resolvieron solos en ${mes}, al llegar el archivo`,
    },
  ];
  if (banda.minimoCoberturaPct != null) {
    celdas.push({
      cifra: `${banda.minimoCoberturaPct.toFixed(1)}%`,
      lectura: "señal mínima que pide el contrato para poder juzgar",
    });
  }

  return (
    <dl className="mt-6 grid gap-px overflow-hidden border border-[var(--linea)] bg-[var(--linea)] sm:grid-cols-3">
      {celdas.map((c) => (
        <div key={c.lectura} className="bg-[var(--panel)] px-4 py-3.5">
          <dt className="font-[family-name:var(--fuente-archivo)] text-[24px] leading-none font-bold tracking-[-0.015em] text-[var(--acero)] tabular-nums">
            {c.cifra}
          </dt>
          <dd className="mt-1.5 max-w-[30ch] text-[11.5px] leading-[1.45] text-[var(--tenue)]">
            {c.lectura}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Un patrón que se repite en la bandeja, dicho como hecho observable.
 *
 * "Dos días seguidos en la misma ruta" es algo que se ve; de quién es la causa
 * no. La ficha es explícita en que esta pantalla no reparte culpa, así que la
 * nota describe y se detiene ahí.
 *
 * El mockup pedía además "y la misma unidad". No se puede: un pendiente nunca
 * tiene unidad acreditada —el motor solo la persiste cuando el veredicto salió
 * `cumplido`— así que nombrarla sería inventar evidencia que el árbitro no
 * selló.
 */
function patronPorRuta(casos: CasoPendienteData[]): Map<string, string> {
  const porRuta = new Map<string, string[]>();
  for (const c of casos) {
    const fechas = porRuta.get(c.profileCode) ?? [];
    fechas.push(c.fecha);
    porRuta.set(c.profileCode, fechas);
  }

  const notas = new Map<string, string>();
  for (const [code, fechas] of porRuta) {
    if (fechas.length < 2) continue;
    const orden = [...new Set(fechas)].sort();
    const seguidos = orden.every((f, i) => {
      if (i === 0) return true;
      const anterior = new Date(`${orden[i - 1]}T00:00:00Z`).getTime();
      return new Date(`${f}T00:00:00Z`).getTime() - anterior === 86_400_000;
    });
    notas.set(
      code,
      seguidos
        ? `${orden.length} días seguidos en esta misma ruta.`
        : `${orden.length} días en esta misma ruta.`,
    );
  }
  return notas;
}

export async function PendientesEvidenciaUnitView({ ctx }: { ctx: UnitPageContext }) {
  const payload = await loadPendientesEvidencia({
    scope: ctx.scope,
    accountSlug: ctx.client.slug,
  });
  const unitLabel = operationalUnitLabel(ctx.unit);
  const tz = payload.zonaHoraria;
  const patrones = patronPorRuta(payload.casos);

  return (
    <UnitShell
      client={ctx.client}
      unit={ctx.unit}
      title={`Pendiente por evidencia — ${unitLabel}`}
    >
      <h1 className="mt-7 mb-2.5 max-w-[24ch] font-[family-name:var(--fuente-archivo)] text-[clamp(28px,5vw,42px)] leading-[1.02] font-bold tracking-[-0.022em]">
        {titular(payload.casos.length)}
      </h1>

      <DeclaracionDeLimite />

      <Banda banda={payload.banda} tz={tz} />

      {payload.casos.length === 0 ? (
        /*
         * El día bueno. No es una pantalla vacía: es la meta cumplida, y se
         * dice como tal — con el renglón de los que se resolvieron solos, que
         * es la prueba de que la bandeja se vacía.
         */
        <p className="mt-10 max-w-[62ch] text-[15px] text-[var(--tenue)]">
          Todos los servicios de <span className="text-[var(--texto)]">{unitLabel}</span> tuvieron
          señal suficiente para recibir un resultado.
        </p>
      ) : (
        <>
          <div className="mt-10">
            {payload.casos.map((c) => (
              <Caso
                key={c.occurrenceId}
                c={c}
                tz={tz}
                slug={ctx.client.slug}
                patron={patrones.get(c.profileCode) ?? null}
              />
            ))}
          </div>

          <ComoSaleDeAhi />
        </>
      )}

      <div className="mt-14 border-t border-[var(--linea)] pt-5 font-mono text-[11px] leading-[1.9] text-[var(--tenue)]">
        Pendiente por evidencia · J-Telemetry — cara planta.
        <br />
        "Sin señal" es un motivo bajo pendiente, no un cuarto estado: los resultados siguen siendo
        tres.
        <br />
        El sistema no afirma lo que no midió; el pendiente es esa regla hecha visible.
        <br />
        El ámbar es su color propio, no un rojo atenuado: aquí no hay falta declarada.
      </div>
    </UnitShell>
  );
}

function Caso({
  c,
  tz,
  slug,
  patron,
}: {
  c: CasoPendienteData;
  tz: string;
  slug: string;
  patron: string | null;
}) {
  const r = rielPendiente(c);

  return (
    <div className="grid grid-cols-1 gap-3 border-t border-[var(--linea)] py-6 sm:grid-cols-[118px_1fr] sm:gap-7">
      <div className="pt-0.5">
        {/*
         * La cifra va en ámbar porque es la carencia que dejó al servicio sin
         * juzgar — no un veredicto. Es el único ámbar del riel, y el pie de la
         * pantalla lo dice: aquí no hay falta declarada.
         */}
        <div className="font-[family-name:var(--fuente-archivo)] text-[22px] leading-none font-bold tracking-[-0.015em] text-[var(--ambar)] tabular-nums">
          {r.cifra}
        </div>
        <div className="mt-1.5 font-mono text-[10px] leading-[1.5] font-medium tracking-[0.14em] text-[var(--tenue)] uppercase">
          {r.sub}
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-2.5 flex flex-wrap items-center gap-3 font-mono text-[10.5px] font-medium tracking-[0.15em] text-[var(--tenue)] uppercase">
          <ChipResultado estado="pendiente_evidencia" />
          <span>
            {c.profileName}
            {c.turnoName ? ` · ${c.turnoName}` : ""} · {c.fecha}
          </span>
          <PuntoHistoriaSello historia={c.historiaSello} />
        </p>

        <h3 className="mb-3 max-w-[42ch] font-[family-name:var(--fuente-archivo)] text-[19px] leading-[1.24] font-semibold">
          <AfirmacionPendiente
            causa={c.causa}
            hueco={c.hueco}
            fraccionObservada={c.fraccionObservada}
            tz={tz}
          />
        </h3>

        <div className="mb-3 border border-[var(--linea)] bg-[var(--panel)] px-3.5 py-3">
          {/*
           * Tres medidas, cada una junto a su umbral. Son tres y no cuatro a
           * propósito: la cuarta del mockup —"puntos recibidos de cuántos
           * esperados"— necesita una frecuencia nominal de reporte que no
           * existe en el dominio. Ni el contrato ni los puntos de evidencia
           * definen cada cuánto debería reportar una unidad, y el motor no lo
           * necesita porque mide cobertura de tiempo, no de puntos. Inventar
           * ese denominador sería justo lo que esta pantalla existe para no
           * hacer.
           */}
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 font-mono text-[12px] text-[var(--tenue)]">
            <MedidaCobertura
              cobertura={c.cobertura}
              textoNoDisponible="Sin señal en la ventana — no hay cobertura que mostrar."
            />
            <UltimaSenal ultima={c.ultimaSenal} tz={tz} />
          </div>

          <BarraCobertura cobertura={c.cobertura} />

          <TiraVentana
            tramos={c.tramos}
            desdeEn={c.ventanaDesdeEn}
            hastaEn={c.ventanaHastaEn}
            tz={tz}
          />
        </div>

        <NotaHonestaPendiente />

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={withAccount(`/cliente/servicio/${c.occurrenceId}`, slug)}
            className="inline-block cursor-pointer rounded-sm border border-[var(--acero)] px-3.5 py-2 font-mono text-[11px] font-medium tracking-[0.11em] text-[var(--acero)] uppercase transition-colors hover:bg-[var(--hover)]"
          >
            Abrir el expediente
          </Link>
          <HistoriaDelSello historia={c.historiaSello} timeZone={tz} />
          <span className="text-[12.5px] text-[var(--tenue)]">
            si la telemetría archivada llega completa, este servicio se verifica solo
          </span>
        </div>

        {patron ? (
          <p className="mt-3 text-[12.5px] text-[var(--tenue)]">
            <span className="text-[var(--texto)]">{patron}</span> Es un hecho observable; el sistema
            no dice de qué es causa.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Cómo sale de ahí — una sola vez, no por caso. El plazo de cierre del
 * pendiente NO existe todavía: ni columna ni lógica. Donde el mockup pone la
 * barra "cierra en 2 días" va este aviso honesto en azul de sistema, no en
 * ámbar de veredicto — el pendiente no se está incumpliendo, el reloj de
 * cierre simplemente todavía no se definió.
 *
 * El hueco queda reservado a propósito en `PendientesEvidenciaPayload.plazoCierreEn`,
 * como el bloque de enforcement en Cierre del turno: se enciende cuando el
 * contrato lo defina con la planta y el área legal, no antes.
 */
function ComoSaleDeAhi() {
  return (
    <div className="mt-10 border border-[var(--linea)] border-l-2 border-l-[var(--ambar)] bg-[var(--panel)] px-5 py-[18px]">
      <p className="mb-3 font-[family-name:var(--fuente-archivo)] text-[16px] font-semibold">
        Cómo sale de ahí — el pendiente no es para siempre
      </p>

      <div className="grid gap-px overflow-hidden border border-[var(--linea)] bg-[var(--linea)]">
        <div className="flex items-start gap-3.5 bg-[var(--panel)] px-4 py-3.5">
          <span className="mt-1.5 h-[7px] w-[7px] flex-none rounded-full bg-[var(--acero)]" />
          <div>
            <h4 className="mb-0.5 font-[family-name:var(--fuente-archivo)] text-[14.5px] font-semibold">
              Se completa sola
            </h4>
            <p className="max-w-[56ch] text-[13px] text-[var(--tenue)]">
              Si el archivo recupera los puntos que faltaban, el servicio{" "}
              <b className="font-medium text-[var(--texto)]">se verifica de nuevo</b> y el resultado
              deja de estar pendiente — con su historia del sello.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3.5 bg-[var(--panel)] px-4 py-3.5">
          <span className="mt-1.5 h-[7px] w-[7px] flex-none rounded-full bg-[var(--azul)]" />
          <div>
            <h4 className="mb-0.5 font-[family-name:var(--fuente-archivo)] text-[14.5px] font-semibold">
              El carrier aporta su etiqueta
            </h4>
            <p className="max-w-[56ch] text-[13px] text-[var(--tenue)]">
              El carrier puede declarar que el servicio sí se realizó (etiqueta de calibración).{" "}
              <b className="font-medium text-[var(--texto)]">No cambia el resultado</b> por sí sola,
              pero entra al expediente como su versión.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3.5 bg-[var(--panel)] px-4 py-3.5">
          <span className="mt-1.5 h-[7px] w-[7px] flex-none rounded-full bg-[var(--ambar)]" />
          <div>
            <h4 className="mb-0.5 font-[family-name:var(--fuente-archivo)] text-[14.5px] font-semibold">
              Llega el cierre sin resolverse
            </h4>
            <p className="max-w-[56ch] text-[13px] text-[var(--tenue)]">
              Al vencer el plazo, la planta decide según lo que diga el contrato — pagar o no.{" "}
              <b className="font-medium text-[var(--texto)]">El sistema no decide por ella;</b> le
              da el hecho y la fecha límite.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3.5 border-t border-[var(--linea)] pt-3 font-mono text-[11px] leading-[1.6] text-[var(--azul)]">
        La regla de cierre está en definición con la planta y el área legal. La pantalla la mostrará
        cuando exista — hoy no hay plazo que mostrar, y no se inventa uno.
      </p>
    </div>
  );
}
