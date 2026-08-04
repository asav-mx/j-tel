import { LandingView } from "./landing/landing-view";
import { getIdentidad } from "@/lib/auth";
import { sesionUtilizable } from "@/lib/guardia-pagina";
import { getRepos } from "@/lib/db";
import { withAccount } from "@/lib/account-context";

/**
 * La raíz — una ruta con dos caras.
 *
 * **Sin sesión → el landing público.** Quien teclee la dirección del producto
 * ve la cara de venta, no un error y no un directorio. **Con sesión → la
 * portada**, y la portada enseña **solo lo tuyo**.
 *
 * ## Qué había antes, y por qué era grave
 *
 * Esta pantalla listaba **todas** las cuentas con `listByType`, sin preguntar
 * nada a nadie, y las nombraba dos veces: en los enlaces y en un bloque
 * «Estado del sistema» que imprimía la lista separada por comas. Al 4 de agosto
 * de 2026 eso se servía abierto en `www.j-telemetry.com`, con «Tecma» y
 * «Juárez Bus» a la vista de cualquiera.
 *
 * Y el detalle amargo: la consulta usaba `includeDemo: false`. **El filtro que
 * existía para que la entrada se viera limpia era justo lo que garantizaba que
 * los nombres filtrados fueran de clientes reales.** Con las demo dentro, la
 * fuga habría sido inofensiva.
 *
 * Eran dos defectos y se arreglan por separado: no había login, y se filtraban
 * nombres. Cerrar el primero no arregla el segundo — una portada que le lista
 * todas las cuentas a quien entre rompe igual la ley de que una planta jamás ve
 * otra, solo que un nivel más adentro.
 *
 * ## De dónde salen ahora las cuentas
 *
 * De **las membresías de quien pregunta**, no de un `listByType`. Si tienes una
 * sola, es la única que se ve. La cuenta nunca sale de la URL.
 *
 * ## El bloque «Estado del sistema» no está, y no se protegió: se quitó
 *
 * Era un panel de operador en una pantalla de entrada, y su forma de decir «hay
 * clientes» era escribir sus nombres. Eso ya vive en `/jstaff` y en
 * `/api/salud`, que se diseñó explícitamente **sin nombres en el cuerpo**.
 */

export const dynamic = "force-dynamic";

type Puerta = { nombre: string; href: string };

export default async function HomePage() {
  let identidad;
  try {
    identidad = await getIdentidad();
  } catch {
    /*
     * Sin poder resolver quién pregunta, se sirve el landing. Es el lado
     * cerrado: el landing no trata datos, así que no hay nada que filtrar.
     */
    return <LandingView />;
  }

  if (!sesionUtilizable(identidad)) return <LandingView />;

  const repos = getRepos();

  // Una consulta por membresía, y solo por las que tiene. Nada de listar todas
  // las cuentas para después filtrarlas: lo que no es tuyo no se lee.
  const cuentas = await Promise.all(
    identidad.memberships.map((m) => repos.accounts.findById(m.accountId)),
  );

  const clientes: Puerta[] = [];
  const carriers: Puerta[] = [];
  let hayJStaff = false;

  for (const cuenta of cuentas) {
    if (!cuenta) continue;
    if (cuenta.type === "client") {
      clientes.push({ nombre: cuenta.name, href: withAccount("/cliente", cuenta.slug) });
    } else if (cuenta.type === "carrier") {
      carriers.push({ nombre: cuenta.name, href: withAccount("/carrier", cuenta.slug) });
    } else if (cuenta.type === "jstaff") {
      hayJStaff = true;
    }
  }

  const sinNada = clientes.length === 0 && carriers.length === 0 && !hayJStaff;

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight">J·Telemetry</h1>
          <p className="mt-2 text-[var(--muted)]">
            Verificación automática de transporte de personal
          </p>
        </header>

        {sinNada ? (
          /*
           * Se enuncia en vez de esconderse. Una portada vacía sin explicación
           * se lee como producto roto; ésta dice qué pasó y a quién acudir.
           */
          <section className="rounded-xl border border-[var(--linea)] bg-[var(--card)] p-6">
            <h2 className="text-lg font-semibold">Tu usuario todavía no tiene acceso</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Entraste bien, pero esta identidad no tiene ninguna cuenta asignada, así que no
              hay nada que abrir. No es un error de la aplicación: falta que J-Staff te asigne
              tu cuenta.
            </p>
            <p className="mt-3 text-sm">
              <a href="/quien-soy" className="text-[var(--accent)] hover:underline">
                Ver con qué identidad entraste →
              </a>
            </p>
          </section>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {clientes.length > 0 && (
              <section className="rounded-xl border border-[var(--linea)] bg-[var(--card)] p-6">
                <h2 className="text-lg font-semibold">Cara Cliente</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Cumplimiento, reportes y configuración de servicios
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {clientes.map((c) => (
                    <li key={c.href}>
                      <a href={c.href} className="text-[var(--accent)] hover:underline">
                        {c.nombre} →
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {carriers.length > 0 && (
              <section className="rounded-xl border border-[var(--linea)] bg-[var(--card)] p-6">
                <h2 className="text-lg font-semibold">Cara Carrier</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Flota, mantenimiento y auditoría
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {carriers.map((c) => (
                    <li key={c.href}>
                      <a href={c.href} className="text-[var(--accent)] hover:underline">
                        {c.nombre} →
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {hayJStaff && (
              <a
                href="/jstaff"
                className="rounded-xl border border-[var(--linea)] bg-[var(--card)] p-6 transition hover:border-[var(--accent)]"
              >
                <h2 className="text-lg font-semibold">J-Staff</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Altas, demos y compuerta de soporte
                </p>
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
