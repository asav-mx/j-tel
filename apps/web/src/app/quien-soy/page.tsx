import Link from "next/link";
import { SignInButton, SignOutButton } from "@clerk/nextjs";
import { getIdentidad, type OrigenDeIdentidad } from "@/lib/auth";
import { getRepos } from "@/lib/db";
import { CLERK_CONFIGURADO } from "@/lib/clerk-estado";
import { sesionUtilizable } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

/**
 * Quién soy — el instrumento del Paso 1 de auth-rbac.
 *
 * No es una pantalla de producto: es la que nos dice si la identidad funciona
 * ANTES de que empecemos a cerrar puertas. Mientras diga "por defecto" en vez
 * de "sesión", auth-rbac no está terminado, y eso tiene que verse sin abrir el
 * código.
 *
 * Cara J-Staff: aquí el usuario es experto y sí quiere el razonamiento
 * completo, así que va densa y sin suavizar.
 */

const ORIGEN: Record<OrigenDeIdentidad, { titulo: string; lectura: string }> = {
  clerk: {
    titulo: "Sesión de Clerk",
    lectura:
      "La identidad viene de una sesión real, firmada, que no se puede pedir desde el navegador. Es la única de las cuatro que sirve para cerrar puertas.",
  },
  "encabezado-dev": {
    titulo: "Encabezado de desarrollo",
    lectura:
      "La identidad la eligió el encabezado x-jtel-user, y esta petición tenía permiso para hacerlo — o corre fuera de producción, o trajo el token de servidor.",
  },
  "variable-dev": {
    titulo: "Variable de entorno",
    lectura:
      "La identidad la fija JTEL_DEV_USER en el servidor. Sólo fuera de producción: en producción esa variable se ignora desde el 14 de septiembre de 2026.",
  },
  anonimo: {
    titulo: "Nadie",
    lectura:
      "No hay identidad: ni sesión de Clerk, ni encabezado válido, ni JTEL_DEV_USER. Aquí el código asumía tecma_admin —un admin corporativo de un cliente real— y eso se retiró en la pieza 1.e. Sin señal no hay usuario.",
  },
};

const ALCANCE: Record<string, string> = {
  global: "toda la plataforma",
  account: "toda la cuenta",
  plant: "una planta",
  fleet: "la flota",
};

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] font-medium tracking-[0.14em] text-[var(--tenue)] uppercase">
        {etiqueta}
      </div>
      <div className="mt-1 font-mono text-[13px] text-[var(--acero)]">{children}</div>
    </div>
  );
}

/**
 * Lo único que ve quien llega sin sesión en producción.
 *
 * Hasta el 14 de septiembre de 2026 esta pantalla le enseñaba a cualquiera la
 * identidad que el servidor le asignaba —`jstaff_admin`, por la variable de
 * desarrollo— y la tabla de sus membresías con los nombres de las cuentas. Sin
 * guardia, porque es la pantalla que explica por qué no se puede entrar.
 *
 * Sigue sin guardia por esa razón, pero sin sesión ya no hay nada que
 * explicar de nadie: sin sesión no hay identidad que valga, y enseñar la que
 * habría tocado es enseñar lo que la guardia protege.
 */
function SinSesion() {
  return (
    <main className="mx-auto max-w-[860px] px-5 py-9 pb-24">
      <h1 className="mb-3 max-w-[24ch] font-[family-name:var(--fuente-archivo)] text-[32px] leading-[1.05] font-bold tracking-[-0.02em]">
        No hay sesión.
      </h1>
      <p className="mb-8 max-w-[62ch] text-[var(--tenue)]">
        Sin sesión no hay identidad que mostrar. Entra y esta pantalla te dirá con qué cuenta
        entraste y qué puede alcanzar.
      </p>
      <Link
        href="/entrar"
        className="cursor-pointer rounded-sm border border-[var(--azul)] px-3.5 py-2 font-mono text-[11px] font-medium tracking-[0.11em] text-[var(--azul)] uppercase transition-colors hover:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--azul)]"
      >
        Entrar
      </Link>
    </main>
  );
}

export default async function QuienSoyPage() {
  const id = await getIdentidad();
  // Antes de leer las cuentas de las membresías: sin sesión en producción, ni
  // se consultan.
  if (!sesionUtilizable(id)) return <SinSesion />;
  const repos = getRepos();

  const membresías = await Promise.all(
    id.memberships.map(async (m) => ({
      ...m,
      cuenta: await repos.accounts.findById(m.accountId),
    })),
  );

  const origen = ORIGEN[id.origen];

  return (
    <main className="mx-auto max-w-[860px] px-5 py-9 pb-24">
      <p className="mb-3 font-mono text-[10.5px] font-medium tracking-[0.17em] text-[var(--tenue)] uppercase">
        Auth-RBAC · diagnóstico de identidad
      </p>

      <h1 className="mb-3 max-w-[24ch] font-[family-name:var(--fuente-archivo)] text-[32px] leading-[1.05] font-bold tracking-[-0.02em]">
        {id.sesionActiva ? "Entraste con una sesión real." : "Todavía no hay sesión."}
      </h1>

      <p className="mb-8 max-w-[62ch] text-[var(--tenue)]">
        {id.sesionActiva
          ? "La identidad viene de Clerk. Falta que esa identidad encuentre sus membresías en la base — mientras no las tenga, no hay nada que cerrar."
          : "Fuera de producción la identidad sale del bypass de desarrollo. En producción esta pantalla no enseña nada sin sesión."}
      </p>

      {/* — Quién — */}
      <section className="mb-5 border border-[var(--linea)] bg-[var(--panel)] px-6 py-5">
        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <div className="font-mono text-[10px] font-medium tracking-[0.14em] text-[var(--tenue)] uppercase">
              Identificador
            </div>
            <div className="mt-1.5 font-[family-name:var(--fuente-archivo)] text-[26px] leading-none font-bold tracking-[-0.015em] text-[var(--texto)]">
              {id.userId ?? "— sin identidad —"}
            </div>
            <p className="mt-3 max-w-[58ch] text-[13.5px] text-[var(--tenue)]">
              <b className="font-medium text-[var(--texto)]">{origen.titulo}.</b> {origen.lectura}
            </p>
          </div>

          {CLERK_CONFIGURADO ? (
            <div className="flex gap-2.5">
              {id.sesionActiva ? (
                <SignOutButton>
                  <button className="cursor-pointer rounded-sm border border-[var(--acero)] px-3.5 py-2 font-mono text-[11px] font-medium tracking-[0.11em] text-[var(--acero)] uppercase transition-colors hover:bg-[var(--hover)]">
                    Cerrar sesión
                  </button>
                </SignOutButton>
              ) : (
                <SignInButton>
                  <button className="cursor-pointer rounded-sm border border-[var(--azul)] px-3.5 py-2 font-mono text-[11px] font-medium tracking-[0.11em] text-[var(--azul)] uppercase transition-colors hover:bg-[var(--hover)]">
                    Iniciar sesión
                  </button>
                </SignInButton>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* — El estado del arranque, con su lectura al lado — */}
      <section className="mb-5 grid gap-px overflow-hidden border border-[var(--linea)] bg-[var(--linea)] sm:grid-cols-3">
        <div className="bg-[var(--panel)] px-5 py-4">
          <Dato etiqueta="Clerk en este despliegue">
            {CLERK_CONFIGURADO ? "configurado" : "sin llaves"}
          </Dato>
        </div>
        <div className="bg-[var(--panel)] px-5 py-4">
          <Dato etiqueta="Sesión">{id.sesionActiva ? "activa" : "ninguna"}</Dato>
        </div>
        <div className="bg-[var(--panel)] px-5 py-4">
          <Dato etiqueta="Membresías">
            {id.memberships.length} {id.memberships.length === 1 ? "fila" : "filas"}
          </Dato>
        </div>
      </section>

      {id.encabezadoRechazado ? (
        <div className="mb-5 border border-[var(--linea)] border-l-2 border-l-[var(--azul)] bg-[var(--panel)] px-5 py-4">
          <p className="max-w-[62ch] text-[13.5px] text-[var(--tenue)]">
            <b className="font-medium text-[var(--texto)]">
              Llegó un encabezado x-jtel-user y se rechazó.
            </b>{" "}
            Esta petición intentó elegir identidad desde el navegador sin traer el token de
            servidor. Se ignoró por completo — nunca se acepta a medias.
          </p>
        </div>
      ) : null}

      {/* — Las membresías — */}
      <section className="mb-5 border border-[var(--linea)] bg-[var(--panel)] px-6 py-5">
        <h2 className="mb-4 font-[family-name:var(--fuente-archivo)] text-[17px] font-semibold">
          Lo que este usuario puede alcanzar
        </h2>

        {membresías.length === 0 ? (
          <p className="max-w-[62ch] text-[13.5px] text-[var(--tenue)]">
            {id.sesionActiva ? (
              <>
                <b className="font-medium text-[var(--texto)]">Tu sesión no tiene membresías.</b>{" "}
                No hay ninguna fila en{" "}
                <span className="font-mono text-[12px]">user_memberships</span> con tu
                identificador, así que no vas a poder abrir ninguna cuenta. Pide que te den de
                alta.
              </>
            ) : (
              <>Este identificador no tiene ninguna fila en{" "}
                <span className="font-mono text-[12px]">user_memberships</span>.</>
            )}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr>
                  {["Cuenta", "Tipo", "Rol", "Alcance"].map((h) => (
                    <th
                      key={h}
                      className="border-b border-[var(--linea-fuerte)] pr-3 pb-2.5 text-left font-mono text-[10px] font-medium tracking-[0.12em] text-[var(--tenue)] uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {membresías.map((m) => (
                  <tr key={`${m.accountId}-${m.role}-${m.scopeType}-${m.scopeId ?? ""}`}>
                    <td className="border-b border-[var(--linea-tenue)] py-2.5 pr-3">
                      {m.cuenta?.name ?? "—"}
                    </td>
                    <td className="border-b border-[var(--linea-tenue)] py-2.5 pr-3 font-mono text-[12px] text-[var(--tenue)]">
                      {m.cuenta?.type ?? "—"}
                    </td>
                    <td className="border-b border-[var(--linea-tenue)] py-2.5 pr-3 font-mono text-[12px] text-[var(--acero)]">
                      {m.role}
                    </td>
                    <td className="border-b border-[var(--linea-tenue)] py-2.5 pr-3 text-[var(--tenue)]">
                      {ALCANCE[m.scopeType] ?? m.scopeType}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* — Qué decide el paso — */}
      <div className="max-w-[66ch] border-l-2 border-[var(--acero)] py-1 pl-4">
        <p className="mb-3 text-[14px] text-[var(--texto)]">
          <b className="font-medium">En producción, estas membresías deciden qué abres.</b>
        </p>
        <p className="text-[13.5px] text-[var(--tenue)]">
          Las páginas y las rutas de API exigen sesión de Clerk y, con ella, miden tu alcance
          contra esta tabla. Fuera de producción el bypass de desarrollo ocupa el lugar de la
          sesión.
        </p>
      </div>

      <p className="mt-9 border-t border-[var(--linea)] pt-5 font-mono text-[11px] text-[var(--tenue)]">
        <Link
          href="/"
          className="cursor-pointer text-[var(--azul)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--azul)]"
        >
          ← Volver
        </Link>
      </p>
    </main>
  );
}
