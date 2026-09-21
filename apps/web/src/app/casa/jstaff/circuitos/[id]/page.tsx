import Link from "next/link";
import { notFound } from "next/navigation";
import { loMinimoParaMedir } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { AvisoDeError, Renglon, Titular, Vacio } from "@/components/casa/expediente";
import { clases } from "@/components/casa/formulario";
import { CadenaEnEslabones } from "@/components/casa/cadena-del-circuito";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { cadenaDelCircuito, loQueFaltaEnPalabras, type Eslabon } from "@/lib/casa/cadena-del-circuito";

export const dynamic = "force-dynamic";

/**
 * Ver ‹circuito› — el expediente de J-Staff en su casa nueva (PR A1 de la ficha
 * de Circuitos, 21-sep-2026).
 *
 * **La cadena de siete pasos arriba**, cada uno con su estado, y la frase de lo
 * que falta para medir. Esa frase sale de `loMinimoParaMedir` (capa de
 * servicios): la misma definición que decide la caja vacía de la torre y su
 * aviso de «sin unidades». Dos definiciones se separan el primer mes.
 *
 * **En A1 sólo Publicar escribe desde aquí**, con la ruta de siempre. Los
 * demás pasos enseñan lo que hay y llevan a su parte de la pantalla vieja, que
 * sigue viva: unidades y promesa se mudan en A2, trazado y paradas en A3.
 *
 * **Publicar no exige nada** (ASAV, 21-sep: la decisión escrita en la ruta de
 * publicación se queda). Es acto de quien opera; la cadena enuncia lo que
 * falta y no cierra la puerta.
 */
export default async function VerCircuitoJStaff({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirEnPagina({ tipo: "jstaff" });
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const repos = getRepos();
  const circuito = await repos.circuits.getCircuit(id);
  if (!circuito) notFound();

  const [concesion, trazados, paradas, asignaciones, promesa] = await Promise.all([
    repos.accounts.findById(circuito.concessionAccountId),
    repos.circuits.getPaths(id),
    repos.circuits.listStopsVigentes(id),
    repos.circuits.listAssignments(id),
    repos.circuits.getPromiseTableVigente(id),
  ]);
  const vigentes = asignaciones.filter((a) => a.validTo === null);
  const publicado = circuito.publishedAt !== null;

  const minimo = loMinimoParaMedir({
    trazados: trazados.map((t) => ({ sentido: t.sentido as "ida" | "vuelta", puntos: t.pointCount })),
    paradas: paradas.map((p) => ({ sentido: p.sentido as "ida" | "vuelta" | null })),
    franjasDeLaPromesa: promesa ? promesa.bandas.length : null,
    unidadesAsignadas: vigentes.length,
  });
  const cadena = cadenaDelCircuito({
    trazados: trazados.map((t) => ({ sentido: t.sentido as "ida" | "vuelta", puntos: t.pointCount })),
    paradas: paradas.map((p) => ({ sentido: p.sentido as "ida" | "vuelta" | null })),
    franjasDeLaPromesa: promesa ? promesa.bandas.length : null,
    unidadesAsignadas: vigentes.length,
    publicado,
    minimo,
  });
  const eslabon = (paso: Eslabon["paso"]) => cadena.find((e) => e.paso === paso)!;

  const zona = circuito.timeZone;
  const horario = `${circuito.serviceStartLocal.slice(0, 5)}–${circuito.serviceEndLocal.slice(0, 5)}`;
  const dia = (d: Date) =>
    new Intl.DateTimeFormat("es-MX", { timeZone: zona, day: "numeric", month: "short", year: "numeric" }).format(d);
  const vieja = `/jstaff/circuitos/${id}`;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const porSentido = (s: "ida" | "vuelta") => paradas.filter((p) => p.sentido === s || p.sentido === null).length;

  return (
    <Marco casa={CASAS.jstaff} alcance={ALCANCE_SIN_CUENTA} lugar="/casa/jstaff/circuitos">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <Migas pasos={[{ nombre: "Circuitos", ruta: "/casa/jstaff/circuitos" }, { nombre: circuito.name }]} />
        <Titular nombre={`Ver ${circuito.name}`} bajo={`${concesion?.name ?? "concesión sin nombre"} · ${circuito.publicSlug}`} />

        {ok && (
          <p role="status" className={clases.aviso}>
            {ok}
          </p>
        )}
        {error && <AvisoDeError mensaje={error} />}

        <CadenaEnEslabones eslabones={cadena} />
        <p className={`text-[14px] ${minimo.listo ? "text-[var(--tenue)]" : ""}`}>{loQueFaltaEnPalabras(minimo)}</p>

        <Paso eslabon={eslabon(1)} titulo="Identidad">
          <Renglon pregunta="Nombre">{circuito.name}</Renglon>
          <Renglon pregunta="Identificador público" medida>
            {circuito.publicSlug}
          </Renglon>
          <Renglon pregunta="Concesión dueña">{concesion?.name ?? "—"}</Renglon>
          <Renglon pregunta="Horario de servicio" medida>
            {horario} · {zona}
          </Renglon>
          <Renglon pregunta="Color">
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-3.5 w-3.5 rounded-full border border-[var(--linea)]"
                style={{ background: circuito.colorHex }}
              />
              <span data-medida>{circuito.colorHex}</span>
            </span>
          </Renglon>
          <SeEditaEnLaVieja ruta={vieja} />
        </Paso>

        <Paso eslabon={eslabon(2)} titulo="Trazado">
          {(["ida", "vuelta"] as const).map((s) => {
            const t = trazados.find((x) => x.sentido === s);
            return (
              <Renglon key={s} pregunta={s === "ida" ? "Ida" : "Vuelta"} medida={Boolean(t)} tenue={!t}>
                {t ? `${(t.lengthMeters / 1000).toFixed(1)} km · ${t.pointCount} puntos` : "sin trazado"}
              </Renglon>
            );
          })}
          <SeEditaEnLaVieja ruta={vieja} que="Se sube" />
        </Paso>

        <Paso eslabon={eslabon(3)} titulo="Paradas">
          {paradas.length === 0 ? (
            <Vacio>Sin paradas capturadas</Vacio>
          ) : (
            <>
              <Renglon pregunta="De ida (o de los dos)" medida>
                {porSentido("ida")}
              </Renglon>
              <Renglon pregunta="De vuelta (o de los dos)" medida>
                {porSentido("vuelta")}
              </Renglon>
              <Renglon pregunta="Sentidos que se pueden medir" tenue={minimo.carriles.length === 0}>
                {minimo.carriles.length === 0
                  ? "ninguno: hacen falta dos paradas sobre el trazado de un sentido"
                  : minimo.carriles.join(" y ")}
              </Renglon>
            </>
          )}
          <SeEditaEnLaVieja ruta={vieja} que="Se ponen" />
        </Paso>

        <Paso eslabon={eslabon(4)} titulo="Promesa por franja">
          {promesa === null ? (
            <Vacio>Sin promesa capturada</Vacio>
          ) : (
            <>
              <Renglon pregunta="Franjas vigentes" medida tenue={promesa.bandas.length === 0}>
                {promesa.bandas.length === 0 ? "ninguna" : promesa.bandas.length}
              </Renglon>
              <Renglon pregunta="Vigente desde" medida>
                {dia(promesa.tabla.validFrom)}
              </Renglon>
            </>
          )}
          <SeEditaEnLaVieja ruta={vieja} que="Se captura" />
        </Paso>

        <Paso eslabon={eslabon(5)} titulo="Unidades asignadas">
          {vigentes.length === 0 ? (
            <Vacio>Sin unidades asignadas</Vacio>
          ) : (
            vigentes.map((a) => (
              <Renglon key={a.id} pregunta={`${a.unitLabel} · ${a.carrierName}`} medida>
                asignada desde {dia(a.validFrom)}
              </Renglon>
            ))
          )}
          <SeEditaEnLaVieja ruta={vieja} que="Se asignan" />
        </Paso>

        <Paso eslabon={eslabon(6)} titulo="Medición">
          {/* Una columna y no pregunta · respuesta: la lista de lo que falta no cabe a la derecha en celular. */}
          <div className="rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-2.5 text-[14px]">
            {minimo.listo ? (
              <span className="text-[var(--tenue)]">Tiene lo mínimo para medir: la torre puede medirlo.</span>
            ) : (
              <ul className="flex flex-col gap-1">
                {minimo.faltan.map((f) => (
                  <li key={f.requisito}>{f.frase}</li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-[13px]">
            <Link href={`/jstaff/circuitos/${id}/operar`} className="underline underline-offset-2">
              Ver la operación en la pantalla de siempre →
            </Link>
          </p>
        </Paso>

        <Paso eslabon={eslabon(7)} titulo="Publicar">
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-3.5">
            <span className="min-w-0 flex-1">
              <span
                className="block text-[16px]"
                style={{ fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.01em" }}
              >
                {publicado ? "Publicado — ya lo ve alguien." : "Sin publicar — nadie lo ve todavía."}
              </span>
              <span className="mt-1 block text-[13px] text-[var(--tenue)]">
                {publicado
                  ? `Desde el ${dia(circuito.publishedAt!)} está en la app del pasajero. Despublicar lo quita al instante y no borra nada.`
                  : "Para la app del pasajero no existe. Publicar es decisión de quien opera: lo que falta arriba no cierra la puerta."}
              </span>
              <span data-medida className="mt-1.5 block text-[12.5px]">
                horario {horario} · {zona}
              </span>
            </span>
            <form action={`/api/jstaff/circuitos/${id}/publicacion`} method="post">
              <input type="hidden" name="publicar" value={publicado ? "no" : "si"} />
              <input type="hidden" name="volver" value={`/casa/jstaff/circuitos/${id}`} />
              <button type="submit" className={publicado ? clases.secundario : clases.primario}>
                {publicado ? "Despublicar" : "Publicar"}
              </button>
            </form>
          </div>
        </Paso>
      </div>
    </Marco>
  );
}

/** Un paso de la cadena: su número, su nombre y su estado — en tinta si pide algo. */
function Paso({ eslabon, titulo, children }: { eslabon: Eslabon; titulo: string; children: React.ReactNode }) {
  return (
    <section id={eslabon.ancla} aria-label={titulo} className="mt-3 flex scroll-mt-6 flex-col gap-2">
      <div className="flex items-baseline gap-2.5">
        <span data-medida className="text-[12px] text-[var(--tenue)]">
          {eslabon.paso}
        </span>
        <h2 className="text-[16px]" style={{ fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.01em" }}>
          {titulo}
        </h2>
        <span
          data-medida
          className={`ml-auto text-[10.5px] uppercase tracking-[0.14em] ${eslabon.pide ? "font-semibold text-[var(--tinta)]" : "text-[var(--tenue)]"}`}
        >
          {eslabon.resumen}
        </span>
      </div>
      {children}
    </section>
  );
}

/** Mientras el paso no se muda (A2, A3), se edita donde siempre. */
function SeEditaEnLaVieja({ ruta, que = "Se edita" }: { ruta: string; que?: string }) {
  return (
    <p className="text-[13px] text-[var(--tenue)]">
      {que} en la pantalla de siempre ·{" "}
      <Link href={ruta} className="text-[var(--tinta)] underline underline-offset-2">
        abrir →
      </Link>
    </p>
  );
}
