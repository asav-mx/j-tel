/**
 * El marco de toda superficie interna: navegación lateral, encabezado, y la
 * zona de contenido.
 *
 * Existe para que el marco se escriba una sola vez. Antes cada pantalla
 * repetía su propio `<main className="min-h-screen p-8">` con su contenedor de
 * ancho, y la navegación se renderizaba *dentro* de ese contenedor centrado —
 * por eso una columna de 230px no cabía sin invertir la relación.
 */

export function EncabezadoApp({
  titulo,
  contexto,
  accion,
}: {
  titulo: string;
  /** La línea que sitúa: cuenta, unidad, turno vigente. */
  contexto?: React.ReactNode;
  /** Una sola acción, a la derecha. */
  accion?: React.ReactNode;
}) {
  return (
    <header className="border-b border-[var(--linea)] px-6 py-5 min-[720px]:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--fuente-archivo)] text-[22px] leading-tight font-bold tracking-[-0.03em] text-[var(--texto)]">
            {titulo}
          </h1>
          {contexto ? (
            <div className="mt-1 text-[13px] text-[var(--tenue)]">{contexto}</div>
          ) : null}
        </div>
        {accion ? <div className="flex-none">{accion}</div> : null}
      </div>
    </header>
  );
}

export function MarcoPlataforma({
  nav,
  titulo,
  contexto,
  accion,
  children,
}: {
  nav: React.ReactNode;
  titulo: string;
  contexto?: React.ReactNode;
  accion?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--fondo)] min-[720px]:flex-row">
      {nav}
      <div className="flex min-w-0 flex-1 flex-col">
        <EncabezadoApp titulo={titulo} contexto={contexto} accion={accion} />
        <main className="flex-1 px-6 py-6 min-[720px]:px-8">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
