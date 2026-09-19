import { intervalosDePausa, pausaVigente, periodoDePausaEnPalabras } from "@jtel/domain";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { Pieza } from "@/components/casa/pieza";
import { Encabezado, Titular, Vacio } from "@/components/casa/expediente";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { ESTADO_COMERCIAL, rutasDeContratos } from "@/lib/casa/contratos";

export const dynamic = "force-dynamic";

/**
 * Contratos — J-Staff (0041, 19 sep 2026).
 *
 * Todos los contratos de la plataforma, agrupados por transportista, con el
 * estado de su verificación. Se toca uno y en su ficha se pausa o se reanuda.
 *
 * **Sin glifo:** la verificación en pausa no tiene forma en el skill, y
 * inventarle una aquí sería ley de diseño de contrabando. El estado va en
 * palabras, en el dato de la pieza.
 *
 * **El estado comercial va aparte y con su nombre** («comercial: suspendido»):
 * es una etiqueta vieja que ningún proceso lee, y no se muestra junto a la
 * pausa sin distinguirla (decisión 9 de Asav).
 */
export default async function Contratos() {
  await exigirEnPagina({ tipo: "jstaff" });
  const repos = getRepos();
  const contratos = await repos.pausas.contratosDeLaPlataforma();
  const eventos = await repos.pausas.eventosDeContratos(contratos.map((c) => c.id));
  const ahora = new Date();

  const porTransportista = new Map<string, typeof contratos>();
  for (const c of contratos) porTransportista.set(c.transportista, [...(porTransportista.get(c.transportista) ?? []), c]);
  const enPausa = contratos.filter((c) => pausaVigente(intervalosDePausa(eventos.get(c.id) ?? []), ahora)).length;

  return (
    <Marco casa={CASAS.jstaff} alcance={ALCANCE_SIN_CUENTA}>
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <Migas pasos={[{ nombre: "Cuentas y demos" }, { nombre: "Contratos" }]} />
        <Titular
          nombre="Contratos"
          bajo={`${contratos.length === 1 ? "1 contrato" : `${contratos.length} contratos`}${enPausa ? ` · ${enPausa} con la verificación en pausa` : ""}`}
        />
        {contratos.length === 0 && <Vacio>No hay contratos todavía</Vacio>}
        {[...porTransportista.entries()].map(([transportista, lista]) => (
          <section key={transportista} className="flex flex-col gap-2.5" aria-label={transportista}>
            <Encabezado izquierda={transportista} derecha={lista.length === 1 ? "1 contrato" : `${lista.length} contratos`} />
            {lista.map((c) => {
              const vigente = pausaVigente(intervalosDePausa(eventos.get(c.id) ?? []), ahora);
              return (
                <Pieza
                  key={c.id}
                  nombre={c.nombre}
                  apoyo={[c.cliente, c.planta, `comercial: ${ESTADO_COMERCIAL[c.estadoComercial] ?? c.estadoComercial}`].filter(Boolean).join(" · ")}
                  dato={vigente ? "en pausa" : "verificando"}
                  etiqueta={vigente ? periodoDePausaEnPalabras(vigente, c.zona ?? undefined) : "la verificación"}
                  edad={null}
                  ficha={rutasDeContratos.contrato(c.id)}
                />
              );
            })}
          </section>
        ))}
      </div>
    </Marco>
  );
}
