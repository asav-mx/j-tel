import Link from "next/link";
import {
  loadPendientesEvidencia,
  type CasoPendiente as CasoPendienteData,
} from "@/lib/pendientes-evidencia-data";
import { UnitShell } from "@/components/unit-shell";
import { ChipResultado } from "@/components/chip-resultado";
import {
  AfirmacionPendiente,
  MedidaCobertura,
  NotaHonestaPendiente,
  rielPendiente,
} from "@/components/caso-pendiente-evidencia";
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
  if (n === 0) return "No hay servicios pendientes por evidencia.";
  if (n === 1) return "Un servicio está pendiente por evidencia.";
  return `${n} servicios están pendientes por evidencia.`;
}

export async function PendientesEvidenciaUnitView({ ctx }: { ctx: UnitPageContext }) {
  const payload = await loadPendientesEvidencia({
    scope: ctx.scope,
    accountSlug: ctx.client.slug,
  });
  const unitLabel = operationalUnitLabel(ctx.unit);
  const tz = payload.zonaHoraria;

  return (
    <UnitShell
      client={ctx.client}
      unit={ctx.unit}
      title={`Pendiente por evidencia — ${unitLabel}`}
    >
      <h1 className="mt-7 mb-2.5 max-w-[24ch] font-[family-name:var(--fuente-archivo)] text-[clamp(28px,5vw,42px)] leading-[1.02] font-bold tracking-[-0.022em]">
        {titular(payload.casos.length)}
      </h1>

      <p className="max-w-[62ch] text-[var(--tenue)]">
        El sistema no vio suficiente señal para emitir un resultado — no cuenta como
        incumplimiento, tampoco como cumplido. Por ley, sin evidencia no se declara una falta.{" "}
        <span className="font-mono text-[12px]">reloj: {tz}</span>
      </p>

      {payload.casos.length === 0 ? (
        <p className="mt-10 text-[15px] text-[var(--tenue)]">
          No hay servicios pendientes por evidencia en {unitLabel}.
        </p>
      ) : (
        <>
          {payload.casos.map((c) => (
            <Caso key={c.occurrenceId} c={c} tz={tz} slug={ctx.client.slug} />
          ))}

          <ComoSaleDeAhi />
        </>
      )}

      <div className="mt-14 border-t border-white/10 pt-5 font-mono text-[11px] leading-[1.9] text-[var(--tenue)]">
        Pendiente por evidencia · J-Telemetry — cara planta.
        <br />
        "Sin señal" es un motivo bajo pendiente, no un cuarto estado: los resultados siguen siendo
        tres.
        <br />
        El sistema no afirma lo que no midió; el pendiente es esa regla hecha visible.
      </div>
    </UnitShell>
  );
}

function Caso({ c, tz, slug }: { c: CasoPendienteData; tz: string; slug: string }) {
  const r = rielPendiente(c.hueco);

  return (
    <div className="grid grid-cols-1 gap-3 border-t border-white/10 py-6 sm:grid-cols-[118px_1fr] sm:gap-7">
      <div className="pt-0.5">
        <div
          className="font-[family-name:var(--fuente-archivo)] text-[22px] leading-none font-bold tracking-[-0.015em]"
          style={{ color: r.color }}
        >
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
          <AfirmacionPendiente hueco={c.hueco} tz={tz} />
        </h3>

        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1.5 border border-white/10 bg-[var(--panel)] px-3.5 py-2.5 font-mono text-[12px] text-[var(--tenue)]">
          <MedidaCobertura
            cobertura={c.cobertura}
            textoNoDisponible="Sin señal en la ventana — no hay cobertura que mostrar."
          />
        </div>

        <NotaHonestaPendiente />

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={withAccount(`/cliente/servicio/${c.occurrenceId}`, slug)}
            className="inline-block cursor-pointer rounded-sm border border-[var(--acero)] px-3.5 py-2 font-mono text-[11px] font-medium tracking-[0.11em] text-[var(--acero)] uppercase transition-colors hover:bg-white/5"
          >
            Abrir el expediente
          </Link>
          <HistoriaDelSello historia={c.historiaSello} timeZone={tz} />
        </div>
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
    <div className="mt-10 border border-white/10 border-l-2 border-l-[var(--ambar)] bg-[var(--panel)] px-5 py-[18px]">
      <p className="mb-3 font-[family-name:var(--fuente-archivo)] text-[16px] font-semibold">
        Cómo sale de ahí — el pendiente no es para siempre
      </p>

      <div className="grid gap-px overflow-hidden border border-white/10 bg-white/10">
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

      <p className="mt-3.5 border-t border-white/10 pt-3 font-mono text-[11px] leading-[1.6] text-[var(--azul)]">
        La regla de cierre está en definición con la planta y el área legal. La pantalla la mostrará
        cuando exista — hoy no hay plazo que mostrar, y no se inventa uno.
      </p>
    </div>
  );
}
