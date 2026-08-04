import { getRepos } from "@/lib/db";
import { isEncryptionConfigured } from "@jtel/db";
import { AppNav, AvisoSistema, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { exigirSesion } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-[var(--linea)] bg-black/20 p-2 text-sm placeholder:text-[var(--tenue)]";
const labelClass = "block text-sm";
const btnClass =
  "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90";

export default async function CarrierGpsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Sin sesión no se renderiza. Va en la PÁGINA y no solo en el layout:
  // un redirect de layout no impide que la hija se renderice, y su payload
  // viaja igual en la respuesta (regla 7 del plan).
  await exigirSesion();

  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const saved = typeof sp?.saved === "string" ? sp.saved : null;

  const repos = getRepos();
  const carrier = await resolveAccountByType("carrier", searchParams);

  if (!carrier) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-3xl">
          <AppNav title="Proveedor GPS" links={[{ href: "/carrier", label: "← Panel" }]} />
          <Card title="Sin carrier">
            <p className="text-sm text-[var(--muted)]">
              No hay cuentas carrier. Crea una en J-Staff → Cuentas.
            </p>
          </Card>
        </div>
      </main>
    );
  }

  const creds = await repos.carriers.getGpsCredentials(carrier.id);
  const encryptionReady = isEncryptionConfigured();

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <AppNav
          title="Proveedor GPS"
          links={[{ href: withAccount("/carrier", carrier.slug), label: "← Panel" }]}
        />

        <p className="text-sm text-[var(--muted)]">
          Carrier: <span className="text-[var(--texto)]">{carrier.name}</span>. Aquí guardas las credenciales
          de tu proveedor de GPS. El verificador las usa para leer la evidencia de tus unidades. La
          contraseña se guarda cifrada.
        </p>

        {!encryptionReady ? (
          <AvisoSistema lead="Guardar está deshabilitado.">
            El servidor todavía no tiene configurada la llave de cifrado (JTEL_SECRET_KEY). Se
            habilita en cuanto el equipo de J-Tel la configure.
          </AvisoSistema>
        ) : null}
        {error ? <AvisoSistema lead="No se guardó.">{error}</AvisoSistema> : null}
        {saved ? (
          <AvisoSistema lead="Guardado.">
            Credenciales guardadas. El verificador ya las usará para este carrier.
          </AvisoSistema>
        ) : null}

        <Card
          title={
            creds
              ? `Credenciales configuradas (${creds.provider})`
              : "Configurar credenciales"
          }
        >
          <form action="/api/carrier/gps" method="post" className="space-y-4">
            <input type="hidden" name="carrierSlug" value={carrier.slug} />
            <label className={labelClass}>
              Proveedor de GPS
              <select
                name="provider"
                className={inputClass}
                defaultValue={creds?.provider ?? "umbrella"}
              >
                <option value="umbrella">Umbrella Soluciones</option>
                <option value="otro" disabled>
                  Otro (próximamente)
                </option>
              </select>
            </label>
            <label className={labelClass}>
              Usuario del proveedor
              <input
                name="userId"
                required
                className={inputClass}
                placeholder="Ej. A1339"
                defaultValue={creds?.userId ?? ""}
              />
            </label>
            <label className={labelClass}>
              Contraseña
              <input
                name="password"
                type="password"
                className={inputClass}
                placeholder={creds ? "•••••• (dejar vacío para conservar la actual)" : "Contraseña del proveedor"}
              />
            </label>
            <label className={labelClass}>
              URL del proveedor (opcional)
              <input
                name="baseUrl"
                className={inputClass}
                placeholder="Ej. http://gps2.umbrellasoluciones.com/openapi"
                defaultValue={creds?.baseUrl ?? ""}
              />
              <span className="mt-1 block text-xs text-[var(--muted)]">
                Déjalo vacío para usar la URL por defecto de Umbrella.
              </span>
            </label>
            <button type="submit" className={btnClass} disabled={!encryptionReady}>
              Guardar credenciales
            </button>
          </form>
        </Card>

        <Card title="¿Cómo funciona?">
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
            <li>Cada carrier usa su propio proveedor y sus propias credenciales.</li>
            <li>La contraseña nunca se muestra de vuelta ni se guarda en texto plano.</li>
            <li>
              El verificador automático usa estas credenciales para leer el GPS de las unidades de
              este carrier.
            </li>
          </ul>
        </Card>
      </div>
    </main>
  );
}
