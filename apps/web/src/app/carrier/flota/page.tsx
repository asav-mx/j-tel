import Link from "next/link";
import { CarrierShell } from "@/components/unit-shell";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { loadUnidades, LENTES } from "@/lib/unidades-explorador-data";

export const dynamic = "force-dynamic";

const TH_BASE =
  "px-4 py-3 font-[family-name:var(--fuente-mono)] text-[10.5px] font-medium uppercase tracking-[0.11em] text-[var(--tenue)]";
const TH = `${TH_BASE} text-right`;
const TD = "px-4 py-2.5 text-right font-[family-name:var(--fuente-mono)] tabular-nums";

/**
 * Unidades — ¿cuáles me interesan?
 *
 * El nivel intermedio de la flota: el mapa muestra dónde está todo, el
 * expediente muestra una. **Comparar unidades entre sí no tenía dónde ocurrir.**
 *
 * Arriba van preguntas, no filtros. La lente no filtra la flota — cambia lo
 * que se pregunta de ella, y por eso la tabla siempre trae todas las unidades
 * aunque cambien el orden y las columnas.
 *
 * Todo en acero: son medidas, no veredictos. El ámbar marca lo que necesita
 * atención —cero días con servicio, un hueco largo— **nunca una falta.**
 */
export default async function CarrierUnidadesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const carrier = await resolveAccountByType("carrier", searchParams);
  if (!carrier) {
    return (
      <main className="p-8">
        <p className="text-sm">Sin cuentas de transportista. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  const lenteParam = typeof sp?.lente === "string" ? sp.lente : undefined;
  const data = await loadUnidades(carrier, { lente: lenteParam });

  return (
    <CarrierShell
      carrier={carrier}
      title={`${carrier.name} — Unidades`}
      accion={
        <Link
          href={withAccount("/carrier/flota/alta", carrier.slug)}
          className="rounded-sm border border-[var(--linea-fuerte)] px-3 py-1.5 text-xs text-[var(--azul)] transition-colors hover:bg-[var(--hover)]"
        >
          Alta de flota
        </Link>
      }
    >
      <header>
        <h1 className="font-[family-name:var(--fuente-archivo)] text-2xl font-semibold text-[var(--texto)]">
          {data.titular}
        </h1>
        <p className="mt-1 font-[family-name:var(--fuente-mono)] text-xs tabular-nums text-[var(--tenue)]">
          {data.filas.length} unidades · {data.desde} → {data.hasta} · {data.diasOperacion} días con
          servicios contratados de {data.diasPeriodo}
        </p>
        {/* El alcance va junto al titular, no al pie: es lo que decide cómo se
            lee cada cero de la tabla. */}
        <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-[var(--tenue)]">
          {data.alcance}
        </p>
      </header>

      {/* Las lentes: preguntas, no filtros. */}
      <nav aria-label="Lentes" className="flex flex-wrap gap-2">
        {LENTES.map((l) =>
          l.disponible ? (
            <Link
              key={l.clave}
              href={withAccount(`/carrier/flota?lente=${l.clave}`, carrier.slug)}
              aria-current={l.clave === data.lente ? "page" : undefined}
              className={`rounded-sm border px-3 py-1.5 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--azul)] ${
                l.clave === data.lente
                  ? "border-[var(--b-acero)] bg-[var(--t-acero)] text-[var(--acero)]"
                  : "border-[var(--linea-fuerte)] text-[var(--tenue)] hover:bg-[var(--hover)] hover:text-[var(--texto)]"
              }`}
            >
              {l.pregunta}
            </Link>
          ) : (
            <span
              key={l.clave}
              className="rounded-sm border border-dashed border-[var(--linea-fuerte)] px-3 py-1.5 text-xs text-[var(--tenue)]"
            >
              {l.pregunta}
              <span className="ml-2 font-[family-name:var(--fuente-mono)] text-[10px] uppercase tracking-[0.11em]">
                reservada
              </span>
            </span>
          ),
        )}
      </nav>

      {/* La lente reservada dice su razón donde se lee, no escondida en un title. */}
      <p className="max-w-3xl text-[11px] leading-relaxed text-[var(--tenue)]">
        <span className="font-[family-name:var(--fuente-mono)] uppercase tracking-[0.11em]">
          ¿Cuáles me cuestan?
        </span>{" "}
        — {data.razonReservada}
      </p>

      {data.vacio ? (
        <div className="rounded-xl border border-dashed border-[var(--linea)] p-8 text-center">
          <p className="mx-auto max-w-xl text-sm text-[var(--tenue)]">{data.vacio}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--linea)] bg-[var(--panel)]">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--linea)]">
                <th className={`${TH_BASE} text-left`} scope="col">
                  Unidad
                </th>
                {data.lente === "trabajan" ? (
                  <>
                    <th className={TH} scope="col">Días con servicio</th>
                    <th className={TH} scope="col">Servicios</th>
                  </>
                ) : data.lente === "gastan" ? (
                  <>
                    <th className={TH} scope="col">Litros</th>
                    <th className={TH} scope="col">Costo</th>
                  </>
                ) : (
                  <>
                    <th className={TH} scope="col">Último dato</th>
                    <th className={TH} scope="col">Taller</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--linea-tenue)]">
              {data.filas.map((f) => (
                <tr key={f.id} className="transition-colors hover:bg-[var(--hover)]">
                  <td className="px-4 py-2.5">
                    <Link
                      href={withAccount(`/carrier/historial/${f.id}`, carrier.slug)}
                      className="text-[var(--texto)] hover:text-[var(--azul)] hover:underline"
                    >
                      {f.label}
                    </Link>
                    {f.placa ? (
                      <span className="ml-2 font-[family-name:var(--fuente-mono)] text-[11px] text-[var(--tenue)]">
                        {f.placa}
                      </span>
                    ) : null}
                  </td>
                  {data.lente === "trabajan" ? (
                    <>
                      {/* Todo en acero. El ámbar estuvo aquí marcando "0 días
                          con servicio" y se quitó por medición: más de la mitad
                          de la flota tiene cero porque hace trabajo fuera de lo
                          contratado, no porque falle. Ámbar sobre la mayoría no
                          llama la atención — imputa. */}
                      <td className={`${TD} text-[var(--acero)]`}>
                        {f.diasConServicio} de {data.diasOperacion}
                      </td>
                      <td className={`${TD} text-[var(--acero)]`}>{f.servicios}</td>
                    </>
                  ) : data.lente === "gastan" ? (
                    <>
                      <td className={`${TD} text-[var(--acero)]`}>
                        {f.litros > 0 ? f.litros.toFixed(1) : "—"}
                      </td>
                      <td className={`${TD} text-[var(--acero)]`}>
                        {f.costoDiesel > 0 ? f.costoDiesel.toFixed(2) : "—"}
                      </td>
                    </>
                  ) : (
                    <>
                      <td
                        className={`${TD} text-[11px] ${
                          f.ultimoDatoTexto ? "text-[var(--acero)]" : "text-[var(--ambar)]"
                        }`}
                      >
                        {f.ultimoDatoTexto ?? "nunca reportó"}
                      </td>
                      <td className={`${TD} text-[11px] text-[var(--tenue)]`}>
                        {f.enTaller ? "en taller" : "—"}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="max-w-3xl text-[11px] leading-relaxed text-[var(--tenue)]">
        Las medidas se enuncian, no se juzgan: &quot;0 de {data.diasOperacion} días con
        servicio&quot; dice lo que pasó, y la conclusión es de quien mira. Faltan columnas a propósito:
        &quot;horas en patio&quot; y &quot;kilómetro muerto&quot; necesitan el concepto de parada
        del Workbench, que todavía no existe; y kilómetros y huecos de señal se midieron en
        seis segundos sobre treinta días, así que no se sostienen todavía. Una columna que
        tarda seis segundos, o que va vacía, es peor que una tabla más corta.
      </p>
    </CarrierShell>
  );
}
