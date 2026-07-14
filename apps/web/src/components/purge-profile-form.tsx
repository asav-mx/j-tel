"use client";

import { useMemo, useState } from "react";

type ProfileOption = {
  id: string;
  code: string;
  name: string;
  plantId: string;
  contractName: string;
  occurrenceCount: number;
};

type PlantOption = {
  id: string;
  label: string;
  code: string;
};

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm";

/**
 * Borrar UN perfil de prueba (con ocurrencias) — frenos:
 * 1. Sección cerrada
 * 2. Checkbox
 * 3. Código exacto del perfil
 * 4. PURGAR
 * 5. window.confirm
 */
export function PurgeProfileForm({
  plants,
  profiles,
}: {
  plants: PlantOption[];
  profiles: ProfileOption[];
}) {
  const [plantId, setPlantId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [codeTyped, setCodeTyped] = useState("");
  const [phraseTyped, setPhraseTyped] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [pending, setPending] = useState(false);

  const plantProfiles = useMemo(
    () => profiles.filter((p) => p.plantId === plantId),
    [profiles, plantId],
  );

  const selected = useMemo(
    () => plantProfiles.find((p) => p.id === profileId) ?? null,
    [plantProfiles, profileId],
  );

  const codeOk = selected != null && codeTyped.trim() === selected.code;
  const phraseOk = phraseTyped.trim() === "PURGAR";
  const canSubmit = Boolean(selected && understood && codeOk && phraseOk && !pending);

  return (
    <details className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <summary className="cursor-pointer text-sm font-medium text-amber-100">
        Borrar un solo perfil (prueba) — abrir aquí
      </summary>

      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-50">
          <p className="font-medium">Borra ese perfil y sus ~30 días de servicios.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-50/90">
            <li>No toca los demás perfiles de la planta</li>
            <li>La ruta/turno del catálogo se quedan (los puedes borrar aparte si ya no se usan)</li>
            <li>No se puede deshacer</li>
          </ul>
        </div>

        <form
          action="/api/jstaff/purge-profile"
          method="post"
          className="grid gap-3 md:grid-cols-2"
          aria-busy={pending || undefined}
          onSubmit={(e) => {
            if (pending || !canSubmit || !selected) {
              e.preventDefault();
              return;
            }
            const ok = window.confirm(
              `ÚLTIMA CONFIRMACIÓN\n\n¿Borrar el perfil «${selected.name}» (${selected.code})?\n\nOcurrencias que se van: ${selected.occurrenceCount}\nEsto es irreversible.`,
            );
            if (!ok) {
              e.preventDefault();
              return;
            }
            setPending(true);
          }}
        >
          <input type="hidden" name="profileId" value={profileId} />
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
                setProfileId("");
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

          <label className="block text-sm md:col-span-2">
            Perfil
            <select
              required
              className={inputClass}
              value={profileId}
              disabled={!plantId}
              onChange={(e) => {
                setProfileId(e.target.value);
                setCodeTyped("");
                setPhraseTyped("");
                setUnderstood(false);
              }}
            >
              <option value="" disabled>
                {plantId ? "Elige el perfil a borrar…" : "Primero elige planta"}
              </option>
              {plantProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name} ({p.occurrenceCount} occs)
                </option>
              ))}
            </select>
            {plantId && plantProfiles.length === 0 ? (
              <span className="mt-1 block text-xs text-[var(--muted)]">
                Esta planta no tiene perfiles.
              </span>
            ) : null}
          </label>

          <label className="flex items-start gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
            />
            <span>
              Entiendo que se borrarán el perfil y sus servicios ya generados y que{" "}
              <span className="text-white">no hay deshacer</span>.
            </span>
          </label>

          <label className="block text-sm md:col-span-2">
            Escribe el código del perfil
            {selected ? (
              <span className="text-[var(--muted)]"> (exactamente «{selected.code}»)</span>
            ) : null}
            <input
              className={inputClass}
              value={codeTyped}
              onChange={(e) => setCodeTyped(e.target.value)}
              placeholder={selected?.code ?? "RUTA-NORTE-…"}
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
            Escribe la palabra <span className="font-mono text-white">PURGAR</span> en mayúsculas
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
              className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Borrando… no cierres" : "Borrar este perfil + ocurrencias"}
            </button>
            {!canSubmit && !pending ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                El botón se activa solo con: planta + perfil + checkbox + código + PURGAR.
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </details>
  );
}
