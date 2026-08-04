import { AppNav } from "@/components/ui";
import { exigirEnPagina } from "@/lib/guardia-pagina";

/*
 * Espécimen tipográfico de J-Telemetry — cara J-Staff.
 *
 * Existe para verificar con los ojos que las tres familias del skill cargan y
 * que cada token apunta a la correcta. No consume datos: todo lo que se ve aquí
 * es muestra fija, y la pantalla lo dice en voz alta para que nadie la confunda
 * con un resultado verificado.
 *
 * Los ejemplos usan los tokens (var(--fuente-*)), nunca el nombre de la familia.
 * Si un token se desconecta, esta pantalla lo delata sola.
 */

const ARCHIVO = "var(--fuente-archivo)";
const SANS = "var(--fuente-sans)";
const MONO = "var(--fuente-mono)";

/** Etiqueta de sección: mono, versalitas espaciadas, tenue. */
function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-4 text-[10.5px] uppercase tracking-[0.13em] text-[var(--tenue)]"
      style={{ fontFamily: MONO, fontWeight: 500 }}
    >
      {children}
    </div>
  );
}

function Papel({
  etiqueta,
  papel,
  pesos,
  children,
}: {
  etiqueta: string;
  papel: string;
  pesos: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-[var(--linea)] bg-[var(--panel)] p-6">
      <Etiqueta>{etiqueta}</Etiqueta>
      <p className="mb-6 text-sm text-[var(--tenue)]" style={{ fontFamily: SANS }}>
        {papel}{" "}
        <span style={{ fontFamily: MONO }} className="text-[var(--acero)]">
          {pesos}
        </span>
      </p>
      {children}
    </section>
  );
}

export default async function TipografiaPage() {
  // Se guarda como las demás aunque no consuma datos: es una pantalla interna,
  // y una excepción sin razón escrita es la que alguien copia después.
  await exigirEnPagina({ tipo: "jstaff" });

  return (
    <main className="min-h-screen bg-[var(--fondo)] p-8">
      <div className="mx-auto max-w-4xl">
        <AppNav
          title="Espécimen tipográfico"
          links={[
            { href: "/jstaff", label: "Panel" },
            { href: "/jstaff/verificacion", label: "Verificación" },
          ]}
        />

        <p className="mb-10 max-w-2xl text-sm text-[var(--tenue)]" style={{ fontFamily: SANS }}>
          Las tres familias del lenguaje de interfaz, cada una en su papel. Todo lo
          que se ve abajo es muestra fija para revisar la carga de las fuentes: no
          hay datos reales ni resultados verificados en esta pantalla.
        </p>

        <div className="space-y-6">
          <Papel
            etiqueta="Archivo · lo que se afirma"
            papel="Cifras grandes, títulos, la tesis de la pantalla."
            pesos="600 / 700"
          >
            <div style={{ fontFamily: ARCHIVO }}>
              <div className="text-6xl leading-none" style={{ fontWeight: 700 }}>
                94.2%
              </div>
              <div className="mt-4 text-2xl" style={{ fontWeight: 600 }}>
                Cierre del turno
              </div>
            </div>
          </Papel>

          <Papel
            etiqueta="IBM Plex Sans · lo que se lee de corrido"
            papel="Prosa: la afirmación de un hallazgo, la lectura de los hechos."
            pesos="400 / 500"
          >
            <div style={{ fontFamily: SANS }} className="max-w-xl">
              <p className="text-base" style={{ fontWeight: 500 }}>
                Llega cada semana un poco más tarde; lleva 4.7 minutos de deriva.
              </p>
              <p className="mt-3 text-sm text-[var(--tenue)]" style={{ fontWeight: 400 }}>
                Al ritmo medido, cruza la tolerancia del contrato en 3 semanas. La
                evidencia no responde por qué se está recorriendo la salida.
              </p>
            </div>
          </Papel>

          <Papel
            etiqueta="IBM Plex Mono · toda medición"
            papel="Horas, unidades, porcentajes, folios y etiquetas de sección."
            pesos="400 / 500"
          >
            <div
              style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}
              className="space-y-5 text-sm"
            >
              <div className="space-y-1">
                <div>
                  <span className="text-[var(--tenue)]">llegada </span>
                  <span className="text-[var(--acero)]">2026-07-24 06:52:14</span>
                  <span className="text-[var(--tenue)]">
                    {" "}· deadline + tolerancia 2026-07-24 06:50:00
                  </span>
                </div>
                <div>
                  <span className="text-[var(--tenue)]">cobertura </span>
                  <span className="text-[var(--acero)]">94.2%</span>
                  <span className="text-[var(--tenue)]">
                    {" "}· umbral del contrato 60.0%
                  </span>
                </div>
                <div>
                  <span className="text-[var(--tenue)]">retraso </span>
                  <span className="text-[var(--acero)]">2 min 14 s</span>
                  <span className="text-[var(--tenue)]"> · folio IN-0312</span>
                </div>
              </div>

              {/* El chip del skill: borde marcado, hueco adentro, versalitas. */}
              <div className="flex flex-wrap gap-3">
                <span
                  className="inline-block rounded-[2px] border-[1.5px] border-current px-[10px] pt-[3.5px] pb-[2.5px] text-[10.5px] uppercase tracking-[0.13em] text-[var(--verde)]"
                  style={{ fontWeight: 500, background: "rgba(52,199,123,.07)" }}
                >
                  Cumplido
                </span>
                <span
                  className="inline-block rounded-[2px] border-[1.5px] border-current px-[10px] pt-[3.5px] pb-[2.5px] text-[10.5px] uppercase tracking-[0.13em] text-[var(--ambar)]"
                  style={{ fontWeight: 500, background: "rgba(227,168,31,.07)" }}
                >
                  Pendiente por evidencia
                </span>
                <span
                  className="inline-block rounded-[2px] border-[1.5px] border-current px-[10px] pt-[3.5px] pb-[2.5px] text-[10.5px] uppercase tracking-[0.13em] text-[var(--rojo)]"
                  style={{ fontWeight: 500, background: "rgba(229,72,77,.07)" }}
                >
                  No cumplido
                </span>
              </div>

              {/* tabular-nums: las columnas de números tienen que alinear. */}
              <div>
                <div className="mb-2 text-[10.5px] uppercase tracking-[0.13em] text-[var(--tenue)]">
                  tabular-nums · las cifras alinean en columna
                </div>
                <div className="space-y-0.5 text-[var(--acero)]">
                  <div>1111.11</div>
                  <div>8888.88</div>
                  <div>4090.05</div>
                </div>
              </div>
            </div>
          </Papel>
        </div>

        <div
          className="mt-10 inline-block border border-dashed border-[var(--linea)] px-3 py-2 text-[11px] text-[var(--tenue)]"
          style={{ fontFamily: MONO }}
        >
          Espécimen de tipografía · sin datos verificados
        </div>
      </div>
    </main>
  );
}
