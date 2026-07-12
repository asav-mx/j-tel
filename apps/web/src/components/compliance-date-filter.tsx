"use client";

type FilterState = {
  baseHref: string;
  estado?: string;
  turno?: string | null;
  perfil?: string | null;
};

function buildHref(state: FilterState, fecha: string): string {
  const url = new URL(state.baseHref, "http://local");
  if (fecha && fecha !== "hoy_ayer") url.searchParams.set("fecha", fecha);
  if (state.estado && state.estado !== "all") url.searchParams.set("estado", state.estado);
  if (state.turno) url.searchParams.set("turno", state.turno);
  if (state.perfil) url.searchParams.set("perfil", state.perfil);
  return `${url.pathname}${url.search}`;
}

export function ComplianceDateFilter({
  value,
  filterState,
}: {
  /** ISO YYYY-MM-DD when a concrete day is selected; otherwise empty. */
  value: string | null;
  filterState: FilterState;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="shrink-0 text-[var(--muted)]">Día:</span>
      <input
        type="date"
        className="rounded-lg border border-white/10 bg-black/30 px-3 py-1 text-sm text-white [color-scheme:dark]"
        value={value ?? ""}
        onChange={(e) => {
          const next = e.target.value;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
          window.location.assign(buildHref(filterState, next));
        }}
      />
    </label>
  );
}
