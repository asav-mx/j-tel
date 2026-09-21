import Link from "next/link";
import { loMinimoParaMedir } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { Titular, Vacio } from "@/components/casa/expediente";
import { clases } from "@/components/casa/formulario";
import { CadenaEnLinea } from "@/components/casa/cadena-del-circuito";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { cadenaDelCircuito } from "@/lib/casa/cadena-del-circuito";

export const dynamic = "force-dynamic";

/**
 * Circuitos — J-Staff, en su casa nueva (PR A1 de la ficha de Circuitos,
 * 21-sep-2026).
 *
 * Cada circuito con su cadena en una línea —trazado · paradas · promesa ·
 * unidades— y su publicación. Tocar uno abre su expediente.
 *
 * **«Nuevo circuito» va aparte, arriba**, y abre su propia pantalla: nunca un
 * formulario abierto al pie de la lista. En la pantalla vieja ese formulario
 * casi provoca un circuito duplicado.
 *
 * **Sin muro, porque es J-Staff** (la concesión es J-Tel): la lectura es
 * `resumenDeCircuitosParaJStaff`, amarrada a esta cara por la valla
 * `guardia-muro-cuenta`. La pantalla vieja (`/jstaff/circuitos`) sigue viva
 * hasta el PR D.
 */
export default async function CircuitosJStaff() {
  await exigirEnPagina({ tipo: "jstaff" });
  const circuitos = await getRepos().circuits.resumenDeCircuitosParaJStaff();
  const publicados = circuitos.filter((c) => c.publishedAt !== null).length;

  return (
    <Marco casa={CASAS.jstaff} alcance={ALCANCE_SIN_CUENTA} lugar="/casa/jstaff/circuitos">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Titular
            nombre="Circuitos"
            bajo={`${circuitos.length === 1 ? "1 circuito" : `${circuitos.length} circuitos`} · ${publicados} ${
              publicados === 1 ? "publicado" : "publicados"
            }`}
          />
          <Link href="/casa/jstaff/circuitos/nuevo" className={clases.secundario}>
            Nuevo circuito
          </Link>
        </div>

        {circuitos.length === 0 ? (
          <Vacio>Todavía no hay circuitos</Vacio>
        ) : (
          <div className="flex flex-col gap-2.5">
            {circuitos.map((c) => {
              const minimo = loMinimoParaMedir(c);
              const cadena = cadenaDelCircuito({ ...c, publicado: c.publishedAt !== null, minimo });
              const publicado = c.publishedAt !== null;
              return (
                <Link
                  key={c.id}
                  href={`/casa/jstaff/circuitos/${c.id}`}
                  className="flex cursor-pointer items-start gap-4 rounded-[13px] border border-[var(--linea)] bg-[var(--pieza)] px-4 py-3.5 hover:bg-[var(--roce)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[19px] leading-tight${c.active ? "" : " text-[var(--tenue)]"}`}
                      style={{ fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.01em" }}
                    >
                      {c.name}
                    </span>
                    <span className="mt-1 block truncate text-[13px] text-[var(--tenue)]">
                      {c.concessionName} · <span data-medida>{c.publicSlug}</span>
                    </span>
                    <span className="mt-1.5 block">
                      <CadenaEnLinea eslabones={cadena} />
                    </span>
                  </span>
                  <span className="flex-none text-right">
                    <span data-medida className={`block text-[15px] leading-tight${publicado ? "" : " text-[var(--tenue)]"}`}>
                      {publicado ? "publicado" : "sin publicar"}
                    </span>
                    <span data-medida className="mt-1 block text-[10.5px] uppercase tracking-[0.12em] text-[var(--tenue)]">
                      {minimo.listo ? "lista para medir" : "falta lo mínimo"}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Marco>
  );
}
