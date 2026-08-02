import { getRepos } from "@/lib/db";
import { ConfirmForm } from "@/components/confirm-form";
import { UnitShell } from "@/components/unit-shell";
import {
  AvisoSistema,
  ChipEstado,
  Panel,
  botonPrimario,
  botonSecundario,
  campo,
  etiqueta,
} from "@/components/ui";
import { confirmMessages } from "@/lib/confirm-messages";
import type { UnitPageContext } from "@/lib/unit-context";
import {
  contractMatchesScope,
  findOperationalUnit,
  operationalUnitLabel,
} from "@/lib/operational-scope";
import { PERILLAS, ZONAS_HORARIAS } from "@/lib/perillas-contrato";
import { operationalScopeFromContract } from "@jtel/domain";
import { localDateIso } from "@/lib/local-time";

export const dynamic = "force-dynamic";

const mono = "font-[family-name:var(--fuente-mono)]";

/**
 * El estado del contrato es operativo, no un resultado: acero para el que está
 * en pie, tenue para el que todavía no. Y se dice en español — `draft` es la
 * palabra del esquema, no la que lee un coordinador de transporte.
 */
const ESTADO: Record<string, { texto: string; tono: "acero" | "tenue" }> = {
  active: { texto: "Activo", tono: "acero" },
  draft: { texto: "Borrador", tono: "tenue" },
  suspended: { texto: "Suspendido", tono: "tenue" },
};

/**
 * Las etiquetas y los defaults se leen del catálogo de perillas, nunca se
 * reescriben aquí: el Marco prohíbe hornear un umbral en un componente, y una
 * segunda copia de "60%" es exactamente la forma en que los dos números se
 * separan sin que nadie se entere.
 */
const perillaDe = (llave: string) => PERILLAS.find((p) => p.llave === llave);

function etiquetaEstrictez(valor: string): string {
  const forma = perillaDe("routeStrictness")?.forma;
  if (forma?.tipo !== "opciones") return valor;
  return forma.opciones.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

/** Las cuatro reglas que más mueven el resultado, con lo que el esquema pone. */
const DEFAULTS_AL_NACER = [
  "arrivalAnticipationMinutes",
  "toleranceMinutes",
  "evidenceMinCoveragePct",
  "evidenceMaxGapMinutes",
]
  .map(perillaDe)
  .filter((p): p is NonNullable<typeof p> => Boolean(p));

const createdLabels: Record<string, string> = {
  contrato: "Nace en borrador. Actívalo cuando esté listo.",
  activado: "El contrato quedó activo.",
  eliminado: "Se eliminó el borrador.",
  vigencia: "Se actualizó la vigencia.",
  politica:
    "Aplica solo a servicios futuros. Los hechos ya sellados conservan la política que estaba vigente.",
};

function contractScopeLabel(
  c: { plantId?: string | null; plantGroupId?: string | null },
  units: Awaited<ReturnType<ReturnType<typeof getRepos>["clients"]["getOperationalUnits"]>>,
): string {
  const scope = operationalScopeFromContract(c);
  if (!scope) return "—";
  const unit = findOperationalUnit(units, scope);
  if (!unit) return "—";
  return unit.kind === "plant_group" ? `Campus: ${operationalUnitLabel(unit)}` : operationalUnitLabel(unit);
}

export async function ContratosUnitView({
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

  const [authorizedCarriers, operationalUnits, contracts] = await Promise.all([
    repos.commercial.getAuthorizedCarriersForClient(client.id),
    repos.clients.getOperationalUnits(client.id),
    repos.contracts.findForClient(client.id),
  ]);

  const activeUnit = unit;
  const scopedContracts = contracts.filter((c) => contractMatchesScope(c, scope));

  const scopeHidden =
    scope.kind === "plant" ? (
      <input type="hidden" name="plantId" value={scope.plantId} />
    ) : (
      <input type="hidden" name="plantGroupId" value={scope.plantGroupId} />
    );

  const openByCarrier = new Map(
    scopedContracts
      .filter((c) => c.status !== "suspended")
      .map((c) => [c.carrierAccountId, c] as const),
  );
  const allCarriersHaveOpenContract =
    authorizedCarriers.length > 0 &&
    authorizedCarriers.every((c) => openByCarrier.has(c.id));

  const todayIso = localDateIso();
  const yearAhead = new Date();
  yearAhead.setFullYear(yearAhead.getFullYear() + 1);
  const yearAheadIso = localDateIso(yearAhead);

  return (
    <UnitShell
      client={client}
      unit={unit}
      title={`Contratos — ${operationalUnitLabel(unit)}`}
    >
      <p className="max-w-[76ch] text-[13.5px] text-[var(--tenue)]">
        El contrato es el acuerdo con el que se juzga a{" "}
        <span className="text-[var(--texto)]">{operationalUnitLabel(unit)}</span>: de él salen la
        hora límite, la ventana que se observa y cuánta señal hace falta para poder dictar un
        resultado. Las dos partes lo ven igual.
      </p>

      {error ? <AvisoSistema lead="No se guardó.">{error}</AvisoSistema> : null}
      {created ? (
        <AvisoSistema lead="Guardado.">{createdLabels[created] ?? null}</AvisoSistema>
      ) : null}

      {authorizedCarriers.length === 0 ? (
        <Panel titulo="Sin transportistas autorizados">
          <p className="max-w-[70ch] text-[13.5px] text-[var(--tenue)]">
            Este cliente todavía no tiene transportistas autorizados por J-Staff. Pide que
            autoricen al correcto antes de crear el contrato.
          </p>
        </Panel>
      ) : allCarriersHaveOpenContract ? (
        <Panel titulo={`Ya hay contrato — ${operationalUnitLabel(activeUnit)}`}>
          <p className="max-w-[70ch] text-[13.5px] text-[var(--tenue)]">
            {scopedContracts.some((c) => c.status === "draft")
              ? "Cada transportista autorizado ya tiene un contrato en borrador o activo en este sitio. Activa el borrador que vayas a usar, o elimina el que sobre."
              : "Cada transportista autorizado ya tiene contrato en este sitio. Para los servicios usa el contrato activo de la lista."}
          </p>
        </Panel>
      ) : (
        <Panel
          titulo={`Nuevo contrato — ${operationalUnitLabel(activeUnit)}`}
          nota="Solo puede existir un contrato —borrador o activo— por transportista y sitio."
        >
          <ConfirmForm
            action="/api/cliente/contratos"
            method="post"
            className="space-y-5"
            confirmMessage={confirmMessages.createContract(operationalUnitLabel(activeUnit))}
          >
            <input type="hidden" name="clientSlug" value={client.slug} />
            <input type="hidden" name="action" value="create" />
            {scopeHidden}

            <div className="grid gap-4 md:grid-cols-2">
              <label className={etiqueta}>
                Nombre del contrato
                <input name="name" required className={campo} placeholder="Ej. Transporte Personal 2026" />
              </label>
              <label className={etiqueta}>
                Transportista autorizado
                <select name="carrierAccountId" required className={campo} defaultValue="">
                  <option value="" disabled>
                    Elige transportista…
                  </option>
                  {authorizedCarriers.map((c) => {
                    const taken = openByCarrier.has(c.id);
                    return (
                      <option key={c.id} value={c.id} disabled={taken}>
                        {c.name}
                        {taken ? " (ya tiene contrato)" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className={etiqueta}>
                Vigencia desde
                <input
                  name="validFrom"
                  type="date"
                  required
                  defaultValue={todayIso}
                  className={campo}
                />
              </label>
              <label className={etiqueta}>
                Vigencia hasta
                <input
                  name="validTo"
                  type="date"
                  required
                  defaultValue={yearAheadIso}
                  className={campo}
                />
                <span className="mt-1.5 block text-[12px] text-[var(--tenue)]">
                  Ningún servicio puede generarse fuera de este rango.
                </span>
              </label>
              <label className={` md:col-span-2 md:max-w-sm`}>
                {perillaDe("timeZone")?.nombre ?? "El reloj de este contrato"}
                <select
                  name="timeZone"
                  className={campo}
                  defaultValue={ZONAS_HORARIAS[0]?.valor}
                >
                  {ZONAS_HORARIAS.map((z) => (
                    <option key={z.valor} value={z.valor}>
                      {z.etiqueta}
                    </option>
                  ))}
                </select>
                <span className="mt-1.5 block max-w-[62ch] text-[12px] text-[var(--tenue)]">
                  Con este reloj se convierte la hora del turno en un instante real. Una zona
                  equivocada corre la hora límite horas enteras sin que nada se vea roto.
                </span>
              </label>
            </div>

            {/*
             * El alta no pide dieciocho decisiones antes de que el contrato
             * exista: nace con lo que pone el esquema y se dice exactamente
             * qué es, porque un número que gobierna el resultado no puede
             * entrar en silencio.
             */}
            <div className="border-t border-[var(--linea)] pt-4">
              <p className="text-[12.5px] text-[var(--tenue)]">
                Nace con la política por defecto del sistema:
              </p>
              <dl className="mt-2.5 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {DEFAULTS_AL_NACER.map((p) => (
                  <div key={p.llave} className="flex items-baseline justify-between gap-3">
                    <dt className="text-[12.5px] text-[var(--tenue)]">{p.nombre}</dt>
                    <dd className={`shrink-0 text-[12.5px] text-[var(--acero)] ${mono}`}>
                      {p.porDefecto}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 max-w-[70ch] text-[12.5px] text-[var(--tenue)]">
                Cada una se ajusta después en la oficina del contrato, donde viene explicada, con
                su consecuencia y medida contra tu operación real.
              </p>
            </div>

            <button type="submit" className={botonPrimario}>
              Crear contrato
            </button>
          </ConfirmForm>
        </Panel>
      )}

      <Panel
        titulo={`Contratos — ${operationalUnitLabel(activeUnit)} (${scopedContracts.length})`}
      >
        {scopedContracts.length === 0 ? (
          <p className="text-[13.5px] text-[var(--tenue)]">Sin contratos para este sitio.</p>
        ) : (
          <ul className="space-y-3">
            {scopedContracts.map((c) => {
              const estado = ESTADO[c.status] ?? { texto: c.status, tono: "tenue" as const };
              const anticipacion = c.policy.arrivalAnticipationMinutes ?? 15;
              return (
                <li
                  key={c.id}
                  className="space-y-3 rounded border border-[var(--linea-tenue)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2.5">
                        <span className="text-[15px] font-medium text-[var(--texto)]">{c.name}</span>
                        <ChipEstado tono={estado.tono}>{estado.texto}</ChipEstado>
                      </p>
                      <p className="mt-1 text-[12.5px] text-[var(--tenue)]">
                        {c.carrier?.name ?? "—"} · {contractScopeLabel(c, operationalUnits)} ·{" "}
                        {c.profiles.length} servicio{c.profiles.length === 1 ? "" : "s"}
                      </p>
                      <dl
                        className={`mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-[12px] ${mono} text-[var(--tenue)]`}
                      >
                        <div>
                          <dt className="inline">Vigencia </dt>
                          <dd className="inline text-[var(--acero)]">
                            {c.validFrom} → {c.validTo}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline">Hora límite </dt>
                          <dd className="inline text-[var(--acero)]">
                            {anticipacion} min antes del turno
                          </dd>
                        </div>
                        <div>
                          <dt className="inline">Se perdonan </dt>
                          <dd className="inline text-[var(--acero)]">
                            {c.policy.toleranceMinutes} min de retraso
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-1 text-[12px] text-[var(--tenue)]">
                        Del recorrido: {etiquetaEstrictez(c.policy.routeStrictness)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {c.status !== "active" ? (
                        <ConfirmForm
                          action="/api/cliente/contratos"
                          method="post"
                          confirmMessage={confirmMessages.activateContract(c.name)}
                        >
                          <input type="hidden" name="clientSlug" value={client.slug} />
                          <input type="hidden" name="action" value="activate" />
                          <input type="hidden" name="contractId" value={c.id} />
                          <button type="submit" className={botonSecundario}>
                            Activar
                          </button>
                        </ConfirmForm>
                      ) : null}
                      {c.status === "draft" && c.profiles.length === 0 ? (
                        <ConfirmForm
                          action="/api/cliente/contratos"
                          method="post"
                          confirmMessage={confirmMessages.deleteContractDraft(c.name)}
                        >
                          <input type="hidden" name="clientSlug" value={client.slug} />
                          <input type="hidden" name="action" value="delete" />
                          <input type="hidden" name="contractId" value={c.id} />
                          {/*
                           * Sin rojo: el rojo dice `no cumplido` y nada más. Que
                           * la acción borra lo dice la palabra y lo confirma el
                           * diálogo, no el color.
                           */}
                          <button type="submit" className={botonSecundario}>
                            Eliminar borrador
                          </button>
                        </ConfirmForm>
                      ) : null}
                    </div>
                  </div>

                  <ConfirmForm
                    action="/api/cliente/contratos"
                    method="post"
                    className="flex flex-wrap items-end gap-3 border-t border-[var(--linea-tenue)] pt-3"
                    confirmMessage={`¿Actualizar vigencia de «${c.name}»?`}
                  >
                    <input type="hidden" name="clientSlug" value={client.slug} />
                    <input type="hidden" name="action" value="updateValidity" />
                    <input type="hidden" name="contractId" value={c.id} />
                    <label className="text-[12px] text-[var(--tenue)]">
                      Desde
                      <input
                        name="validFrom"
                        type="date"
                        required
                        defaultValue={c.validFrom}
                        className={campo}
                      />
                    </label>
                    <label className="text-[12px] text-[var(--tenue)]">
                      Hasta
                      <input
                        name="validTo"
                        type="date"
                        required
                        defaultValue={c.validTo}
                        className={campo}
                      />
                    </label>
                    <button type="submit" className={botonSecundario}>
                      Guardar vigencia
                    </button>
                  </ConfirmForm>

                  {/*
                   * El único camino a la política. Antes había además un editor
                   * "en crudo" aquí mismo, con los nombres del motor —"Umbral
                   * match KML — métrica A", "Estrictez de ruta"— que el skill
                   * saca de la cara del cliente. Dos editores de la misma
                   * política terminan contradiciéndose; queda el que explica.
                   */}
                  <p className="border-t border-[var(--linea-tenue)] pt-3 text-[13.5px]">
                    <a
                      href={`/cliente/contrato/${c.id}?account=${encodeURIComponent(client.slug)}`}
                      className="text-[var(--azul)] hover:underline"
                    >
                      Abrir la oficina del contrato →
                    </a>
                    <span className="ml-2 text-[12.5px] text-[var(--tenue)]">
                      con qué reglas se juzga: cada una explicada y medida contra tu operación
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </UnitShell>
  );
}
