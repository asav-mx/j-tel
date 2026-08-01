import {
  addDaysIso,
  todayIso,
  type DateRange,
} from "@/lib/date-range";

type Hidden = Record<string, string | undefined | null>;

const inputClass =
  "rounded-lg border border-[var(--linea)] bg-black/30 px-3 py-1.5 text-sm text-[var(--texto)] [color-scheme:dark]";

function chipClass(active: boolean): string {
  return active
    ? "rounded-full bg-[var(--accent)] px-3 py-1 text-sm text-black"
    : "rounded-full border border-[var(--linea)] px-3 py-1 text-sm hover:border-[var(--accent)]";
}

function buildHref(
  action: string,
  hidden: Hidden,
  desde: string,
  hasta: string,
): string {
  const url = new URL(action, "http://local");
  for (const [k, v] of Object.entries(hidden)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }
  url.searchParams.set("desde", desde);
  url.searchParams.set("hasta", hasta);
  return `${url.pathname}${url.search}`;
}

/**
 * Filtro uniforme de rango: Desde / Hasta + Aplicar, con atajos opcionales.
 * Usa GET y conserva params ocultos (account, contract, vista…).
 */
export function DateRangeFilter({
  action,
  range,
  hidden = {},
  showPresets = true,
}: {
  /** Path sin query (ej. `/carrier/cumplimiento`). */
  action: string;
  range: DateRange;
  /** Params a conservar (account, contract, vista, estado…). */
  hidden?: Hidden;
  showPresets?: boolean;
}) {
  const today = todayIso();
  const presets = [
    { label: "Hoy", from: today, to: today },
    { label: "Hoy y ayer", from: addDaysIso(today, -1), to: today },
    { label: "7 días", from: addDaysIso(today, -6), to: today },
    { label: "30 días", from: addDaysIso(today, -29), to: today },
  ];

  return (
    <div className="space-y-2">
      {showPresets ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--muted)]">Rango:</span>
          {presets.map((p) => {
            const active = range.fromIso === p.from && range.toIso === p.to;
            return (
              <a
                key={p.label}
                href={buildHref(action, hidden, p.from, p.to)}
                className={chipClass(active)}
              >
                {p.label}
              </a>
            );
          })}
        </div>
      ) : null}

      <form
        method="get"
        action={action}
        className="flex flex-wrap items-end gap-3"
      >
        {Object.entries(hidden).map(([k, v]) =>
          v != null && v !== "" ? (
            <input key={k} type="hidden" name={k} value={v} />
          ) : null,
        )}
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Desde</span>
          <input
            type="date"
            name="desde"
            required
            defaultValue={range.fromIso}
            className={`mt-1 block ${inputClass}`}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Hasta</span>
          <input
            type="date"
            name="hasta"
            required
            defaultValue={range.toIso}
            className={`mt-1 block ${inputClass}`}
          />
        </label>
        <button
          type="submit"
          className="rounded-lg border border-[var(--linea)] px-3 py-1.5 text-sm hover:border-[var(--accent)]"
        >
          Aplicar
        </button>
        <p className="pb-1 text-xs text-[var(--muted)]">{range.label}</p>
      </form>
    </div>
  );
}
