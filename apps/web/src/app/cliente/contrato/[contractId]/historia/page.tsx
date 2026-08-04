/**
 * Historia de la política del contrato — qué cambió, quién y cuándo.
 *
 * La política es la ley con la que se juzga. Los hechos ya guardaban su
 * historia; esta faltaba: hasta ahora, editar la configuración borraba lo que
 * decía antes y nadie podía reconstruir con qué reglas se juzgó un servicio de
 * hace tres semanas.
 *
 * Dos cosas que esta pantalla NO hace, y que importan tanto como lo que hace:
 *
 *  - No cambia ningún resultado. Los cambios de política son hacia adelante;
 *    cada hecho congeló su propia foto al verificarse y sigue juzgado con esa.
 *    Ver la historia no reabre nada.
 *  - No rellena lo que no sabe. Las ediciones anteriores a que existiera este
 *    registro se perdieron, y eso se dice en vez de dibujar una historia
 *    completa que no lo es.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { cargarHistoriaDePolitica } from "@/lib/historia-politica-data";
import { valorEscrito, firmaDeEdicion, type EdicionLeida } from "@/lib/politica-diff";
import { ETIQUETA_DECIDE } from "@/lib/perillas-contrato";
import { instanteSellado } from "@/lib/formato-tiempo";
import { JTTEL_TZ } from "@/lib/local-time";
import { exigirRecurso } from "@/lib/guardia-pagina";
import { getRepos } from "@/lib/db";

export const dynamic = "force-dynamic";

const mono = "font-[family-name:var(--fuente-mono)]";

export default async function HistoriaDePoliticaPage({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { contractId } = await params;
  // La cuenta sale de la fila del recurso, nunca de `?account=`.
  // Va en la PÁGINA y no solo en el layout: un redirect de layout no
  // impide que la hija se renderice, y su payload viaja igual.
  await exigirRecurso(() => getRepos().procedencia.deContrato(contractId));

  const cliente = await resolveAccountByType("client", searchParams);
  if (!cliente) notFound();

  const datos = await cargarHistoriaDePolitica({
    clientAccountId: cliente.id,
    contractId,
  });
  if (!datos) notFound();

  const { contrato, ediciones } = datos;
  const conCambios = ediciones.filter((e) => e.cambios.length > 0);

  return (
    <main className="min-h-screen p-6 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <AppNav
          title="Historia de la política"
          links={[
            {
              href: withAccount(`/cliente/contrato/${contrato.id}`, cliente.slug),
              label: "← Oficina del contrato",
            },
          ]}
        />

        <header className="space-y-2">
          <p className={`text-[12px] text-[var(--tenue)] ${mono}`}>{contrato.nombre}</p>
          <h1
            className="text-[26px] leading-tight text-[var(--texto)]"
            style={{ fontFamily: "var(--fuente-archivo)", fontWeight: 700 }}
          >
            {conCambios.length === 0
              ? "Sin ediciones registradas"
              : `${conCambios.length} ${conCambios.length === 1 ? "edición" : "ediciones"} de la política`}
          </h1>
          <p className="max-w-[70ch] text-sm text-[var(--tenue)]">
            La política es la regla con la que el árbitro juzga. Aquí queda cada edición
            con lo que cambió, quién la hizo y cuándo.{" "}
            <span className="text-[var(--texto)]">
              Cambiar la política no reabre nada de lo ya sellado
            </span>{" "}
            — cada resultado congeló su propia copia de las reglas al verificarse, y sigue
            juzgado con esa. Lo que se edita aquí aplica de aquí en adelante.
          </p>
        </header>

        {/* Un hueco en el registro se declara antes que nada. */}
        {datos.vigenteSinRegistro && (
          <Aviso>
            <strong className="font-normal text-[var(--texto)]">
              La política vigente no es la que dejó la última edición registrada.
            </strong>{" "}
            Alguien la escribió por un camino que no pasa por este registro. Lo que se ve
            abajo es cierto hasta esa última edición; de ahí a hoy hay un cambio sin
            autor ni fecha. Se dice en vez de dibujar una historia completa que no lo es.
          </Aviso>
        )}

        {conCambios.length === 0 ? (
          <div className="rounded-sm border border-[var(--linea)] bg-[var(--panel)] p-6">
            <p className="text-sm text-[var(--texto)]">
              Este contrato no se ha editado desde que existe el registro.
            </p>
            <p className={`mt-2 text-[12px] text-[var(--tenue)] ${mono}`}>
              Contrato creado el {instanteSellado(contrato.creadoEn)} · última escritura
              sobre la fila: {instanteSellado(contrato.actualizadoEn)}
            </p>
          </div>
        ) : (
          <ol className="space-y-4">
            {conCambios.map((edicion) => (
              <Edicion key={edicion.id} edicion={edicion} />
            ))}
          </ol>
        )}

        {/* El piso de la historia: lo que había cuando arrancó el registro. */}
        {datos.puntoDePartida && (
          <div className="rounded-sm border border-dashed border-[var(--linea)] p-5">
            <p className={`text-[11.5px] text-[var(--tenue)] ${mono}`}>
              Antes de la edición más antigua de esta lista, la política decía lo que esa
              edición muestra en su columna «antes». Se sabe QUÉ decía; no se sabe desde
              cuándo ni quién la dejó así, porque hasta que existió este registro cada
              edición sobrescribía a la anterior. Ese hueco no se rellena: inventaría un
              autor y una fecha.
            </p>
          </div>
        )}

        <p className={`text-[11px] text-[var(--tenue)] ${mono}`}>
          Horas en el reloj de <span className="text-[var(--acero)]">{JTTEL_TZ}</span> ·{" "}
          <Link
            href={withAccount(`/cliente/contrato/${contrato.id}`, cliente.slug)}
            className="text-[var(--azul)]"
          >
            editar la política
          </Link>
        </p>
      </div>
    </main>
  );
}

function Edicion({ edicion }: { edicion: EdicionLeida }) {
  const tocaAlArbitro = edicion.cambios.some((c) => c.decide === "arbitro");

  return (
    <li className="rounded-sm border border-[var(--linea)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--linea)] px-5 py-3">
        <span className={`text-[13px] tabular-nums text-[var(--texto)] ${mono}`}>
          {instanteSellado(edicion.changedAt)}
        </span>
        <span className={`text-[11.5px] text-[var(--tenue)] ${mono}`}>
          {firmaDeEdicion(edicion.actorKind, edicion.actorId)}
        </span>
      </div>

      {edicion.cadenaRota && (
        <div className="border-b border-[var(--linea)] px-5 py-3">
          <p className="text-[12px] text-[var(--azul)]">
            Entre esta edición y la anterior, la política cambió por fuera del registro:
            lo que la edición previa dejó no es lo que esta encontró. Falta un cambio, y
            no hay de dónde sacar quién lo hizo.
          </p>
        </div>
      )}

      {edicion.note && (
        <div className="border-b border-[var(--linea)] px-5 py-3">
          <p className="text-[13px] text-[var(--texto)]">«{edicion.note}»</p>
        </div>
      )}

      <ul className="divide-y divide-[var(--linea)]">
        {edicion.cambios.map((c) => (
          <li key={c.llave} className="px-5 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[13.5px] text-[var(--texto)]">{c.nombre}</span>
              <span className={`text-[12.5px] tabular-nums ${mono}`}>
                <span className="text-[var(--tenue)]">{valorEscrito(c.antes, c.perilla)}</span>
                <span className="mx-2 text-[var(--tenue)]">→</span>
                <span className="text-[var(--acero)]">{valorEscrito(c.despues, c.perilla)}</span>
              </span>
            </div>

            <p className={`mt-1 text-[11px] text-[var(--tenue)] ${mono}`}>
              {c.decide ? ETIQUETA_DECIDE[c.decide].texto : `llave sin catalogar · ${c.llave}`}
            </p>

            {/*
              La advertencia sale del mismo catálogo que la oficina: la que se
              lee al editar es la que marca el cambio aquí. Va en azul —aviso
              del sistema—, nunca en ámbar: ámbar es de veredictos.
            */}
            {c.riesgo && (
              <p className="mt-1.5 max-w-[75ch] text-[11.5px] text-[var(--azul)]">{c.riesgo}</p>
            )}
          </li>
        ))}
      </ul>

      {tocaAlArbitro && (
        <p className={`border-t border-[var(--linea)] px-5 py-2.5 text-[11px] text-[var(--tenue)] ${mono}`}>
          Esta edición tocó reglas que el árbitro lee para decidir. Los servicios
          verificados antes de esta hora no cambiaron: conservan la copia de la política
          que tenían al sellarse.
        </p>
      )}
    </li>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-[var(--azul)]/45 bg-[var(--azul)]/10 p-4 text-[13px] text-[var(--texto)]">
      <span className={`text-[var(--azul)] ${mono}`}>Aviso del sistema.</span> {children}
    </div>
  );
}
