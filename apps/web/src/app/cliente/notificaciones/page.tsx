import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { DateRangeFilter } from "@/components/date-range-filter";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { inCreatedAtRange, resolveDateRange } from "@/lib/date-range";
import { exigirSesion } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

/**
 * Tope de filas que se traen y se pintan. Generoso para el uso real —un rango
 * de un mes rara vez pasa de unas decenas— y a la vez una valla contra volver
 * a materializar el historial entero.
 */
const MAX_EN_PANTALLA = 500;

export default async function ClienteNotificacionesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Sin sesión no se renderiza. Va en la PÁGINA y no solo en el layout:
  // un redirect de layout no impide que la hija se renderice, y su
  // payload —con datos reales dentro— viaja igual en la respuesta.
  await exigirSesion();

  const sp = searchParams ? await searchParams : undefined;
  const range = resolveDateRange(sp, { defaultDaysBack: 29 });

  const repos = getRepos();
  const client = await resolveAccountByType("client", searchParams);

  // La ventana se acota en la base. Traerlas todas y filtrar aquí fue lo que
  // dejó sin memoria a esta página: 159 815 filas para pintar veintitantas.
  // Se piden ±1 día de más porque el corte fino por día civil lo hace
  // `inCreatedAtRange` con la zona del cliente, y los husos mueven el borde.
  const desde = new Date(`${range.fromIso}T00:00:00Z`);
  desde.setUTCDate(desde.getUTCDate() - 1);
  const hasta = new Date(`${range.toIso}T23:59:59.999Z`);
  hasta.setUTCDate(hasta.getUTCDate() + 1);

  const { filas, hayMas } = client
    ? await repos.notifications.findForAccountInWindow(client.id, desde, hasta, MAX_EN_PANTALLA)
    : { filas: [], hayMas: false };

  const notifications = filas
    .filter((n) => inCreatedAtRange(n.createdAt, range.fromIso, range.toIso))
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  // Si se truncó, el rótulo lo dice. El conteo sería correcto como consulta y
  // falso como afirmación: promete "las de este rango" y enseña las que cupieron.
  const conteo = hayMas ? `${notifications.length}+` : `${notifications.length}`;

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <AppNav
          title="Notificaciones"
          links={[{ href: withAccount("/cliente/cumplimiento", client?.slug), label: "← Cumplimiento" }]}
        />

        <DateRangeFilter
          action="/cliente/notificaciones"
          range={range}
          hidden={{ account: client?.slug }}
        />

        <Card title={`Notificaciones — ${range.label} (${conteo})`}>
          {hayMas ? (
            <p className="mb-4 text-sm text-[var(--muted)]">
              Hay más de {MAX_EN_PANTALLA} notificaciones en este rango. Se muestran las{" "}
              {MAX_EN_PANTALLA} más recientes; acota el rango para verlas todas.
            </p>
          ) : null}
          <ul className="space-y-4">
            {notifications.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">
                Sin notificaciones en este rango.
              </li>
            ) : (
              notifications.map((n) => (
                <li key={n.id} className="rounded-lg border border-[var(--linea-tenue)] p-4">
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{n.body}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {new Date(n.createdAt).toLocaleString("es-MX")} · {n.type}
                  </p>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </main>
  );
}
