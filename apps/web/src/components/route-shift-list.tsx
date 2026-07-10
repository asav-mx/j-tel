"use client";

import { useMemo, useState } from "react";
import { ConfirmForm } from "@/components/confirm-form";

export type RouteShiftRow = {
  id: string;
  routeId: string;
  routeName: string;
  shiftId: string;
  shiftName: string;
  shiftStart: string;
  kmlCount: number;
  meta: string;
  deleteMessage: string;
};

type ShiftOption = { id: string; name: string; startTime: string };

const PAGE_SIZE = 50;

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm placeholder:text-white/30";

export function RouteShiftList({
  rows,
  shifts,
  clientSlug,
  plantId,
  plantGroupId,
}: {
  rows: RouteShiftRow[];
  shifts: ShiftOption[];
  clientSlug: string;
  plantId?: string;
  plantGroupId?: string;
}) {
  const [query, setQuery] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (shiftId && r.shiftId !== shiftId) return false;
      if (!q) return true;
      const haystack = `${r.routeName} ${r.shiftName} ${r.shiftStart}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, shiftId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const countsByShift = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      m.set(r.shiftId, (m.get(r.shiftId) ?? 0) + 1);
    }
    return m;
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block text-sm md:col-span-2">
          Buscar ruta
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            className={inputClass}
            placeholder="Ej. Riveras 7"
          />
        </label>
        <label className="block text-sm">
          Turno
          <select
            value={shiftId}
            onChange={(e) => {
              setShiftId(e.target.value);
              setPage(0);
            }}
            className={inputClass}
          >
            <option value="">Todos ({rows.length})</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.startTime.slice(0, 5)} ({countsByShift.get(s.id) ?? 0})
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-[var(--muted)]">
        {filtered.length} ruta(s) mostradas
        {shiftId || query ? ` (de ${rows.length} total)` : ""}
        {filtered.length > PAGE_SIZE
          ? ` · página ${safePage + 1} de ${totalPages}`
          : ""}
      </p>

      {pageRows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Ninguna ruta coincide con el filtro.</p>
      ) : (
        <ul className="divide-y divide-white/5 rounded border border-white/5 text-sm">
          {pageRows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 hover:bg-white/[0.02]"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {r.routeName} · {r.shiftName}
                </p>
                <p className="text-xs text-[var(--muted)] truncate">{r.meta}</p>
              </div>
              <ConfirmForm
                action="/api/cliente/rutas"
                method="post"
                confirmMessage={r.deleteMessage}
              >
                <input type="hidden" name="clientSlug" value={clientSlug} />
                {plantId ? <input type="hidden" name="plantId" value={plantId} /> : null}
                {plantGroupId ? (
                  <input type="hidden" name="plantGroupId" value={plantGroupId} />
                ) : null}
                <input type="hidden" name="action" value="deleteRouteShift" />
                <input type="hidden" name="routeShiftId" value={r.id} />
                <button
                  type="submit"
                  className="rounded border border-red-500/30 px-2 py-0.5 text-xs text-red-200 hover:border-red-400"
                >
                  Eliminar
                </button>
              </ConfirmForm>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded border border-white/10 px-3 py-1 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-xs text-[var(--muted)]">
            {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de{" "}
            {filtered.length}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="rounded border border-white/10 px-3 py-1 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function RouteShiftSelect({
  rows,
  shifts,
  name,
  required,
}: {
  rows: RouteShiftRow[];
  shifts: ShiftOption[];
  name: string;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [shiftId, setShiftId] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (shiftId && r.shiftId !== shiftId) return false;
      if (!q) return true;
      return `${r.routeName} ${r.shiftName}`.toLowerCase().includes(q);
    });
  }, [rows, query, shiftId]);

  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={inputClass}
          placeholder="Filtrar por nombre…"
        />
        <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={inputClass}>
          <option value="">Todos los turnos</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.startTime.slice(0, 5)}
            </option>
          ))}
        </select>
      </div>
      <select name={name} required={required} className={inputClass} defaultValue="">
        <option value="" disabled>
          Elige ruta… ({filtered.length})
        </option>
        {filtered.map((r) => (
          <option key={r.id} value={r.routeId}>
            {r.routeName} · {r.shiftName} · inicio {r.shiftStart}
          </option>
        ))}
      </select>
    </div>
  );
}
