import type { DiaTira } from "@/lib/inicio-corporativo-data";

/**
 * La tira de 14 días — un cuadro por día, en el color de su resultado.
 *
 * **Cada cuadro muestra la proporción del día, no un solo color.**
 *
 * La primera versión pintaba el día del color de su peor resultado. Con
 * cuarenta y ocho servicios diarios eso pinta todo rojo siempre: un día de
 * 27 cumplidos contra 21 se veía idéntico a uno de 10 contra 38. **La tira
 * existe para comparar de un vistazo, y un color agregado la vuelve incapaz de
 * comparar nada.** El dato de un día con muchos servicios es una proporción, y
 * el formato se elige por el dato.
 *
 * **Un cuadro vacío es un día sin servicios programados, no un día sin datos.**
 * Esa es la condición que la ficha le puso a esta tira: si no se pudiera
 * distinguir, no se dibujaría. Se sostiene porque las ocurrencias se generan
 * por adelantado — los días ausentes caen en fin de semana.
 *
 * "Sin verificar" NO es un veredicto, así que va en acero. Verde, ámbar y rojo
 * quedan para los tres resultados y nada más.
 */

const SEGMENTOS = [
  { llave: "cumplido", color: "var(--verde)", nombre: "cumplidos" },
  { llave: "pendiente_evidencia", color: "var(--ambar)", nombre: "pendientes por evidencia" },
  { llave: "no_cumplido", color: "var(--rojo)", nombre: "no cumplidos" },
  { llave: "sin_hecho", color: "var(--t-acero2)", nombre: "sin verificar" },
] as const;

function lectura(d: DiaTira): string {
  if (d.programados === 0) return `${d.dia} · sin servicios programados`;
  const partes = SEGMENTOS.filter((s) => d[s.llave] > 0).map((s) => `${d[s.llave]} ${s.nombre}`);
  return `${d.dia} · ${d.programados} programados: ${partes.join(" · ")}`;
}

export function TiraCatorceDias({ dias }: { dias: DiaTira[] }) {
  return (
    <div>
      <div className="flex gap-1" role="img" aria-label={`Últimos ${dias.length} días`}>
        {dias.map((d) => (
          <span key={d.dia} title={lectura(d)} className="flex h-5 flex-1 flex-col overflow-hidden rounded-[2px]">
            {d.programados === 0 ? (
              <span className="h-full w-full rounded-[2px] border border-dashed border-[var(--linea-tenue)]" />
            ) : (
              SEGMENTOS.filter((s) => d[s.llave] > 0).map((s) => (
                <span
                  key={s.llave}
                  style={{
                    backgroundColor: s.color,
                    height: `${(d[s.llave] / d.programados) * 100}%`,
                  }}
                />
              ))
            )}
          </span>
        ))}
      </div>
      <p className="mt-1.5 font-[family-name:var(--fuente-mono)] text-[10px] tabular-nums text-[var(--tenue)]">
        {dias[0]?.dia} → {dias[dias.length - 1]?.dia}
      </p>
    </div>
  );
}
