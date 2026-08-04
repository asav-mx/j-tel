import Link from "next/link";
import { CorporateShell } from "@/components/unit-shell";
import { AvisoSistema } from "@/components/ui";
import { TiraCatorceDias } from "@/components/tira-catorce-dias";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { loadInicioCorporativo } from "@/lib/inicio-corporativo-data";
import { exigirSesion } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

/**
 * Inicio corporativo — "¿dónde tengo que mirar hoy?".
 *
 * Es para decidir dónde mirar, no para operar: cada sitio tiene su propio
 * panel, su cierre y su configuración.
 *
 * Dos cosas que esta pantalla dejó de hacer:
 *
 * - **Repetir la navegación en tarjetas.** "Administrar plantas" y "Reportes
 *   corporativos" vivían aquí como tarjetas *y* como renglones de nav.
 * - **Contar desde siempre.** Las cifras eran acumuladas y sin alcance
 *   temporal, que es §D del Marco: un dato correcto que alarma sin informar
 *   porque no dice de cuándo. Además sumaban lo *programado* junto a lo
 *   juzgado, inflando el total con servicios que todavía no ocurren.
 *
 * Y no muestra cifras de cumplimiento: eso espera la compuerta de Ola 2.
 */
export default async function ClienteInicioPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Sin sesión no se renderiza. Va en la PÁGINA y no solo en el layout:
  // un redirect de layout no impide que la hija se renderice, y su
  // payload —con datos reales dentro— viaja igual en la respuesta.
  await exigirSesion();

  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;

  const client = await resolveAccountByType("client", searchParams);
  if (!client) {
    return (
      <main className="p-8">
        <p>No hay cuentas cliente. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  const data = await loadInicioCorporativo(client.id, {
    nombre: client.name,
    slug: client.slug,
  });

  const sinAtender = data.pendientesAbiertos === 0;
  const peor = data.sitiosConPendientes[0];

  // El titular nombra el sitio que necesita atención. Si ninguno lo necesita,
  // lo dice: el silencio también es una respuesta, pero hay que enunciarla.
  const titular = sinAtender
    ? data.sitios.length === 1
      ? "Tu sitio está al corriente."
      : `Los ${data.sitios.length} sitios al corriente.`
    : `${peor!.nombre} necesita atención.`;

  const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

  return (
    <CorporateShell client={client} title={`${data.cuentaNombre} — Sitios`}>
      {error ? <AvisoSistema lead="No se guardó.">{error}</AvisoSistema> : null}

      <header>
        <h1 className="font-[family-name:var(--fuente-archivo)] text-2xl font-semibold text-[var(--texto)]">
          {titular}
        </h1>
        <p className="mt-1 font-[family-name:var(--fuente-mono)] text-xs tabular-nums text-[var(--tenue)]">
          {data.cuentaNombre} · {data.totalPlantas}{" "}
          {plural(data.totalPlantas, "planta", "plantas")} en {data.sitios.length}{" "}
          {plural(data.sitios.length, "sitio", "sitios")} · {data.transportistas.length}{" "}
          {plural(data.transportistas.length, "transportista", "transportistas")} · {data.fechaHoy}
        </p>
      </header>

      {/* El aviso: solo si hay algo que atender, con su antigüedad y su comparación. */}
      {!sinAtender ? (
        <section className="rounded-xl border border-[var(--b-ambar)] bg-[var(--t-ambar)] p-5">
          <p className="text-sm text-[var(--texto)]">
            <span className="font-[family-name:var(--fuente-mono)] tabular-nums">
              {data.pendientesAbiertos}
            </span>{" "}
            {plural(data.pendientesAbiertos, "servicio quedó", "servicios quedaron")} sin poder
            juzgarse por falta de evidencia
            {data.diasDelPendienteMasViejo != null ? (
              <>
                {" — el más viejo lleva "}
                <span className="font-[family-name:var(--fuente-mono)] tabular-nums">
                  {data.diasDelPendienteMasViejo}
                </span>
                {` ${plural(data.diasDelPendienteMasViejo, "día", "días")}`}
              </>
            ) : null}
            {/*
              La comparación solo aparece cuando compara algo. Con un único
              sitio con pendientes, nombrarlo repite el número que ya se dijo
              en la misma frase — y un dato que no agrega nada gasta la
              atención que el aviso necesita.
            */}
            {data.sitiosConPendientes.length > 1 ? (
              <>
                {" · "}
                {data.sitiosConPendientes
                  .slice(0, 2)
                  .map((s) => `${s.nombre} (${s.pendientes})`)
                  .join(" y ")}
                {data.sitiosConPendientes.length > 2
                  ? ` de ${data.sitiosConPendientes.length} sitios con pendientes`
                  : ""}
              </>
            ) : null}
            .
          </p>
          {/* Ley 7 del Marco, dicha en voz alta donde importa. */}
          <p className="mt-2 text-xs text-[var(--tenue)]">
            Sin evidencia no hay incumplimiento: estos servicios están pendientes, no reprobados.
          </p>
        </section>
      ) : null}

      {data.sitios.length === 0 ? (
        <div className="rounded-xl border border-[var(--linea)] bg-[var(--panel)] p-5">
          <p className="text-sm text-[var(--tenue)]">
            Todavía no hay sitios.{" "}
            <Link
              href={withAccount("/cliente/plantas", client.slug)}
              className="text-[var(--azul)] hover:underline"
            >
              Crea el primero
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.sitios.map((s) => (
            <Link
              key={`${s.unidad.kind}-${s.unidad.id}`}
              href={s.href}
              className="block rounded-xl border border-[var(--linea)] bg-[var(--panel)] p-5 transition hover:border-[var(--b-acero)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--azul)]"
            >
              <p className="font-[family-name:var(--fuente-mono)] text-[10.5px] uppercase tracking-[0.11em] text-[var(--tenue)]">
                {s.tipo}
                {s.unidad.kind === "plant_group"
                  ? ` · ${s.unidad.memberPlants.length} ${plural(s.unidad.memberPlants.length, "planta", "plantas")}`
                  : ` · ${s.unidad.code}`}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--texto)]">{s.unidad.name}</h2>
              <p className="mt-0.5 text-xs text-[var(--tenue)]">
                {s.transportistas.length > 0
                  ? s.transportistas.join(" · ")
                  : "Sin transportista configurado"}
              </p>

              <dl className="mt-4 grid grid-cols-3 gap-3">
                {(
                  [
                    ["Servicios hoy", s.hoy.servicios],
                    ["Pendientes hoy", s.hoy.pendientes],
                    ["Sin verificar hoy", s.hoy.sinVerificar],
                  ] as const
                ).map(([etiqueta, valor]) => (
                  <div key={etiqueta}>
                    <dt className="text-[10.5px] text-[var(--tenue)]">{etiqueta}</dt>
                    <dd className="font-[family-name:var(--fuente-mono)] text-xl tabular-nums text-[var(--acero)]">
                      {valor}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4">
                <TiraCatorceDias dias={s.tira} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Todo sumado — cuatro cifras del conjunto, en acero, cada una con su alcance. */}
      <section className="rounded-xl border border-[var(--linea)] bg-[var(--panel)] p-5">
        <h2 className="font-[family-name:var(--fuente-mono)] text-[10.5px] uppercase tracking-[0.11em] text-[var(--tenue)]">
          Todo sumado
        </h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {[
            { etiqueta: "Servicios hoy", valor: data.sumado.servicios, nota: data.fechaHoy },
            {
              etiqueta: "Servicios pendientes",
              valor: data.pendientesAbiertos,
              nota:
                data.diasDelPendienteMasViejo != null
                  ? `el más viejo lleva ${data.diasDelPendienteMasViejo} ${plural(data.diasDelPendienteMasViejo, "día", "días")}`
                  : "ninguno abierto",
            },
            { etiqueta: "Sin verificar hoy", valor: data.sumado.sinVerificar, nota: data.fechaHoy },
            {
              etiqueta: "Transportistas",
              valor: data.transportistas.length,
              nota: data.transportistas.join(" · ") || "ninguno",
            },
          ].map((c) => (
            <div key={c.etiqueta}>
              <dt className="text-xs text-[var(--tenue)]">{c.etiqueta}</dt>
              <dd className="font-[family-name:var(--fuente-mono)] text-2xl tabular-nums text-[var(--acero)]">
                {c.valor}
              </dd>
              <p className="mt-0.5 text-[10.5px] text-[var(--tenue)]">{c.nota}</p>
            </div>
          ))}
        </dl>
      </section>

      {/* Bloque reservado — §3.5. Se enuncia con su razón; no se dibuja. */}
      <section className="rounded-xl border border-dashed border-[var(--linea)] p-5">
        <h2 className="font-[family-name:var(--fuente-mono)] text-[10.5px] uppercase tracking-[0.11em] text-[var(--tenue)]">
          Reservado · comparar el cumplimiento entre sitios
        </h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[var(--tenue)]">
          Poner lado a lado el porcentaje de un campus contra el de una planta es la comparación de
          más peso que hace este producto — y por eso es la última que se muestra, no la primera.
        </p>
      </section>
    </CorporateShell>
  );
}
