"use client";

import { useMemo, useState } from "react";
import { localDateIso, JTTEL_TZ } from "@/lib/local-time";

type ContractOption = {
  id: string;
  label: string;
};

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm";

const MAX_DAYS = 31;

function eachIsoDay(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${fromIso}T12:00:00.000Z`);
  const end = new Date(`${toIso}T12:00:00.000Z`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || cur > end) {
    return out;
  }
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

type DayResult = {
  day: string;
  ok: boolean;
  n?: number;
  summary?: string;
  error?: string;
};

/**
 * Re-verifica un rango día por día (evita timeout de Vercel).
 * Por defecto reusa evidencia GPS ya guardada y aplica geocerca/política actual.
 */
export function ReverifyRangeForm({ contracts }: { contracts: ContractOption[] }) {
  // Vista multi-contrato (el usuario elige contrato) → zona del despliegue.
  const today = useMemo(() => localDateIso(new Date(), JTTEL_TZ), []);
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 13);
    return localDateIso(d, JTTEL_TZ);
  }, []);

  const [contractId, setContractId] = useState("");
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(today);
  const [reingest, setReingest] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string }>({
    done: 0,
    total: 0,
  });
  const [results, setResults] = useState<DayResult[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);

  const days = useMemo(() => eachIsoDay(fromDate, toDate), [fromDate, toDate]);
  const daysOk = days.length > 0 && days.length <= MAX_DAYS;
  const selected = contracts.find((c) => c.id === contractId) ?? null;
  const canRun = Boolean(selected && understood && daysOk && !running);

  async function run() {
    if (!canRun || !selected) return;
    const ok = window.confirm(
      `¿Re-verificar ${days.length} día(s) de «${selected.label}»?\n` +
        `${fromDate} → ${toDate}\n\n` +
        `Se sobrescriben cumplido / no cumplido.\n` +
        (reingest
          ? "Modo: re-ingerir GPS (más lento)."
          : "Modo: reusar evidencia ya guardada + geocerca actual (recomendado)."),
    );
    if (!ok) return;

    setRunning(true);
    setFatal(null);
    setResults([]);
    setProgress({ done: 0, total: days.length, current: days[0] });

    const collected: DayResult[] = [];
    for (let i = 0; i < days.length; i++) {
      const day = days[i]!;
      setProgress({ done: i, total: days.length, current: day });
      const body = new FormData();
      body.set("contractId", contractId);
      body.set("serviceDate", day);
      body.set("keepEvidence", reingest ? "0" : "1");
      body.set("format", "json");
      try {
        const res = await fetch("/api/jstaff/reverify-day", {
          method: "POST",
          body,
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          n?: number;
          summary?: string;
        } | null;
        if (!res.ok || !data?.ok) {
          collected.push({
            day,
            ok: false,
            error: data?.error ?? `HTTP ${res.status}`,
          });
        } else {
          collected.push({
            day,
            ok: true,
            n: data.n,
            summary: data.summary,
          });
        }
      } catch (err) {
        collected.push({
          day,
          ok: false,
          error: err instanceof Error ? err.message : "Error de red",
        });
      }
      setResults([...collected]);
    }

    setProgress({ done: days.length, total: days.length });
    setRunning(false);
  }

  const okDays = results.filter((r) => r.ok).length;
  const failDays = results.filter((r) => !r.ok).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm md:col-span-2">
          Contrato
          <select
            required
            className={inputClass}
            value={contractId}
            disabled={running}
            onChange={(e) => setContractId(e.target.value)}
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
            disabled={running}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Hasta
          <input
            type="date"
            className={inputClass}
            value={toDate}
            disabled={running}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
      </div>

      {days.length > MAX_DAYS ? (
        <p className="text-xs text-red-300">
          Máximo {MAX_DAYS} días por corrida (ahora {days.length}). Acorta el rango.
        </p>
      ) : days.length > 0 ? (
        <p className="text-xs text-[var(--muted)]">{days.length} día(s) a re-verificar.</p>
      ) : (
        <p className="text-xs text-red-300">Rango de fechas inválido.</p>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={understood}
          disabled={running}
          onChange={(e) => setUnderstood(e.target.checked)}
        />
        <span>
          Entiendo que se <span className="text-white">sobrescriben</span> los resultados
          (cumplido / no cumplido) de esas fechas.
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={reingest}
          disabled={running}
          onChange={(e) => setReingest(e.target.checked)}
        />
        <span>
          Re-ingerir GPS desde memoria/Umbrella (más lento; solo si falta evidencia). Déjalo
          apagado si solo cambiaste la geocerca.
        </span>
      </label>

      <button
        type="button"
        disabled={!canRun}
        onClick={() => void run()}
        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {running
          ? `Re-verificando… ${progress.done}/${progress.total}`
          : "Re-verificar rango"}
      </button>

      {running ? (
        <p className="text-xs text-amber-200" role="status">
          Día actual: {progress.current}. No cierres la pestaña.
        </p>
      ) : null}

      {fatal ? <p className="text-sm text-red-300">{fatal}</p> : null}

      {results.length > 0 ? (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
          <p className="text-emerald-200">
            Listo: {okDays} ok · {failDays} con error
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-[var(--muted)]">
            {results.map((r) => (
              <li key={r.day}>
                {r.day}:{" "}
                {r.ok ? (
                  <span className="text-emerald-200">
                    {r.n ?? 0} svc · {r.summary || "ok"}
                  </span>
                ) : (
                  <span className="text-red-300">{r.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
