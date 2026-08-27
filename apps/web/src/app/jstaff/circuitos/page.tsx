import Link from "next/link";
import { AppNav, Card } from "@/components/ui";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

/**
 * La puerta de entrada del transporte concesionado: dar de alta una concesión,
 * dar de alta sus circuitos, y entrar a editarlos.
 *
 * Los tres campos del circuito vienen con los valores del circuito 1 ya puestos
 * en el formulario, pero **son campos del formulario, no constantes**: se editan
 * aquí y después en la pantalla del circuito, sin desplegar nada.
 */
export default async function CircuitosPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirEnPagina({ tipo: "jstaff" });

  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const ok = typeof sp?.ok === "string" ? sp.ok : null;

  const repos = getRepos();
  const [concesiones, circuitos] = await Promise.all([
    repos.circuits.listConcessions(),
    repos.circuits.listAllCircuits(),
  ]);

  const campo = "w-full rounded border border-[var(--linea-tenue)] bg-transparent px-2 py-1 text-sm";
  const etiqueta = "block text-xs text-[var(--muted)] mb-1";

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <AppNav
          title="Transporte concesionado — concesiones y circuitos"
          links={[
            { href: "/jstaff", label: "← Panel" },
            { href: "/jstaff/circuitos", label: "Circuitos" },
          ]}
        />

        {error && (
          <p className="mb-4 rounded border border-[var(--linea-tenue)] p-3 text-sm">⚠ {error}</p>
        )}
        {ok && (
          <p className="mb-4 rounded border border-[var(--linea-tenue)] p-3 text-sm">✓ {ok}</p>
        )}

        <Card>
          <h2 className="mb-1 font-medium">1 · Concesiones</h2>
          <p className="mb-3 text-xs text-[var(--muted)]">
            La concesión es la dueña de sus circuitos. Un carrier los opera, pero no los posee.
          </p>

          {concesiones.length === 0 ? (
            <p className="mb-3 text-sm text-[var(--muted)]">Ninguna todavía.</p>
          ) : (
            <ul className="mb-3 text-sm">
              {concesiones.map((c) => (
                <li key={c.accountId} className="border-t border-[var(--linea-tenue)] py-2">
                  <strong>{c.name}</strong>
                  {c.numeroConcesion ? (
                    <span className="ml-2 text-xs text-[var(--muted)]">
                      concesión {c.numeroConcesion}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <form action="/api/jstaff/concesiones" method="post" className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={etiqueta} htmlFor="nombre">
                Nombre
              </label>
              <input id="nombre" name="nombre" required className={campo} placeholder="Juárez Bus" />
            </div>
            <div>
              <label className={etiqueta} htmlFor="razonSocial">
                Razón social (opcional)
              </label>
              <input id="razonSocial" name="razonSocial" className={campo} />
            </div>
            <div>
              <label className={etiqueta} htmlFor="numeroConcesion">
                Número de concesión (opcional)
              </label>
              <input id="numeroConcesion" name="numeroConcesion" className={campo} />
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                className="rounded border border-[var(--linea-tenue)] px-3 py-1 text-sm"
              >
                Dar de alta la concesión
              </button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="mb-1 font-medium">2 · Circuitos</h2>
          <p className="mb-3 text-xs text-[var(--muted)]">
            El slug público va en la URL de la app. Escógelo con calma: se comparte y no conviene
            cambiarlo después.
          </p>

          {circuitos.length === 0 ? (
            <p className="mb-3 text-sm text-[var(--muted)]">Ninguno todavía.</p>
          ) : (
            <ul className="mb-3 text-sm">
              {circuitos.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between border-t border-[var(--linea-tenue)] py-2"
                >
                  <span>
                    <strong>{c.name}</strong>
                    <span className="ml-2 text-xs text-[var(--muted)]">
                      {c.concessionName} · cada {c.declaredFrequencyMinutes} min ·{" "}
                      <code>{c.publicSlug}</code>
                    </span>
                  </span>
                  <Link href={`/jstaff/circuitos/${c.id}`} className="text-sm underline">
                    Abrir editor →
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {concesiones.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Primero da de alta una concesión: un circuito siempre pertenece a una.
            </p>
          ) : (
            <form action="/api/jstaff/circuitos" method="post" className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className={etiqueta} htmlFor="concesionAccountId">
                  Concesión dueña
                </label>
                <select id="concesionAccountId" name="concesionAccountId" className={campo} required>
                  {concesiones.map((c) => (
                    <option key={c.accountId} value={c.accountId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={etiqueta} htmlFor="nombreCircuito">
                  Nombre del circuito
                </label>
                <input
                  id="nombreCircuito"
                  name="nombre"
                  required
                  className={campo}
                  placeholder="Oasis–Centro"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={etiqueta} htmlFor="publicSlug">
                  Slug público (minúsculas, números y guiones)
                </label>
                <input
                  id="publicSlug"
                  name="publicSlug"
                  required
                  pattern="[a-z0-9\-]{3,60}"
                  className={campo}
                  placeholder="oasis-centro"
                />
              </div>

              <div>
                <label className={etiqueta} htmlFor="frecuenciaMin">
                  Frecuencia declarada (min)
                </label>
                <input
                  id="frecuenciaMin"
                  name="frecuenciaMin"
                  type="number"
                  min={1}
                  defaultValue={20}
                  className={campo}
                />
              </div>
              <div>
                <label className={etiqueta} htmlFor="umbralSeg">
                  Dato viejo a los (seg)
                </label>
                <input
                  id="umbralSeg"
                  name="umbralSeg"
                  type="number"
                  min={1}
                  defaultValue={180}
                  className={campo}
                />
              </div>
              <div>
                <label className={etiqueta} htmlFor="pisoSeg">
                  Piso del rango (seg)
                </label>
                <input
                  id="pisoSeg"
                  name="pisoSeg"
                  type="number"
                  min={1}
                  defaultValue={180}
                  className={campo}
                />
              </div>

              <div>
                <label className={etiqueta} htmlFor="toleranciaM">
                  Tolerancia de pegado (m)
                </label>
                <input
                  id="toleranciaM"
                  name="toleranciaM"
                  type="number"
                  min={1}
                  defaultValue={25}
                  className={campo}
                />
              </div>
              <div>
                <label className={etiqueta} htmlFor="horaInicio">
                  Inicio de servicio
                </label>
                <input
                  id="horaInicio"
                  name="horaInicio"
                  type="time"
                  defaultValue="05:00"
                  className={campo}
                />
              </div>
              <div>
                <label className={etiqueta} htmlFor="horaFin">
                  Fin de servicio
                </label>
                <input id="horaFin" name="horaFin" type="time" defaultValue="23:00" className={campo} />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="rounded border border-[var(--linea-tenue)] px-3 py-1 text-sm"
                >
                  Crear circuito y abrir su editor
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
