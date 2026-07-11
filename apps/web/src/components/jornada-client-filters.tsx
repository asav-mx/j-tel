"use client";

import { useState } from "react";
import { JornadaContrastMap } from "@/components/jornada-contrast-map";
import type { JornadaRoute } from "@/lib/jornada-data";

export function JornadaClientFilters({
  routes,
  units,
}: {
  routes: JornadaRoute[];
  units: Array<{ id: string; label: string }>;
}) {
  const [unitFilter, setUnitFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <label>
          Unidad
          <select
            className="ml-2 rounded border border-white/10 bg-black/40 px-2 py-1"
            value={unitFilter ?? ""}
            onChange={(e) => setUnitFilter(e.target.value || null)}
          >
            <option value="">Todas</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Veredicto
          <select
            className="ml-2 rounded border border-white/10 bg-black/40 px-2 py-1"
            value={statusFilter ?? ""}
            onChange={(e) => setStatusFilter(e.target.value || null)}
          >
            <option value="">Todos</option>
            <option value="cumplido">Cumplido</option>
            <option value="no_cumplido">No cumplido</option>
            <option value="pendiente_evidencia">Pendiente</option>
            <option value="sin_verificar">Sin verificar</option>
          </select>
        </label>
      </div>
      <JornadaContrastMap
        routes={routes}
        unitFilter={unitFilter}
        statusFilter={statusFilter}
      />
    </div>
  );
}
