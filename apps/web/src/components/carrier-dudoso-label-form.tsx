"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UnitOption = { id: string; label: string };

export function CarrierDudosoLabelForm({
  occurrenceId,
  accountSlug,
  units,
  existing,
}: {
  occurrenceId: string;
  accountSlug: string;
  units: UnitOption[];
  existing?: {
    verdict: "cumplido" | "no_hecho";
    unitId: string | null;
    notes: string | null;
  } | null;
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
        <span className="text-white">calibrar</span> el motor —{" "}
        <span className="text-white">no cambia</span> el veredicto que ve el cliente.
      </p>

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
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            required
          >
            <option value="">Selecciona…</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block space-y-1">
        <span className="text-[var(--muted)]">Nota (opcional)</span>
        <textarea
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2"
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
