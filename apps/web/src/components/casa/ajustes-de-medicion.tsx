import { clases } from "@/components/casa/formulario";

/**
 * Los ajustes de medición de un circuito, editables desde el expediente de
 * J-Staff (PR A4 de la ficha de Circuitos, 21-sep-2026).
 *
 * Son las reglas de la medición: cambiarlas cambia qué cuenta como «pasó», qué
 * unidad ve el pasajero y hasta cuándo se dice que hay servicio. Por eso cada
 * uno dice **qué hace su número**, con su valor de fábrica al lado —para ver de
 * un vistazo cuáles se movieron— y ningún nombre se repite (la «tolerancia» que
 * eran dos distancias, ver la ruta).
 *
 * **La escritura es la de siempre** (`POST /api/jstaff/circuitos/[id]` y
 * `/rango`); esta pantalla sólo le manda `volver`. Un campo que no se toca se
 * manda con su valor de hoy: la ruta lo reescribe igual, sin efecto.
 *
 * **Cada cambio lleva motivo y queda firmado** (0051, A4b — ASAV, 21-sep: un
 * cambio de regla lleva quién, cuándo y por qué, como la promesa y las
 * asignaciones). El servidor lo exige; el antes → después lo lee de la base.
 */

export interface Ajuste {
  campo: string;
  nombre: string;
  queHace: string;
  unidad: string;
  valor: number;
  fabrica: number;
  decimales?: boolean;
}

export function AjustesDeMedicion({
  circuitId,
  ajustes,
  rangoEncendido,
}: {
  circuitId: string;
  ajustes: Ajuste[];
  rangoEncendido: boolean;
}) {
  const volver = `/casa/jstaff/circuitos/${circuitId}`;
  return (
    <div className="flex flex-col gap-3">
      <form action={`/api/jstaff/circuitos/${circuitId}`} method="post" className={clases.panel}>
        <input type="hidden" name="volver" value={volver} />
        <input type="hidden" name="seccion" value="medicion" />
        {ajustes.map((a) => {
          const movido = a.valor !== a.fabrica;
          return (
            <label key={a.campo} className="flex flex-col gap-1.5">
              <span className="flex flex-wrap items-baseline gap-x-2.5">
                <span className="text-[13px] font-semibold">{a.nombre}</span>
                <span data-medida className={`text-[11px] ${movido ? "font-semibold" : "text-[var(--tenue)]"}`}>
                  {movido ? `movido · de fábrica ${a.fabrica} ${a.unidad}` : "de fábrica"}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  name={a.campo}
                  defaultValue={a.valor}
                  min={a.decimales ? 0.1 : 1}
                  step={a.decimales ? 0.1 : 1}
                  required
                  className={`${clases.campo.replace("w-full ", "")} w-[120px] font-[family-name:var(--letra-medida)]`}
                />
                <span data-medida className="text-[13px] text-[var(--tenue)]">
                  {a.unidad}
                </span>
              </span>
              <span className={clases.ayuda}>{a.queHace}</span>
            </label>
          );
        })}
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Por qué cambia
          <input
            name="motivo"
            required
            maxLength={280}
            className={clases.campo}
            placeholder="Queda escrito con tu nombre, junto al antes y el después"
          />
        </label>
        <p className={clases.ayuda}>
          Cambiar un ajuste cambia lo que se mide y se dice de aquí en adelante; no reescribe nada guardado.
        </p>
        <div>
          <button type="submit" className={clases.primario}>
            Guardar los ajustes
          </button>
        </div>
      </form>

      <form
        action={`/api/jstaff/circuitos/${circuitId}/rango`}
        method="post"
        className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-3.5"
      >
        <input type="hidden" name="volver" value={volver} />
        <input type="hidden" name="activar" value={rangoEncendido ? "no" : "si"} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">
            Tiempo estimado de llegada · {rangoEncendido ? "encendido" : "apagado"}
          </span>
          <span className="mt-1 block text-[13px] text-[var(--tenue)]">
            {rangoEncendido
              ? "Ontoy dice en cuántos minutos pasa el camión, con la velocidad de arriba."
              : "Ontoy dice a cuántas paradas viene el camión y calla los minutos: se enciende cuando la velocidad ya se calibró contra la calle."}
          </span>
        </span>
        <span className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            name="motivo"
            required
            maxLength={280}
            aria-label="Por qué se prende o se apaga"
            placeholder="Por qué (queda escrito)"
            className={`${clases.campo.replace("w-full ", "")} min-w-[220px] flex-1`}
          />
          <button type="submit" className={rangoEncendido ? clases.secundario : clases.primario}>
            {rangoEncendido ? "Apagar" : "Encender"}
          </button>
        </span>
      </form>
    </div>
  );
}
