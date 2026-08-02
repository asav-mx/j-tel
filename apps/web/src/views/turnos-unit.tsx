import Link from "next/link";
import { getRepos } from "@/lib/db";
import { ConfirmForm } from "@/components/confirm-form";
import { UnitShell } from "@/components/unit-shell";
import {
  AvisoSistema,
  Panel,
  botonPrimario,
  botonSecundario,
  campo,
  etiqueta,
} from "@/components/ui";
import { confirmMessages } from "@/lib/confirm-messages";
import { unitConfigStepHrefFor } from "@/lib/config-wizard";
import type { UnitPageContext } from "@/lib/unit-context";
import {
  contractMatchesScope,
  operationalUnitLabel,
} from "@/lib/operational-scope";

export const dynamic = "force-dynamic";

const mono = "font-[family-name:var(--fuente-mono)]";

const createdLabels: Record<string, string> = {
  turno: "El turno quedó registrado. Ya puedes trazarle rutas.",
  turno_actualizado: "Se actualizó el turno.",
  turno_eliminado: "Se eliminó el turno.",
};

function fmtTime(t: string) {
  return t.slice(0, 5);
}

/** Resta minutos a un "HH:MM" y devuelve "HH:MM". El día no importa: solo la hora. */
function restarMinutos(hhmm: string, minutos: number): string {
  const [h = 0, m = 0] = fmtTime(hhmm).split(":").map(Number);
  const total = ((h * 60 + m - minutos) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export async function TurnosUnitView({
  ctx,
  searchParams,
}: {
  ctx: UnitPageContext;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const created = typeof sp?.created === "string" ? sp.created : null;
  const { client, unit, scope } = ctx;

  const repos = getRepos();

  const [shifts, contracts] = await Promise.all([
    repos.routes.getShiftsForScope(scope),
    repos.contracts.findForClient(client.id).then((all) =>
      all.filter((c) => contractMatchesScope(c, scope)),
    ),
  ]);

  /*
   * De dónde sale la anticipación importa tanto como su valor.
   *
   * Antes esta pantalla decía "15 min por defecto" incluso cuando el número
   * venía de la política de un contrato real: valor correcto, afirmación falsa.
   * Un coordinador que lee "por defecto" entiende que puede ignorarlo, cuando
   * en realidad es la regla con la que ya se le está juzgando. Se declara la
   * procedencia, y solo se dice "por defecto" cuando de verdad no hay contrato.
   */
  const contratoDeReferencia =
    contracts.find((c) => c.status === "active") ?? contracts[0] ?? null;
  const anticipation = contratoDeReferencia?.policy.arrivalAnticipationMinutes ?? 15;
  const anticipacionAcordada = Boolean(contratoDeReferencia);

  const scopeHidden =
    scope.kind === "plant" ? (
      <input type="hidden" name="plantId" value={scope.plantId} />
    ) : (
      <input type="hidden" name="plantGroupId" value={scope.plantGroupId} />
    );

  const rutasHref = unitConfigStepHrefFor(unit, client.slug, "rutas");

  return (
    <UnitShell
      client={client}
      unit={unit}
      title={`Turnos — ${operationalUnitLabel(unit)}`}
      step="turnos"
    >
      <p className="max-w-[76ch] text-[13.5px] text-[var(--tenue)]">
        El turno es la hora a la que entra el personal en{" "}
        <span className="text-[var(--texto)]">{operationalUnitLabel(unit)}</span>. De esa hora sale
        la hora límite de llegada, y contra ella se juzga cada servicio.
      </p>

      {error ? <AvisoSistema lead="No se guardó.">{error}</AvisoSistema> : null}
      {created ? (
        <AvisoSistema lead="Guardado.">{createdLabels[created] ?? null}</AvisoSistema>
      ) : null}

      <Panel
        titulo="Registrar turno"
        nota="Lo que se debe cumplir es el turno junto con su trazado: el mismo recorrido a dos horas distintas son dos rutas distintas."
      >
        <form action="/api/cliente/turnos" method="post" className="space-y-4">
          <input type="hidden" name="clientSlug" value={client.slug} />
          {scopeHidden}
          <input type="hidden" name="action" value="shift" />
          <div className="grid gap-4 md:grid-cols-2">
            <label className={etiqueta}>
              Nombre del turno
              <input name="name" required className={campo} placeholder="Ej. Entrada 7:00" />
            </label>
            <label className={etiqueta}>
              Hora a la que entra el personal
              <input name="startTime" required type="time" className={campo} defaultValue="07:00" />
            </label>
          </div>
          {/*
           * El número nunca va solo: junto a la anticipación va la hora límite
           * que produce, calculada con la hora que el campo trae puesta.
           */}
          <p className="max-w-[70ch] text-[12.5px] text-[var(--tenue)]">
            La hora límite de llegada a la geocerca se calcula restando{" "}
            <span className={`text-[var(--acero)] ${mono}`}>{anticipation} min</span> a la hora de
            entrada
            {anticipacionAcordada ? (
              <>
                {" "}
                — lo que dice el contrato{" "}
                <span className="text-[var(--texto)]">{contratoDeReferencia?.name}</span>. Un turno
                de <span className={`text-[var(--acero)] ${mono}`}>07:00</span> tiene hora límite{" "}
                <span className={`text-[var(--acero)] ${mono}`}>
                  {restarMinutos("07:00", anticipation)}
                </span>
                .
              </>
            ) : (
              <>
                {" "}
                mientras no haya contrato en esta unidad. En cuanto exista, manda el suyo.
              </>
            )}
          </p>
          <button type="submit" className={botonPrimario}>
            Registrar turno
          </button>
        </form>
      </Panel>

      <Panel titulo={`Turnos registrados — ${operationalUnitLabel(unit)} (${shifts.length})`}>
        {shifts.length > 0 ? (
          <ul className="space-y-3">
            {shifts.map((s) => (
              <li key={s.id} className="rounded border border-[var(--linea-tenue)] p-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                  <span className="text-[15px] font-medium text-[var(--texto)]">{s.name}</span>
                  <span className={`text-[12px] ${mono} text-[var(--tenue)]`}>
                    entra{" "}
                    <span className="text-[var(--acero)]">{fmtTime(s.startTime)}</span> · hora
                    límite{" "}
                    <span className="text-[var(--acero)]">
                      {restarMinutos(s.startTime, anticipation)}
                    </span>
                  </span>
                </div>
                <ConfirmForm
                  action="/api/cliente/turnos"
                  method="post"
                  confirmMessage={confirmMessages.updateShift(s.name)}
                  className="grid gap-4 md:grid-cols-2"
                >
                  <input type="hidden" name="clientSlug" value={client.slug} />
                  {scopeHidden}
                  <input type="hidden" name="action" value="updateShift" />
                  <input type="hidden" name="shiftId" value={s.id} />
                  <label className={etiqueta}>
                    Nombre del turno
                    <input name="name" required className={campo} defaultValue={s.name} />
                  </label>
                  <label className={etiqueta}>
                    Hora a la que entra el personal
                    <input
                      name="startTime"
                      required
                      type="time"
                      className={campo}
                      defaultValue={fmtTime(s.startTime)}
                    />
                  </label>
                  <div className="md:col-span-2">
                    <button type="submit" className={botonPrimario}>
                      Guardar cambios
                    </button>
                  </div>
                </ConfirmForm>
                <div className="mt-3 border-t border-[var(--linea-tenue)] pt-3">
                  <ConfirmForm
                    action="/api/cliente/turnos"
                    method="post"
                    confirmMessage={confirmMessages.deleteShift(s.name, fmtTime(s.startTime))}
                    className="inline"
                  >
                    <input type="hidden" name="clientSlug" value={client.slug} />
                    {scopeHidden}
                    <input type="hidden" name="action" value="deleteShift" />
                    <input type="hidden" name="shiftId" value={s.id} />
                    <button type="submit" className={botonSecundario}>
                      Eliminar turno
                    </button>
                  </ConfirmForm>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-[var(--tenue)]">
            Sin turnos todavía. Registra al menos uno antes de trazar rutas.
          </p>
        )}
        {shifts.length > 0 ? (
          <p className="mt-4 text-[13px]">
            <Link href={rutasHref} className="text-[var(--azul)]">
              Siguiente: trazar rutas →
            </Link>
          </p>
        ) : null}
      </Panel>
    </UnitShell>
  );
}
