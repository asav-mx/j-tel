"use client";

import { useMemo, useState } from "react";
import { localDateIso, JTTEL_TZ } from "@/lib/local-time";
import type { PlanDeReselloEnPantalla } from "@/lib/plan-resello";
import { confirmaFrase, reselloPorDias, type ResultadoDeDia } from "@/lib/resello-pantalla";

type ContractOption = {
  id: string;
  label: string;
};

const inputClass =
  "mt-1 w-full rounded border border-[var(--linea)] bg-black/20 p-2 text-sm";

const ETIQUETA: Record<string, string> = {
  cumplido: "cumplido",
  no_cumplido: "no cumplido",
  pendiente_evidencia: "pendiente",
};

function hora(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: JTTEL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function sellado(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: JTTEL_TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/**
 * Re-sellar resultados de un contrato: primero la lista, luego el sí.
 *
 * **Re-sellar re-emite el juicio sobre jornadas que un cliente ya recibió**, y
 * el Marco dice que el hecho no se reescribe nunca. Hasta el 15 de septiembre
 * de 2026 esta pantalla lo hacía con una casilla de «entiendo» y un
 * `window.confirm` genérico, sin decir cuáles ni cuántos, sobre hasta 31 días
 * de un jalón. La aprieta cualquiera con acceso a J-Staff.
 *
 * Ahora:
 *   1. Se pide la lista: cada servicio de cada día, con su veredicto de hoy.
 *   2. Se enseña la cifra —cuántos veredictos ya entregados se reescriben— y
 *      para seguir hay que teclear `RESELLAR <cifra>`. Una casilla se marca
 *      sin leer; la cifra no se teclea sin haberla visto.
 *   3. Cada día viaja con sus ids. Si un día cambió desde la lista, el motor no
 *      lo re-sella y la corrida se detiene ahí.
 *   4. Al terminar dice qué cambió, servicio por servicio.
 */
export function ReverifyRangeForm({ contracts }: { contracts: ContractOption[] }) {
  const today = useMemo(() => localDateIso(new Date(), JTTEL_TZ), []);

  const [contractId, setContractId] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reingest, setReingest] = useState(false);

  const [plan, setPlan] = useState<PlanDeReselloEnPantalla | null>(null);
  const [cargando, setCargando] = useState(false);
  const [tecleado, setTecleado] = useState("");
  const [corriendo, setCorriendo] = useState(false);
  const [avance, setAvance] = useState<{ hechos: number; total: number; dia: string } | null>(null);
  const [resultado, setResultado] = useState<{ dias: ResultadoDeDia[]; detenido: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cambiar lo que se pidió invalida la lista: lo autorizado tiene que ser lo que se ve.
  function olvidarPlan() {
    setPlan(null);
    setTecleado("");
    setResultado(null);
    setError(null);
  }

  async function pedirLista() {
    olvidarPlan();
    setCargando(true);
    try {
      const res = await fetch("/api/jstaff/reverify-day/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ contractId, desde: fromDate, hasta: toDate }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; plan: PlanDeReselloEnPantalla }
        | { ok: false; error: string }
        | null;
      if (!res.ok || !data || !data.ok) {
        setError((data && "error" in data && data.error) || `HTTP ${res.status}`);
      } else {
        setPlan(data.plan);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setCargando(false);
    }
  }

  async function resellar() {
    if (!plan || !confirmaFrase(tecleado, plan.frase)) return;
    setCorriendo(true);
    setResultado(null);
    const r = await reselloPorDias({
      plan,
      tecleado,
      keepEvidence: !reingest,
      alAvanzar: (hechos, total, dia) => setAvance({ hechos, total, dia }),
      enviar: async (cuerpo) => {
        const res = await fetch("/api/jstaff/reverify-day", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(cuerpo),
        });
        return { status: res.status, json: await res.json().catch(() => null) };
      },
    });
    setResultado(r);
    setCorriendo(false);
  }

  const antes = useMemo(() => {
    const m = new Map<string, { perfil: string; veredicto: string | null; dia: string }>();
    for (const d of plan?.dias ?? []) {
      for (const s of d.servicios) m.set(s.occurrenceId, { perfil: s.perfil, veredicto: s.veredicto, dia: d.dia });
    }
    return m;
  }, [plan]);

  const puedePedir = Boolean(contractId && fromDate && toDate && !cargando && !corriendo);
  const confirmado = plan ? confirmaFrase(tecleado, plan.frase) : false;
  const r = plan?.resumen;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm md:col-span-2">
          Contrato
          <select
            required
            className={inputClass}
            value={contractId}
            disabled={corriendo}
            onChange={(e) => {
              setContractId(e.target.value);
              olvidarPlan();
            }}
          >
            <option value="" disabled>
              Elige contrato…
            </option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Desde
          <input
            type="date"
            className={inputClass}
            value={fromDate}
            disabled={corriendo}
            onChange={(e) => {
              setFromDate(e.target.value);
              olvidarPlan();
            }}
          />
        </label>
        <label className="block text-sm">
          Hasta (igual a «desde» para un solo día)
          <input
            type="date"
            className={inputClass}
            value={toDate}
            disabled={corriendo}
            onChange={(e) => {
              setToDate(e.target.value);
              olvidarPlan();
            }}
          />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={reingest}
          disabled={corriendo}
          onChange={(e) => {
            setReingest(e.target.checked);
            setTecleado("");
          }}
        />
        <span>
          Re-ingerir la evidencia desde la telemetría archivada (más lento). Déjalo apagado si solo
          cambiaste la geocerca: se reusa la evidencia ya guardada.
        </span>
      </label>

      <button
        type="button"
        disabled={!puedePedir}
        onClick={() => void pedirLista()}
        className="rounded-lg border border-[var(--linea)] px-4 py-2 text-sm font-medium hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {cargando ? "Leyendo…" : "1 · Ver qué se re-sellaría"}
      </button>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {plan && r ? (
        <div className="space-y-3 rounded-lg border border-[var(--linea)] p-3 text-sm">
          {plan.dias.length === 0 ? (
            <p className="text-[var(--muted)]">
              No hay servicios con viaje en ese rango. Nada que re-sellar.
            </p>
          ) : (
            <>
              <p>
                Esto <strong>re-emite el juicio de {r.yaSellados} veredictos ya entregados</strong> a{" "}
                <strong>{plan.contrato.cliente}</strong> — {plan.contrato.nombre} · {plan.contrato.planta} —
                en {r.dias} {r.dias === 1 ? "día" : "días"}: {r.porVeredicto.cumplido} cumplido ·{" "}
                {r.porVeredicto.no_cumplido} no cumplido · {r.porVeredicto.pendiente_evidencia} pendiente.
                {r.sinHecho > 0 ? ` ${r.sinHecho} servicios sin hecho se sellarían por primera vez.` : ""}
              </p>
              <p className="text-xs text-[var(--muted)]">
                Modo: {reingest ? "re-ingerir evidencia" : "reusar evidencia guardada"} · geocerca y
                política actuales · unidades exclusivas. Quien confirme queda registrado en el ledger.
              </p>

              <div className="max-h-80 space-y-1 overflow-y-auto">
                {plan.dias.map((d) => (
                  <details key={d.dia} className="rounded border border-[var(--linea-tenue)] px-2 py-1">
                    <summary className="cursor-pointer">
                      {d.dia} · {d.servicios.length} {d.servicios.length === 1 ? "servicio" : "servicios"} ·{" "}
                      {d.yaSellados} {d.yaSellados === 1 ? "ya sellado" : "ya sellados"}
                    </summary>
                    <div className="overflow-x-auto">
                      <table className="mt-1 w-full text-xs">
                        <thead>
                          <tr className="text-left text-[var(--muted)]">
                            <th className="pr-3 font-normal">límite</th>
                            <th className="pr-3 font-normal">perfil</th>
                            <th className="pr-3 font-normal">veredicto hoy</th>
                            <th className="font-normal">sellado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.servicios.map((s) => (
                            <tr key={s.occurrenceId}>
                              <td className="pr-3 font-mono">{hora(s.horaLimite)}</td>
                              <td className="pr-3 font-mono">{s.perfil}</td>
                              <td className="pr-3">{s.veredicto ? ETIQUETA[s.veredicto] : "sin hecho"}</td>
                              <td className="text-[var(--muted)]">{sellado(s.selladoEn)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))}
              </div>

              {!resultado ? (
                <>
                  <label className="block text-sm">
                    Para re-sellar, escribe exactamente{" "}
                    <span className="font-mono text-[var(--texto)]">{plan.frase}</span>
                    <input
                      className={`${inputClass} font-mono`}
                      value={tecleado}
                      disabled={corriendo}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(e) => setTecleado(e.target.value)}
                      onPaste={(e) => e.preventDefault()}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!confirmado || corriendo}
                      onClick={() => void resellar()}
                      className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {corriendo && avance
                        ? `Re-sellando… ${avance.hechos}/${avance.total}`
                        : `2 · Re-sellar ${r.yaSellados} veredictos`}
                    </button>
                    <button
                      type="button"
                      disabled={corriendo}
                      onClick={olvidarPlan}
                      className="rounded-lg border border-[var(--linea)] px-4 py-2 text-sm hover:bg-[var(--hover)] disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                  </div>
                  {corriendo && avance?.dia ? (
                    <p className="text-xs text-amber-200" role="status">
                      Día {avance.dia}. No cierres la pestaña.
                    </p>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {resultado ? (
        <div className="space-y-2 rounded-lg border border-[var(--linea)] bg-black/20 p-3 text-sm">
          {(() => {
            const cambios: Array<{ dia: string; perfil: string; de: string; a: string }> = [];
            let resellados = 0;
            for (const d of resultado.dias) {
              if (!d.ok) continue;
              for (const x of d.resultados) {
                resellados += 1;
                const previo = antes.get(x.occurrenceId);
                const de = previo?.veredicto ? ETIQUETA[previo.veredicto] : "sin hecho";
                const a = x.error ? `error: ${x.error}` : x.status ? (ETIQUETA[x.status] ?? x.status) : "sin hecho";
                if (de !== a) cambios.push({ dia: d.dia, perfil: previo?.perfil ?? x.occurrenceId, de, a });
              }
            }
            const fallo = resultado.dias.find((d) => !d.ok);
            return (
              <>
                <p>
                  {resultado.detenido ? "Se detuvo. " : "Listo. "}
                  Re-sellados {resellados} servicios en {resultado.dias.filter((d) => d.ok).length} días ·{" "}
                  <strong>cambiaron {cambios.length}</strong>.
                </p>
                {fallo && !fallo.ok ? (
                  <p className="text-red-300">
                    {fallo.dia}: {fallo.error} Los días siguientes no se tocaron.
                  </p>
                ) : null}
                {cambios.length > 0 ? (
                  <ul className="max-h-60 space-y-1 overflow-y-auto text-xs">
                    {cambios.map((c) => (
                      <li key={`${c.dia}-${c.perfil}`} className="font-mono">
                        {c.dia} · {c.perfil}: {c.de} → {c.a}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
