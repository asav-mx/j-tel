"use client";

type Option = { value: string; label: string };

type FilterState = {
  baseHref: string;
  fecha?: string;
  estado?: string;
  turno?: string | null;
};

function buildComplianceHref(
  state: FilterState,
  perfil: string | null,
): string {
  const url = new URL(state.baseHref, "http://local");
  if (state.fecha && state.fecha !== "hoy_ayer") url.searchParams.set("fecha", state.fecha);
  if (state.estado && state.estado !== "all") url.searchParams.set("estado", state.estado);
  if (state.turno) url.searchParams.set("turno", state.turno);
  if (perfil) url.searchParams.set("perfil", perfil);
  return `${url.pathname}${url.search}`;
}

export function ComplianceSelectFilter({
  label,
  name,
  value,
  options,
  allLabel,
  filterState,
}: {
  label: string;
  name: string;
  value: string | null;
  options: Option[];
  allLabel: string;
  filterState: FilterState;
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2 text-sm sm:max-w-md">
      <span className="shrink-0 text-[var(--muted)]">{label}:</span>
      <select
        name={name}
        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-sm"
        value={value ?? ""}
        onChange={(e) => {
          const next = e.target.value || null;
          window.location.assign(buildComplianceHref(filterState, next));
        }}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
