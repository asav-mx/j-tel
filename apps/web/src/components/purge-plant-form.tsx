"use client";

import { useMemo, useState } from "react";

type PlantOption = {
  id: string;
  label: string;
  code: string;
};

const inputClass =
  "mt-1 w-full rounded border border-[var(--linea)] bg-black/20 p-2 text-sm";

/**
 * Purga destructiva con frenos explícitos:
 * 1. Sección cerrada por defecto (details)
 * 2. Checkbox "entiendo"
 * 3. Escribir código de planta
 * 4. Escribir la palabra PURGAR
 * 5. window.confirm final
 */
export function PurgePlantForm({ plants }: { plants: PlantOption[] }) {
  const [plantId, setPlantId] = useState("");
  const [codeTyped, setCodeTyped] = useState("");
  const [phraseTyped, setPhraseTyped] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [pending, setPending] = useState(false);

  const selected = useMemo(
    () => plants.find((p) => p.id === plantId) ?? null,
    [plants, plantId],
  );

  const codeOk = selected != null && codeTyped.trim() === selected.code;
  const phraseOk = phraseTyped.trim() === "PURGAR";
  const canSubmit = Boolean(selected && understood && codeOk && phraseOk && !pending);

  return (
    <details className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
      <summary className="cursor-pointer text-sm font-medium text-red-200">
        Zona de peligro — abrir solo si quieres borrar perfiles de una planta
      </summary>

      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
          <p className="font-medium">Esto NO se puede deshacer.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-red-100/90">
            <li>Borra TODOS los perfiles de la planta elegida</li>
            <li>Borra sus ocurrencias (~30 días), hechos y ledger</li>
            <li>El contrato y la planta se quedan; las rutas/turnos también</li>
            <li>
              Si solo confundiste la geocerca,{" "}
              <span className="text-[var(--texto)]">no uses esto</span>: corrige en
              Configuración → Perfiles → «Aplicar a todos»
            </li>
          </ul>
        </div>

        <form
          action="/api/jstaff/purge-plant-profiles"
          method="post"
          className="grid gap-3 md:grid-cols-2"
          aria-busy={pending || undefined}
          onSubmit={(e) => {
            if (pending || !canSubmit || !selected) {
              e.preventDefault();
              return;
            }
            const ok = window.confirm(
              `ÚLTIMA CONFIRMACIÓN\n\n¿Borrar TODOS los perfiles y ocurrencias de «${selected.label}»?\n\nCódigo: ${selected.code}\nEsto es irreversible.`,
            );
            if (!ok) {
              e.preventDefault();
              return;
            }
            setPending(true);
          }}
        >
          <input type="hidden" name="plantId" value={plantId} />
          <input type="hidden" name="confirmar" value={codeTyped.trim()} />
          <input type="hidden" name="frase" value={phraseTyped.trim()} />

          <label className="block text-sm md:col-span-2">
            Planta
            <select
              required
              className={inputClass}
              value={plantId}
              onChange={(e) => {
                setPlantId(e.target.value);
                setCodeTyped("");
                setPhraseTyped("");
                setUnderstood(false);
              }}
            >
              <option value="" disabled>
                Elige planta…
              </option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.code})
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-start gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
            />
            <span>
              Entiendo que se borrarán perfiles y servicios ya generados y que{" "}
              <span className="text-[var(--texto)]">no hay deshacer</span>.
            </span>
          </label>

          <label className="block text-sm md:col-span-2">
            Escribe el código de la planta
            {selected ? (
              <span className="text-[var(--muted)]"> (exactamente «{selected.code}»)</span>
            ) : null}
            <input
              className={inputClass}
              value={codeTyped}
              onChange={(e) => setCodeTyped(e.target.value)}
              placeholder={selected?.code ?? "47"}
              autoComplete="off"
              spellCheck={false}
            />
            {selected && codeTyped && !codeOk ? (
              <span className="mt-1 block text-xs text-red-300">
                No coincide con {selected.code}
              </span>
            ) : null}
          </label>

          <label className="block text-sm md:col-span-2">
            Escribe la palabra <span className="font-mono text-[var(--texto)]">PURGAR</span> en mayúsculas
            <input
              className={inputClass}
              value={phraseTyped}
              onChange={(e) => setPhraseTyped(e.target.value)}
              placeholder="PURGAR"
              autoComplete="off"
              spellCheck={false}
            />
            {phraseTyped && !phraseOk ? (
              <span className="mt-1 block text-xs text-red-300">Debe ser exactamente PURGAR</span>
            ) : null}
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Purgando… no cierres" : "Purgar perfiles + ocurrencias"}
            </button>
            {!canSubmit && !pending ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                El botón se activa solo con: planta + checkbox + código + PURGAR.
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </details>
  );
}
