"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { UnitSuggestion } from "@/lib/carrier-unit-suggestions";

type UnitOption = { id: string; label: string };

export function CarrierDudosoLabelForm({
  occurrenceId,
  accountSlug,
  units,
  suggestions = [],
  existing,
  onUnitFocus,
}: {
  occurrenceId: string;
  accountSlug: string;
  units: UnitOption[];
  suggestions?: UnitSuggestion[];
  existing?: {
    verdict: "cumplido" | "no_hecho";
    unitId: string | null;
    notes: string | null;
  } | null;
  onUnitFocus?: (unitId: string | null) => void;
}) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<"cumplido" | "no_hecho" | "">(
    existing?.verdict ?? "",
  );
  const [unitId, setUnitId] = useState(existing?.unitId ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const suggestionIds = new Set(suggestions.map((s) => s.unitId));
  const otherUnits = units.filter((u) => !suggestionIds.has(u.id));

  function pickSuggestion(id: string) {
    setVerdict("cumplido");
    setUnitId(id);
    onUnitFocus?.(id);
    setError(null);
  }

  function setUnit(id: string) {
    setUnitId(id);
    onUnitFocus?.(id || null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (verdict !== "cumplido" && verdict !== "no_hecho") {
      setError("Elige si se hizo o no.");
      return;
    }
    if (verdict === "cumplido" && !unitId) {
      setError("Elige la unidad que hizo el servicio.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/carrier/dudosos/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: accountSlug,
          occurrenceId,
          verdict,
          unitId: verdict === "cumplido" ? unitId : null,
          notes: notes.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-sm">
      <p className="text-[var(--muted)]">
        El sistema no asoció una unidad con seguridad. Tu respuesta sirve para{" "}
        <span className="text-[var(--texto)]">calibrar</span> el motor —{" "}
        <span className="text-[var(--texto)]">no cambia</span> el veredicto que ve el cliente.
      </p>

      {suggestions.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-[var(--linea)] bg-black/20 p-3">
          <p className="text-[var(--muted)]">
            Sugerencias del sistema (unidades cuyo GPS más se parece a esta ruta).{" "}
            <span className="text-[var(--texto)]">Revisa el mapa</span> — no es veredicto.
          </p>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((s) => {
              const active = unitId === s.unitId && verdict === "cumplido";
              return (
                <li key={s.unitId}>
                  <button
                    type="button"
                    onClick={() => pickSuggestion(s.unitId)}
                    className={`rounded-lg border px-3 py-2 text-left transition ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--texto)]"
                        : "border-[var(--linea-fuerte)] hover:border-[var(--accent)]"
                    }`}
                  >
                    <span className="font-medium">{s.label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      {s.rank === 1 ? "Mejor parecido" : `${s.rank}ª opción`}
                      {" · "}
                      parecido {Math.round(s.score)}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          Sin sugerencias guardadas de la verificación. Elige la unidad a mano si la
          conoces.
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="text-[var(--muted)]">¿Este servicio se realizó?</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="verdict"
            checked={verdict === "cumplido"}
            onChange={() => setVerdict("cumplido")}
          />
          Sí se hizo
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="verdict"
            checked={verdict === "no_hecho"}
            onChange={() => setVerdict("no_hecho")}
          />
          No se hizo
        </label>
      </fieldset>

      {verdict === "cumplido" ? (
        <label className="block space-y-1">
          <span className="text-[var(--muted)]">Unidad</span>
          <select
            className="w-full rounded-lg border border-[var(--linea)] bg-black/30 px-3 py-2"
            value={unitId}
            onChange={(e) => setUnit(e.target.value)}
            required
          >
            <option value="">Selecciona…</option>
            {suggestions.length > 0 ? (
              <optgroup label="Sugeridas">
                {suggestions.map((s) => (
                  <option key={s.unitId} value={s.unitId}>
                    {s.label}
                    {s.rank === 1 ? " (mejor parecido)" : ""}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label={suggestions.length > 0 ? "Toda la flota" : "Unidades"}>
              {(suggestions.length > 0 ? otherUnits : units).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      ) : null}

      <label className="block space-y-1">
        <span className="text-[var(--muted)]">Nota (opcional)</span>
        <textarea
          className="w-full rounded-lg border border-[var(--linea)] bg-black/30 px-3 py-2"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {error ? <p className="text-red-300">{error}</p> : null}
      {saved ? (
        <p className="text-emerald-300">
          Guardado para calibración. El estado del cliente no cambió.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-black disabled:opacity-50"
      >
        {busy ? "Guardando…" : existing ? "Actualizar etiqueta" : "Guardar etiqueta"}
      </button>
    </form>
  );
}
