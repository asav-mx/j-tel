import Link from "next/link";
import { headers } from "next/headers";
import { getRepos } from "@/lib/db";
import { getIdentidad } from "@/lib/auth";
import { etiquetaRol } from "@/lib/etiquetas-rol";
import { ENCABEZADO_RUTA } from "@/middleware";

/**
 * La navegación lateral permanente — 230px, siempre presente.
 *
 * Del skill j-telemetry-ui, "La arquitectura de la plataforma": J-Telemetry no
 * es un conjunto de páginas sino una plataforma, y eso tiene que sentirse al
 * abrirla. De arriba abajo: identidad del producto, dónde estoy parado, las
 * secciones agrupadas por naturaleza, y quién soy.
 *
 * Debajo de 720px la columna se colapsa a una tira horizontal, con una fila
 * compacta arriba que conserva cuenta, regreso e identidad. **Es deuda
 * declarada, no una excepción:** una tira de botones es justo lo que el skill
 * prohíbe. Vive aquí hasta que se diseñe móvil, que es requisito y no extra.
 */

export type RenglonNav = { href: string; label: string };
export type GrupoNav = { titulo: string; renglones: RenglonNav[] };

type Identidad = { userId: string; roles: string[] };

/** El renglón activo: coincidencia exacta, o un ancestro del camino actual. */
function esActivo(href: string, rutaActual: string, raiz: string): boolean {
  const ruta = href.split("?")[0]!;
  if (ruta === rutaActual) return true;
  // El inicio de la unidad es prefijo de todo lo demás: solo marca exacto.
  if (ruta === raiz) return false;
  return rutaActual.startsWith(`${ruta}/`);
}

/**
 * Quién soy. Mientras no exista el nombre propio, el rol — con auth-rbac el
 * nombre entra aquí sin cambiar el componente.
 */
function Usuario({ id, compacta = false }: { id: Identidad; compacta?: boolean }) {
  const rol = id.roles.length > 0 ? id.roles.join(" · ") : "Sin membresías";

  return (
    <Link
      href="/quien-soy"
      title={`${id.userId} · ${rol}`}
      className={`flex cursor-pointer items-center gap-2.5 transition-colors hover:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--azul)] ${
        compacta ? "rounded-sm px-1.5 py-1" : "border-t border-[var(--linea)] px-3.5 py-3"
      }`}
    >
      <span
        aria-hidden="true"
        className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--t-acero)] font-mono text-[11px] text-[var(--acero)]"
      >
        {id.userId.slice(0, 2).toUpperCase()}
      </span>
      {compacta ? null : (
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-mono text-[11px] text-[var(--texto)]">
            {id.userId}
          </span>
          <span className="block truncate text-[11px] text-[var(--tenue)]">{rol}</span>
        </span>
      )}
    </Link>
  );
}

export async function NavLateral({
  cuenta,
  grupos,
  raiz,
  contexto,
  regreso,
}: {
  /** La cuenta cliente en curso. */
  cuenta: { slug: string; name: string };
  grupos: GrupoNav[];
  /** Ruta de inicio de esta unidad; no se marca activa por prefijo. */
  raiz: string;
  /** Dónde estoy parado dentro de la cuenta: "Planta: X" / "Campus: X". */
  contexto?: string | null;
  /** Subir al panorama corporativo. Fuera de los grupos: es cambio de alcance. */
  regreso?: { href: string; label: string } | null;
}) {
  const [cabeceras, cuentas, identidad] = await Promise.all([
    headers(),
    getRepos().accounts.listByType("client"),
    getIdentidad(),
  ]);
  const rutaActual = cabeceras.get(ENCABEZADO_RUTA) ?? "";
  const id: Identidad = {
    userId: identidad.userId,
    roles: [...new Set(identidad.memberships.map((m) => etiquetaRol(m.role)))],
  };

  return (
    <nav
      aria-label="Secciones"
      className="flex shrink-0 flex-col border-b border-[var(--linea)] bg-[var(--nav-bg)] min-[720px]:sticky min-[720px]:top-0 min-[720px]:h-screen min-[720px]:w-[230px] min-[720px]:border-r min-[720px]:border-b-0"
    >
      {/* Móvil · una fila compacta que conserva lo que la columna dice arriba y abajo */}
      <div className="flex items-center gap-2 border-b border-[var(--linea)] px-3 py-1.5 min-[720px]:hidden">
        <Link
          href="/"
          className="flex-none cursor-pointer font-[family-name:var(--fuente-archivo)] text-[13px] font-bold tracking-[-0.02em] text-[var(--texto)]"
        >
          JTEL
        </Link>
        {/* Solo la cuenta: la unidad ya la dice el título de la pantalla, y a
            375px repetirla empuja el regreso y la identidad fuera de la fila. */}
        <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--tenue)]">
          {cuenta.name}
        </span>
        {regreso ? (
          <Link
            href={regreso.href}
            className="flex-none cursor-pointer text-[11px] whitespace-nowrap text-[var(--tenue)] transition-colors hover:text-[var(--azul)]"
          >
            ← {regreso.label}
          </Link>
        ) : null}
        <Usuario id={id} compacta />
      </div>

      {/* 1 · Identidad del producto */}
      <Link
        href="/"
        className="hidden cursor-pointer px-3.5 py-4 font-[family-name:var(--fuente-archivo)] text-[15px] font-bold tracking-[-0.02em] text-[var(--texto)] transition-colors hover:text-[var(--azul)] min-[720px]:block"
      >
        JTEL
      </Link>

      {/* 2 · Dónde estoy parado — y el cambio de alcance, que no es una sección */}
      <div className="hidden border-y border-[var(--linea)] px-3.5 py-3 min-[720px]:block">
        <p className="truncate text-[12px] text-[var(--texto)]">{cuenta.name}</p>
        {contexto ? (
          <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--tenue)]">{contexto}</p>
        ) : null}

        {cuentas.length > 1 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {cuentas.map((c) => (
              <a
                key={c.id}
                href={`/cliente?account=${c.slug}`}
                className={`cursor-pointer rounded-sm px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                  c.slug === cuenta.slug
                    ? "bg-[var(--t-acero)] text-[var(--acero)]"
                    : "text-[var(--tenue)] hover:bg-[var(--hover)] hover:text-[var(--texto)]"
                }`}
              >
                {c.name}
              </a>
            ))}
          </div>
        ) : null}

        {regreso ? (
          <Link
            href={regreso.href}
            className="mt-2 inline-flex cursor-pointer items-center gap-1 text-[11px] text-[var(--tenue)] transition-colors hover:text-[var(--azul)]"
          >
            ← {regreso.label}
          </Link>
        ) : null}
      </div>

      {/* 3 · Las secciones, agrupadas por naturaleza */}
      <div className="flex flex-1 flex-row gap-0.5 overflow-x-auto px-2 py-2 min-[720px]:flex-col min-[720px]:gap-0 min-[720px]:overflow-x-visible min-[720px]:overflow-y-auto min-[720px]:px-0 min-[720px]:py-2">
        {grupos.map((grupo) => (
          <div key={grupo.titulo} className="contents min-[720px]:mb-3 min-[720px]:block">
            <p className="hidden px-3.5 pb-1.5 font-mono text-[10px] tracking-[0.13em] text-[var(--tenue)] uppercase min-[720px]:block">
              {grupo.titulo}
            </p>
            {grupo.renglones.map((r) => {
              const activo = esActivo(r.href, rutaActual, raiz);
              return (
                <Link
                  key={r.href}
                  href={r.href}
                  aria-current={activo ? "page" : undefined}
                  className={`relative block cursor-pointer rounded-sm px-3.5 py-1.5 text-[13px] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--azul)] min-[720px]:rounded-none ${
                    activo
                      ? "bg-[var(--t-acero)] text-[var(--texto)]"
                      : "text-[var(--tenue)] hover:bg-[var(--hover)] hover:text-[var(--texto)]"
                  }`}
                >
                  {/* La sección actual lleva barra de acero al borde izquierdo,
                      nunca solo negritas. */}
                  {activo ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 hidden w-[2px] bg-[var(--acero)] min-[720px]:block"
                    />
                  ) : null}
                  {r.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* 4 · Quién soy */}
      <div className="hidden min-[720px]:block">
        <Usuario id={id} />
      </div>
    </nav>
  );
}
