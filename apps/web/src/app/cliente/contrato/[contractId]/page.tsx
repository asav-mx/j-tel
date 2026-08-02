import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/ui";
import { ConfirmForm } from "@/components/confirm-form";
import { PerillaCampo } from "@/components/perilla-campo";
import { VentanaContrato, formatoMargen } from "@/components/ventana-contrato";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { cargarOficinaDeContrato } from "@/lib/contrato-data";
import {
  lecturaDeUmbral,
  MINIMO_PARA_LEER,
  resumirResultados,
  sospechaDeVentana,
  usosDeMotivos,
} from "@/lib/contrato-lectura";
import {
  GRUPOS,
  MOTIVOS_EXCUSABLES,
  ZONAS_HORARIAS,
  perillasDelGrupo,
  type GrupoPerilla,
  type Perilla,
} from "@/lib/perillas-contrato";
import { confirmMessages } from "@/lib/confirm-messages";

export const dynamic = "force-dynamic";

/**
 * La oficina del contrato — donde el cliente configura lo que se le va a
 * exigir al transportista.
 *
 * La pantalla anterior era una rejilla de dieciocho campos con los nombres
 * internos del motor. Funcionaba para quien ya sabía; para un cliente nuevo
 * era una pared, y un valor mal puesto aquí no da error: da veredictos falsos
 * que además se ven perfectamente creíbles.
 *
 * Tres cosas la separan de un formulario:
 *
 *  1. Cada perilla dice qué hace, hacia dónde mueve el resultado y si toca al
 *     árbitro o solo a la mesa de trabajo. Eso vive en `perillas-contrato.ts`.
 *  2. Los umbrales se muestran contra la operación real medida — no contra la
 *     nada. Un 60% no significa nada hasta verlo al lado de un 94.2%.
 *  3. La ventana del turno se dibuja con las llegadas encima, porque el error
 *     que nadie ve es una hora declarada que no es la hora a la que se opera.
 *
 * Todo lo medido sale de hechos ya sellados. Abrir esto no verifica nada.
 */

const mono = "font-[family-name:var(--fuente-mono)]";
const num = "font-[family-name:var(--fuente-mono)] tabular-nums";
/*
 * El fondo del campo va en `--panel2`, no en `bg-black/30`: un negro fijo se
 * ve como campo hundido en tema oscuro y como caja gris sucia sobre el papel
 * blanco del tema claro. El token cambia con el tema; el negro no.
 */
const inputBase =
  "w-full max-w-xs rounded border border-[var(--linea)] bg-[var(--panel2)] px-3 py-1.5 text-sm text-[var(--texto)] tabular-nums";

export default async function OficinaDeContratoPage({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { contractId } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const client = await resolveAccountByType("client", searchParams);
  if (!client) notFound();

  // La pertenencia al cliente la verifica la capa de datos: un contrato de
  // otro cliente no devuelve nada y esto responde 404.
  const datos = await cargarOficinaDeContrato({
    clientAccountId: client.id,
    contractId,
  });
  if (!datos) notFound();

  const { contrato, turnos, hechos, periodo } = datos;
  const p = contrato.policy;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const guardado = typeof sp?.created === "string" ? sp.created : null;

  const resumen = resumirResultados(hechos);
  const graciaMin = p.verificationGraceMinutes ?? 15;
  const despuesMin = p.evidenceMarginMinutesAfter ?? 30;
  const antesMin = p.evidenceMarginMinutesBefore ?? 60;

  const sospecha = sospechaDeVentana(hechos, {
    abreMinAntes: antesMin,
    cierraMinDespues: graciaMin + despuesMin,
  });

  // Solo se lee lo que el hecho sellado guarda. La precisión de corredor y la
  // cobertura de la ventana viven en el ledger, no en el hecho: no se
  // inventa una distribución para ellas.
  const coberturas = hechos
    .map((h) => h.coberturaRutaPct)
    .filter((v): v is number => v !== null);
  const lecturaCobertura =
    coberturas.length >= MINIMO_PARA_LEER
      ? lecturaDeUmbral(coberturas, p.kmlMatchMinPct ?? 60)
      : null;

  const motivosHabilitados = (p.excusableReasons ?? []) as string[];
  const usos = usosDeMotivos(hechos, motivosHabilitados);
  const usosPorMotivo = new Map(usos.map((u) => [u.motivo, u.usos]));
  const reglaEnforcement = p.enforcementRules?.[0];

  const volver = withAccount(`/cliente/contrato/${contrato.id}`, client.slug);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <AppNav
          title={contrato.nombre}
          links={[
            { href: withAccount("/cliente", client.slug), label: "Cliente" },
            { href: withAccount("/cliente/plantas", client.slug), label: "Plantas" },
          ]}
        />

        <p className="mb-1 text-sm text-[var(--tenue)]">
          {[contrato.alcance, contrato.carrier].filter(Boolean).join(" ↔ ") || "—"} ·{" "}
          <span className={num}>
            vigencia {contrato.validFrom} → {contrato.validTo}
          </span>{" "}
          · {contrato.estado}
        </p>
        <p className="mb-6 max-w-[68ch] text-sm text-[var(--tenue)]">
          Cada regla del acuerdo, <span className="text-[var(--texto)]">medida contra la
          operación real de los últimos {periodo.dias} días</span>. El sistema guarda lo que se
          firmó; no lo decide.
        </p>

        {error ? (
          <div className="mb-6 rounded-xl border border-[var(--azul)]/40 bg-[var(--azul)]/10 p-4 text-sm">
            <span className="text-[var(--azul)]">No se guardó.</span> {error}
          </div>
        ) : null}
        {guardado === "politica" ? (
          <div className="mb-6 rounded-xl border border-[var(--azul)]/40 bg-[var(--azul)]/10 p-4 text-sm">
            <span className="text-[var(--azul)]">Guardado.</span> Aplica a los servicios que se
            verifiquen de aquí en adelante. Los resultados ya sellados conservan la política con
            la que se juzgaron.
          </div>
        ) : null}

        {/* — Salud del contrato — */}
        <div className="mb-6 grid grid-cols-2 gap-px border border-[var(--linea)] bg-[var(--linea)] sm:grid-cols-4">
          <Vital
            titulo="Alcance"
            valor={`${turnos.length} ${turnos.length === 1 ? "turno·ruta" : "turnos·ruta"}`}
            lectura={`${contrato.perfiles} servicio${contrato.perfiles === 1 ? "" : "s"} configurado${contrato.perfiles === 1 ? "" : "s"}`}
          />
          <Vital
            titulo={`Resultados · ${periodo.dias} días`}
            valor={`${resumen.total}`}
            lectura={`${resumen.cumplido} cumplidos · ${resumen.no_cumplido} no · ${resumen.pendiente_evidencia} pendientes`}
          />
          <Vital
            titulo="Efectos económicos"
            valor={reglaEnforcement ? "Encendidos" : "Apagados"}
            lectura={
              reglaEnforcement
                ? "cada consecuencia aparece junto a su resultado"
                : "los resultados se sellan igual, sin consecuencia"
            }
            tenue={!reglaEnforcement}
          />
          <Vital
            titulo="Reloj del contrato"
            valor={(p.timeZone ?? "America/Ciudad_Juarez").split("/")[1]?.replace(/_/g, " ") ?? "—"}
            lectura="todas las horas de abajo son de este reloj"
          />
        </div>

        {/* — El hallazgo que esta pantalla existe para dar — */}
        {sospecha.hay ? <SospechaDeVentanaAviso sospecha={sospecha} /> : null}

        {/* — La ventana — */}
        <h2 className={`mt-10 mb-1 border-b border-[var(--linea)] pb-2 text-[11px] tracking-[.14em] text-[var(--tenue)] uppercase ${mono}`}>
          La ventana del turno
        </h2>
        <p className="mt-3 mb-4 max-w-[70ch] text-[13px] text-[var(--tenue)]">
          Las cuatro reglas de tiempo son números sueltos en un formulario y una sola figura en
          la cabeza de quien opera. Aquí están dibujadas juntas, con las llegadas reales encima:
          es la forma de ver de un golpe si la hora que se declaró es la hora a la que de verdad
          se llega.
        </p>
        <VentanaContrato
          zonas={{
            abreMinAntes: antesMin,
            toleranciaMin: p.toleranceMinutes ?? 0,
            graciaMin,
            margenDespuesMin: despuesMin,
          }}
          hechos={hechos}
          horaLimite={null}
        />

        {/* — El formulario, por preguntas — */}
        <ConfirmForm
          action="/api/cliente/contratos"
          method="post"
          className="mt-2"
          confirmMessage={confirmMessages.updatePolicy(contrato.nombre)}
        >
          <input type="hidden" name="clientSlug" value={client.slug} />
          <input type="hidden" name="action" value="updatePolicy" />
          <input type="hidden" name="contractId" value={contrato.id} />
          <input type="hidden" name="returnTo" value={volver} />
          {/*
            Declara que ESTE formulario sí edita la consolidación. Sin la
            marca, un checkbox desmarcado no viaja y la API no podría
            distinguirlo de un formulario que no tiene el campo.
          */}
          <input type="hidden" name="editaConsolidacion" value="1" />
          <input type="hidden" name="editaVentanaDerivada" value="1" />

          {(["tiempo", "ventana", "ruta", "evidencia", "perdon", "dinero"] as GrupoPerilla[]).map(
            (grupo) => (
              <section key={grupo}>
                <h2
                  className={`mt-10 mb-1 border-b border-[var(--linea)] pb-2 text-[11px] tracking-[.14em] text-[var(--tenue)] uppercase ${mono}`}
                >
                  {GRUPOS[grupo].titulo} — {GRUPOS[grupo].pregunta}
                </h2>
                <p className="mt-3 mb-2 max-w-[70ch] text-[13px] text-[var(--tenue)]">
                  {GRUPOS[grupo].entrada}
                </p>

                <div className="border border-[var(--linea)] bg-[var(--panel)] px-5">
                  {perillasDelGrupo(grupo).map((perilla) => (
                    <PerillaCampo
                      key={perilla.llave}
                      perilla={perilla}
                      lectura={perilla.llave === "kmlMatchMinPct" ? lecturaCobertura : null}
                    >
                      <Control
                        perilla={perilla}
                        policy={p}
                        usosPorMotivo={usosPorMotivo}
                        periodoDias={periodo.dias}
                      />
                    </PerillaCampo>
                  ))}
                </div>
              </section>
            ),
          )}

          {/*
            El motivo es opcional a propósito: obligarlo haría que la gente
            escriba "ajuste" para poder guardar, y un registro lleno de
            "ajuste" es peor que uno con huecos. Cuando está, vale más que la
            lista de qué cambió — el qué se deduce de las dos versiones, el
            porqué no se deduce de ningún lado.
          */}
          <label className="mt-8 block max-w-[70ch]">
            <span className="text-[13px] text-[var(--texto)]">
              Por qué estás cambiando esto{" "}
              <span className="text-[var(--tenue)]">· opcional</span>
            </span>
            <span className="mt-1 mb-2 block text-[12px] text-[var(--tenue)]">
              Queda guardado con la edición, en la historia del contrato. Dentro de seis
              meses, cuando alguien pregunte por qué el umbral está en 70, esto es lo
              único que va a contestarlo.
            </span>
            <input
              type="text"
              name="motivo"
              maxLength={280}
              placeholder="p. ej. el turno B se movió a las 14:00"
              className="w-full rounded-lg border border-[var(--linea)] bg-black/30 px-3 py-2 text-sm text-[var(--texto)] placeholder:text-[var(--tenue)]"
            />
          </label>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              className="rounded-lg border border-[var(--azul)] px-5 py-2 text-sm text-[var(--azul)] hover:bg-[var(--azul)]/10"
            >
              Guardar la política
            </button>
            <span className="text-xs text-[var(--tenue)]">
              Aplica hacia adelante. Nada de lo ya sellado se recalcula, y la edición queda
              registrada.
            </span>
          </div>
        </ConfirmForm>

        <p className={`mt-4 text-[12px] ${mono}`}>
          <Link
            href={withAccount(`/cliente/contrato/${contrato.id}/historia`, client.slug)}
            className="text-[var(--azul)]"
          >
            Ver la historia de la política →
          </Link>
        </p>

        {/* — Los turnos, con la hora de la que sale todo — */}
        <h2 className={`mt-12 mb-1 border-b border-[var(--linea)] pb-2 text-[11px] tracking-[.14em] text-[var(--tenue)] uppercase ${mono}`}>
          Turnos y rutas de este contrato
        </h2>
        <p className="mt-3 mb-4 max-w-[70ch] text-[13px] text-[var(--tenue)]">
          La hora de entrada es de donde sale la hora límite de cada servicio. Se edita en
          Turnos, no aquí — pero se muestra en esta pantalla porque{" "}
          <span className="text-[var(--texto)]">
            una hora de entrada mal declarada envenena todos los resultados del turno
          </span>{" "}
          sin que nada se vea roto.
        </p>
        {turnos.length === 0 ? (
          <p className="text-sm text-[var(--tenue)]">
            Este contrato todavía no tiene servicios configurados.
          </p>
        ) : (
          <div className="overflow-x-auto border border-[var(--linea)] bg-[var(--panel)]">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className={`text-left text-[10px] tracking-[.12em] text-[var(--tenue)] uppercase ${mono}`}>
                  <th className="border-b border-[var(--linea-fuerte)] p-3 font-medium">Ruta</th>
                  <th className="border-b border-[var(--linea-fuerte)] p-3 font-medium">Turno</th>
                  <th className="border-b border-[var(--linea-fuerte)] p-3 font-medium">Entrada declarada</th>
                  <th className="border-b border-[var(--linea-fuerte)] p-3 font-medium">Hora límite que produce</th>
                  <th className="border-b border-[var(--linea-fuerte)] p-3 font-medium">Ventana que abre</th>
                  <th className="border-b border-[var(--linea-fuerte)] p-3 text-right font-medium">Servicios</th>
                </tr>
              </thead>
              <tbody>
                {turnos.map((t) => (
                  <tr key={t.routeShiftId} className="border-b border-[var(--linea-tenue)]">
                    <td className="p-3 text-[var(--texto)]">{t.ruta}</td>
                    <td className="p-3 text-[var(--tenue)]">{t.turno}</td>
                    <td className={`p-3 text-[var(--acero)] ${num}`}>{t.horaEntrada ?? "—"}</td>
                    <td className={`p-3 text-[var(--acero)] ${num}`}>
                      {horaLimiteDe(t.horaEntrada, p.arrivalAnticipationMinutes ?? 15)}
                    </td>
                    <td className="p-3">
                      <AnchoDeVentana ventana={t.ventana} />
                    </td>
                    <td className={`p-3 text-right text-[var(--tenue)] ${num}`}>{t.perfiles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* — Ley 2, visible — */}
        <div className="mt-10 max-w-[66ch] border-l-2 border-[var(--azul)] py-1 pl-4 text-sm text-[var(--tenue)]">
          <p>
            <span className="text-[var(--texto)]">
              Cambiar una regla jamás reescribe el pasado.
            </span>{" "}
            Cada resultado sellado conserva la fotografía de la política con la que se juzgó. Si
            mañana la tolerancia sube a 7 minutos, los servicios de este mes siguen citando los{" "}
            <span className={num}>{p.toleranceMinutes ?? 0}</span> minutos que estaban vigentes
            cuando se sellaron.
          </p>
          <p className={`mt-2 text-[12.5px] ${mono}`}>
            Los cambios aplican hacia adelante. Nunca hay recálculo retroactivo.
          </p>
        </div>

        <p className={`mt-10 border-t border-[var(--linea)] pt-4 text-[11px] text-[var(--tenue)] ${mono}`}>
          Las distribuciones son lecturas sobre resultados ya sellados entre {periodo.desde} y{" "}
          {periodo.hasta} — abrir esta pantalla no verifica nada de nuevo.
          <br />
          Solo se mide lo que el resultado sellado guarda: la llegada y la cobertura del trazado.
          La precisión del corredor y la cobertura de la ventana se registran en la bitácora del
          servicio, no en el resultado, y por eso aquí no se les dibuja distribución.
        </p>
      </div>
    </main>
  );
}

/**
 * El ancho de ventana de una ruta, con de dónde salió el número.
 *
 * Es lo que separa este valor de todos los demás de la pantalla: nadie lo
 * escribió. El sistema lo aprende, y hay tres formas distintas de saberlo —
 * medido de recorridos reales, estimado de la geometría del trazado, o el piso
 * de política porque no hay ni lo uno ni lo otro. Presentar los tres iguales
 * haría creer que una estimación es una medición.
 */
function AnchoDeVentana({
  ventana,
}: {
  ventana: import("@/lib/contrato-data").TurnoDelContrato["ventana"];
}) {
  if (!ventana) {
    return <span className={`text-[11px] text-[var(--tenue)] ${mono}`}>—</span>;
  }

  const origen =
    ventana.basis === "medida"
      ? {
          etiqueta: "medida",
          detalle: `de ${ventana.muestras} recorrido${ventana.muestras === 1 ? "" : "s"} · dura ${Math.round(ventana.routeDurationMinutes ?? 0)} min`,
          acero: true,
        }
      : ventana.basis === "estimada_geometria"
        ? {
            etiqueta: "estimada",
            detalle: `del largo del trazado · ${Math.round(ventana.routeDurationMinutes ?? 0)} min${ventana.muestras > 0 ? ` · ${ventana.muestras} medición${ventana.muestras === 1 ? "" : "es"}, aún no bastan` : " · sin recorridos medidos"}`,
            acero: false,
          }
        : {
            etiqueta: "de política",
            detalle: "sin trazado ni recorridos medidos: manda el piso",
            acero: false,
          };

  return (
    <span className="block">
      <span className={`text-[var(--acero)] ${num}`}>{ventana.beforeMinutes} min antes</span>
      <span
        className={`ml-2 rounded-[2px] border px-1.5 pt-[2px] pb-[1px] text-[9px] tracking-[.1em] uppercase ${mono} ${
          origen.acero
            ? "border-[var(--acero)]/60 text-[var(--acero)]"
            : "border-[var(--linea-fuerte)] text-[var(--tenue)]"
        }`}
      >
        {origen.etiqueta}
      </span>
      <span className={`block text-[10.5px] text-[var(--tenue)] ${mono}`}>{origen.detalle}</span>
      {ventana.recortadaPorTope ? (
        <span className={`block text-[10.5px] text-[var(--azul)] ${mono}`}>
          el tope la recortó — la ruta pedía más
        </span>
      ) : null}
    </span>
  );
}

/** Hora límite = hora de entrada − anticipación. La misma cuenta del motor. */
function horaLimiteDe(horaEntrada: string | null, anticipacion: number): string {
  if (!horaEntrada) return "—";
  const [h, m] = horaEntrada.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return "—";
  const total = ((h * 60 + m - anticipacion) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * El hallazgo, con sus cuatro partes: la afirmación, la evidencia medida, la
 * consecuencia y una sola acción con su dueño.
 *
 * Declara explícitamente qué NO responde. El sistema hace imposible mentir; no
 * falla a favor de nadie, y aquí no tiene forma de saber cuál de las dos
 * causas posibles es la verdadera.
 */
function SospechaDeVentanaAviso({
  sospecha,
}: {
  sospecha: Extract<ReturnType<typeof sospechaDeVentana>, { hay: true }>;
}) {
  const m = sospecha.medidos;
  return (
    <div className="mt-6 border border-[var(--azul)]/40 bg-[var(--azul)]/[.07] p-5">
      <p className={`mb-2 text-[10px] tracking-[.14em] text-[var(--azul)] uppercase ${mono}`}>
        Aviso del sistema · la ventana y la operación no coinciden
      </p>

      <h3 className="mb-3 max-w-[52ch] text-[17px] leading-snug font-medium text-[var(--texto)]">
        {sospecha.clase === "llegadas_lejos"
          ? `Las llegadas de este contrato ocurren ${formatoMargen(m.medianaMargenMin ?? 0)} de la hora límite — fuera de la ventana que está configurada.`
          : `${m.sinLlegada} de ${m.total} servicios se resolvieron sin que el sistema viera una sola llegada.`}
      </h3>

      <div
        className={`mb-3 flex flex-wrap gap-x-6 gap-y-1 border border-[var(--linea)] bg-black/20 px-4 py-2.5 text-[12px] ${mono} text-[var(--tenue)]`}
      >
        <span>
          servicios leídos <span className="text-[var(--texto)]">{m.total}</span>
        </span>
        <span>
          con llegada observada <span className="text-[var(--texto)]">{m.conLlegada}</span>
        </span>
        <span>
          sin llegada <span className="text-[var(--texto)]">{m.sinLlegada}</span>
        </span>
        {m.medianaMargenMin !== null ? (
          <span>
            mediana de llegada{" "}
            <span className="text-[var(--texto)]">{formatoMargen(m.medianaMargenMin)}</span>
          </span>
        ) : null}
        <span>
          ventana <span className="text-[var(--texto)]">−{m.ventanaAbreMin}</span> a{" "}
          <span className="text-[var(--texto)]">+{m.ventanaCierraMin}</span> min
        </span>
      </div>

      <p className="mb-3 max-w-[62ch] text-[13.5px] text-[var(--tenue)]">
        Mientras la ventana no cubra la operación real, cada servicio de este contrato se juzga
        contra un rato en el que no pasa nada.{" "}
        <span className="text-[var(--texto)]">
          El resultado no falla con un error: sale sellado y creíble, y equivocado.
        </span>
      </p>

      <p className="mb-4 max-w-[62ch] text-[12.5px] text-[var(--tenue)]">
        <span className="text-[var(--texto)]">Lo que esta lectura no responde:</span> no puede
        distinguir si la hora del turno está mal declarada, si la ventana es demasiado angosta, o
        si las unidades no están reportando. Los tres se ven igual desde aquí.
      </p>

      <p className={`text-[11px] text-[var(--tenue)] ${mono}`}>
        Revisa: la hora de entrada del turno, en la tabla de abajo · Decide: Coordinación de rutas
      </p>
    </div>
  );
}

function Vital({
  titulo,
  valor,
  lectura,
  tenue,
}: {
  titulo: string;
  valor: string;
  lectura: string;
  tenue?: boolean;
}) {
  return (
    <div className="bg-[var(--panel)] p-4">
      <div className={`mb-2 text-[10px] tracking-[.1em] text-[var(--tenue)] uppercase ${mono}`}>
        {titulo}
      </div>
      <div
        className={`text-lg leading-tight tabular-nums ${tenue ? "text-[var(--tenue)]" : "text-[var(--acero)]"}`}
        style={{ fontFamily: "var(--fuente-archivo)", fontWeight: 700 }}
      >
        {valor}
      </div>
      <div className={`mt-1.5 text-[10.5px] text-[var(--tenue)] ${mono}`}>{lectura}</div>
    </div>
  );
}

/** Qué dice la casilla cuando está marcada, por perilla. */
const ENCENDIDO: Partial<Record<string, string>> = {
  permitirConsolidacion: "Permitir que una unidad cubra varias rutas del mismo turno",
  windowDerivationEnabled: "Aprender el ancho de cada ruta de su duración real",
};

/** El control de cada perilla, según su forma. */
function Control({
  perilla,
  policy,
  usosPorMotivo,
  periodoDias,
}: {
  perilla: Perilla;
  policy: import("@jtel/domain").ContractPolicy;
  usosPorMotivo: Map<string, number>;
  periodoDias: number;
}) {
  const forma = perilla.forma;
  const valor = policy[perilla.llave];

  if (forma.tipo === "entero") {
    return (
      <label className="flex items-center gap-3">
        <input
          type="number"
          name={perilla.llave}
          min={forma.min}
          max={forma.max}
          defaultValue={typeof valor === "number" ? valor : ""}
          placeholder={perilla.opcional ? "sin configurar" : undefined}
          className={inputBase}
        />
        <span className={`text-[12px] text-[var(--tenue)] ${mono}`}>{forma.unidad}</span>
      </label>
    );
  }

  if (forma.tipo === "porcentaje") {
    return (
      <label className="flex items-center gap-3">
        <input
          type="number"
          name={perilla.llave}
          min={0}
          max={100}
          step="0.1"
          defaultValue={typeof valor === "number" ? valor : ""}
          className={inputBase}
        />
        <span className={`text-[12px] text-[var(--tenue)] ${mono}`}>%</span>
      </label>
    );
  }

  if (forma.tipo === "fraccion") {
    const pct = typeof valor === "number" ? valor * 100 : 15;
    return (
      <label className="flex items-center gap-3">
        <input
          type="number"
          name={`${perilla.llave}Pct`}
          min={0}
          max={100}
          step="1"
          defaultValue={Math.round(pct)}
          className={inputBase}
        />
        <span className={`text-[12px] text-[var(--tenue)] ${mono}`}>
          % inicial de la ruta que puede faltar
        </span>
      </label>
    );
  }

  if (forma.tipo === "booleano") {
    return (
      <label className="flex items-center gap-2.5 text-sm text-[var(--tenue)]">
        <input
          type="checkbox"
          name={perilla.llave}
          value="on"
          defaultChecked={valor === true}
          className="size-4"
        />
        {ENCENDIDO[perilla.llave] ?? "Encendido"}
      </label>
    );
  }

  if (forma.tipo === "opciones") {
    return (
      <div className="space-y-2">
        {forma.opciones.map((o) => (
          <label key={o.valor} className="flex gap-2.5 text-sm">
            <input
              type="radio"
              name={perilla.llave}
              value={o.valor}
              defaultChecked={valor === o.valor}
              className="mt-1 size-4 shrink-0"
            />
            <span>
              <span className="text-[var(--texto)]">{o.etiqueta}</span>
              <span className="block max-w-[58ch] text-[12.5px] text-[var(--tenue)]">
                {o.explica}
              </span>
            </span>
          </label>
        ))}
      </div>
    );
  }

  if (forma.tipo === "zona") {
    return (
      <select
        name={perilla.llave}
        defaultValue={typeof valor === "string" ? valor : "America/Ciudad_Juarez"}
        className={inputBase}
      >
        {ZONAS_HORARIAS.map((z) => (
          <option key={z.valor} value={z.valor}>
            {z.etiqueta}
          </option>
        ))}
      </select>
    );
  }

  if (forma.tipo === "motivos") {
    const marcados = new Set((policy.excusableReasons ?? []) as string[]);
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {MOTIVOS_EXCUSABLES.map((m) => {
          const usos = usosPorMotivo.get(m.valor) ?? 0;
          return (
            <label key={m.valor} className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="excusableReasons"
                value={m.valor}
                defaultChecked={marcados.has(m.valor)}
                className="size-4 shrink-0"
              />
              <span className="text-[var(--tenue)]">
                {m.etiqueta}
                <span className={`ml-2 text-[11px] ${mono} text-[var(--acero)]`}>
                  {usos} {usos === 1 ? "uso" : "usos"} en {periodoDias} días
                </span>
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  // Enforcement: una sola regla, que es lo que el formulario ha soportado
  // siempre. La política admite un arreglo, pero nunca se ha usado más de una.
  const regla = policy.enforcementRules?.[0];
  return (
    <div className="space-y-3">
      <label className="block text-sm text-[var(--tenue)]">
        Tipo de consecuencia
        <select name="enforcementType" defaultValue={regla?.type ?? ""} className={`${inputBase} mt-1`}>
          <option value="">Ninguna — sin efectos económicos</option>
          <option value="no_pago_viaje">No se paga el viaje</option>
          <option value="rebate_escalonado">Rebate escalonado</option>
          <option value="reembolso">Reembolso</option>
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-[var(--tenue)]">
          Minutos tarde a partir de los que aplica
          <input
            type="number"
            name="enforcementTolerance"
            min={1}
            defaultValue={regla && "toleranceMinutes" in regla ? regla.toleranceMinutes : 5}
            className={`${inputBase} mt-1`}
          />
        </label>
        <label className="block text-xs text-[var(--tenue)]">
          Reembolso: monto
          <input
            type="number"
            name="reembolsoAmount"
            min={0}
            defaultValue={regla?.type === "reembolso" ? (regla.amount ?? "") : ""}
            className={`${inputBase} mt-1`}
          />
        </label>
        <label className="block text-xs text-[var(--tenue)]">
          Rebate base (%)
          <input
            type="number"
            name="baseRebatePercent"
            step="0.1"
            defaultValue={regla?.type === "rebate_escalonado" ? regla.baseRebatePercent : 0}
            className={`${inputBase} mt-1`}
          />
        </label>
        <label className="block text-xs text-[var(--tenue)]">
          Incumplimientos para el rebate base
          <input
            type="number"
            name="baseFailureCount"
            min={1}
            defaultValue={regla?.type === "rebate_escalonado" ? regla.baseFailureCount : 1}
            className={`${inputBase} mt-1`}
          />
        </label>
        <label className="block text-xs text-[var(--tenue)]">
          Rebate adicional por cada uno más (%)
          <input
            type="number"
            name="additionalRebatePercent"
            step="0.1"
            defaultValue={regla?.type === "rebate_escalonado" ? regla.additionalRebatePercent : 0}
            className={`${inputBase} mt-1`}
          />
        </label>
      </div>
    </div>
  );
}
