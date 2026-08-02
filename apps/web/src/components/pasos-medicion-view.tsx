import type { PasoMedicion } from "@/lib/pasos-medicion";

/**
 * Cómo se midió — el corazón del expediente.
 *
 * Todo aquí va en ACERO: es medición, no juicio. El color del resultado vive
 * solo en el sello. Un porcentaje pintado de verde mentiría sobre qué clase de
 * cosa es.
 *
 * Cada medida se muestra junto a su umbral, siempre. Un "97.4%" sin el
 * "mínimo 60.0%" no dice si pasó, y obligar al usuario a saberse el contrato
 * de memoria es devolverle el puesto de monitoreo.
 */
export function PasosMedicionView({ pasos }: { pasos: PasoMedicion[] }) {
  if (pasos.length === 0) return null;

  return (
    <section
      data-seccion="pasos-medicion"
      className="mt-6 rounded-xl border border-[var(--linea)] bg-[var(--panel)] p-5"
    >
      <header className="mb-1">
        <h2 className="font-[family-name:var(--fuente-archivo)] text-lg font-semibold text-[var(--texto)]">
          Cómo se midió
        </h2>
        <p className="mt-1 text-sm text-[var(--tenue)]">
          Los pasos que siguió el árbitro, en el orden en que los siguió.
        </p>
      </header>

      <ol className="mt-5 space-y-5">
        {pasos.map((paso, i) => (
          <li
            key={paso.numero}
            className={`border-l-2 pl-4 ${
              paso.estado === "medido"
                ? "border-[var(--b-acero)]"
                : "border-dotted border-[var(--linea-fuerte)]"
            }`}
          >
            {/*
              La procedencia encabeza el grupo al que aplica, y solo cuando
              CAMBIA. Los cuatro pasos no vienen del mismo lugar y eso hay que
              decirlo — pero repetir la misma línea bajo cada uno no lo dice
              mejor: se lee a plantilla, y al pie parece aplicar solo a ese paso.
            */}
            {paso.procedencia !== pasos[i - 1]?.procedencia ? (
              <p className="mb-2 font-[family-name:var(--fuente-mono)] text-[10.5px] uppercase tracking-[0.11em] text-[var(--tenue)]">
                {paso.procedencia}
              </p>
            ) : null}

            <div className="flex items-baseline gap-2">
              <span className="font-[family-name:var(--fuente-mono)] text-xs tabular-nums text-[var(--tenue)]">
                {paso.numero}
              </span>
              <h3 className="text-sm font-medium text-[var(--texto)]">{paso.pregunta}</h3>
            </div>

            <p
              className={`mt-1.5 text-sm ${
                paso.estado === "medido" ? "text-[var(--texto)]" : "text-[var(--tenue)]"
              }`}
            >
              {paso.respuesta}
            </p>

            {paso.medidas.length > 0 ? (
              // Acotada: a pantalla ancha, un valor pegado al borde derecho
              // deja media pantalla entre la etiqueta y su número.
              <dl className="mt-3 max-w-xl space-y-1.5">
                {paso.medidas.map((medida) => (
                  <div
                    key={medida.etiqueta}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"
                  >
                    <dt className="text-xs text-[var(--tenue)]">{medida.etiqueta}</dt>
                    <dd className="font-[family-name:var(--fuente-mono)] text-sm tabular-nums text-[var(--acero)]">
                      {medida.valor}
                      {medida.umbral ? (
                        <span className="ml-2 text-xs text-[var(--tenue)]">· {medida.umbral}</span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {paso.nota ? (
              <p className="mt-2 max-w-xl text-xs leading-relaxed text-[var(--tenue)]">
                {paso.nota}
              </p>
            ) : null}

          </li>
        ))}
      </ol>
    </section>
  );
}
