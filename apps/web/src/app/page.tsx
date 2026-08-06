import { redirect } from "next/navigation";
import { entraDirecto } from "@/lib/puerta-unica";
import { LandingView } from "./landing/landing-view";
import { getIdentidad, type Identidad } from "@/lib/auth";
import { sesionUtilizable } from "@/lib/guardia-pagina";
import { getRepos } from "@/lib/db";
import { withAccount } from "@/lib/account-context";
import { isJStaff, tieneAlcanceGlobal } from "@jtel/auth-rbac";
import { DemoChip } from "@/components/ui";

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
 * ## De dónde salen ahora las cuentas: del ALCANCE, no de las filas
 *
 * La primera versión de esta portada listaba **las membresías** de quien
 * pregunta, y eso estaba mal por debajo: una identidad con alcance `global`
 * tiene **una sola fila** —la de J-Staff— y sin embargo su alcance es *toda la
 * plataforma*. Listar sus filas le enseñaba una puerta cuando tiene derecho a
 * todas. **La fila no es el alcance.**
 *
 * Ahora se pregunta por alcance, con la regla que vive en `@jtel/auth-rbac`:
 *
 * - **Alcance global** → todas las cuentas. Es literalmente lo que significa,
 *   y es la compuerta de soporte que el Marco ya contempla.
 * - **Cualquier otro alcance** → solo sus cuentas. Un usuario de Tecma sigue
 *   viendo únicamente Tecma. **Eso no se toca.**
 *
 * No hay caso especial para ninguna identidad ni para ninguna cuenta: el código
 * no conoce nombres. Un privilegio escrito con nombre propio sobrevive al
 * desarrollo y se queda de puerta trasera en producción.
 *
 * La cuenta nunca sale de la URL.
 *
 * ## El bloque «Estado del sistema» no está, y no se protegió: se quitó
 *
 * Era un panel de operador en una pantalla de entrada, y su forma de decir «hay
 * clientes» era escribir sus nombres. Eso ya vive en `/jstaff` y en
 * `/api/salud`, que se diseñó explícitamente **sin nombres en el cuerpo**.
 */

export const dynamic = "force-dynamic";

type Puerta = { nombre: string; href: string; esDemo: boolean };

/**
 * Las cuentas que esta identidad alcanza.
 *
 * Con alcance global se leen todas —**incluidas las de ejemplo, marcadas**, no
 * escondidas: descontarlas en silencio es la baja silenciosa que ya decidimos
 * no repetir—. Con cualquier otro alcance, solo las de sus membresías, y ahí no
 * se lee ni una fila de más.
 */
async function cuentasAlcanzadas(identidad: Identidad) {
  const repos = getRepos();

  if (tieneAlcanceGlobal(identidad.memberships)) {
    const [clientes, carriers] = await Promise.all([
      repos.accounts.listByType("client"),
      repos.accounts.listByType("carrier"),
    ]);
    return { cuentas: [...clientes, ...carriers], global: true };
  }

  const cuentas = await Promise.all(
    identidad.memberships.map((m) => repos.accounts.findById(m.accountId)),
  );
  return { cuentas: cuentas.filter((c) => c !== undefined && c !== null), global: false };
}

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

  const { cuentas } = await cuentasAlcanzadas(identidad);

  const clientes: Puerta[] = [];
  const carriers: Puerta[] = [];
  // La puerta de J-Staff se ofrece por rol, no por cuenta: es la consola, no
  // una cuenta que se visite.
  const hayJStaff = isJStaff(identidad.memberships);

  for (const cuenta of cuentas) {
    if (!cuenta) continue;
    const puerta = (base: string) => ({
      nombre: cuenta.name,
      href: withAccount(base, cuenta.slug),
      esDemo: cuenta.isDemo,
    });
    if (cuenta.type === "client") clientes.push(puerta("/cliente"));
    else if (cuenta.type === "carrier") carriers.push(puerta("/carrier"));
  }

  const sinNada = clientes.length === 0 && carriers.length === 0 && !hayJStaff;

  /*
   * Una sola puerta: se entra directo, sin portada.
   *
   * Con una sola cuenta, la portada pide elegir entre una opción — un clic que
   * no decide nada. Es la misma regla que `Ficha-Diseno-Permisos.md` ya aplica un
   * nivel más adentro («una sola planta o campus → entra directo ahí»), traída
   * al nivel de la cuenta.
   *
   * **Se cuenta lo que se puede abrir, no las membresías.** J-Staff cuenta como
   * puerta: quien tiene consola Y una cuenta tiene dos destinos reales y debe
   * poder elegir. Y quien tiene alcance global ve todas las cuentas, así que
   * nunca cae aquí.
   *
   * `replace` y no `redirect` normal: la portada no debe quedar en el historial
   * del navegador. Volver atrás desde /cliente tiene que salir del producto, no
   * rebotar a una pantalla que redirige otra vez.
   */
  const puertas = [...clientes, ...carriers];
  if (entraDirecto(puertas.length, hayJStaff)) redirect(puertas[0]!.href);

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
                      {c.esDemo && <DemoChip />}
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
                      {c.esDemo && <DemoChip />}
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
