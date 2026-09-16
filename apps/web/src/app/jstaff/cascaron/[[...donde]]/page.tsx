import Link from "next/link";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { Cascaron } from "@/components/casa/cascaron";
import { Marco } from "@/components/casa/marco";
import { Pieza } from "@/components/casa/pieza";
import { Glifo, Latido, type EstadoGlifo } from "@/components/casa/glifo";
import { Migas } from "@/components/casa/migas";
import { CASAS, type Cara, type Casa } from "@/lib/casa/casas";

/**
 * Muestrario del cascarón — cara J-Staff.
 *
 * ## Por qué existe
 *
 * Porque el cascarón entró **sin un solo cuarto**, y eso es correcto: el menú
 * lista lo que existe, y hoy no existe nada. Pero un marco que no se puede
 * abrir tampoco se puede revisar, y en esta casa lo que no se ve en el
 * navegador no está verificado.
 *
 * Así que el marco se enseña aquí, con lugares de mentira que lo dicen. Es el
 * mismo camino que ya tomó el espécimen tipográfico de al lado: una pantalla
 * interna que muestra el lenguaje sin fingir que es el producto.
 *
 * ## Qué es de verdad y qué es muestra
 *
 * **De verdad:** el marco, las pestañas, el segundo nivel, los sellos, el
 * interruptor de piel, los glifos, las piezas y las migas. Son los componentes
 * que van a usar los cuartos, sin una copia de por medio — si alguno se rompe,
 * esta pantalla lo delata sola.
 *
 * **Muestra:** los lugares del menú y todos los datos. Los nombres de los
 * lugares salen del mapa, pero sus rutas apuntan a este mismo muestrario, no a
 * cuartos que no existen. Las unidades, velocidades y edades son inventadas y
 * no salen de ninguna consulta.
 *
 * El alcance se abre de par en par a propósito (`conContrato` y `operaPublico`
 * en verdadero) para que se vean también Cumplimiento y Circuitos, que en una
 * cuenta real aparecen sólo si le tocan.
 */

const CARAS: Cara[] = ["transportista", "planta", "corporativo", "jstaff"];

const RAIZ = "/jstaff/cascaron";

/** `Compás · operación` → `compas-operacion`. */
function aRuta(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * La misma casa del mapa, pero con sus lugares apuntando al muestrario.
 *
 * Es lo único que se falsea aquí, y se falsea hacia adentro: ninguna de estas
 * rutas sale de `/jstaff/cascaron`, así que nadie puede caer desde aquí en una
 * pantalla que no existe.
 */
function conCuartosDeMuestra(casa: Casa): Casa {
  return {
    ...casa,
    grupos: casa.grupos.map((grupo) => ({
      ...grupo,
      lugares: grupo.lugares.map((lugar) => ({
        ...lugar,
        ruta: `${RAIZ}/${casa.cara}/${aRuta(lugar.nombre)}`,
        hijos: lugar.hijos?.map((hijo) => ({
          ...hijo,
          ruta: `${RAIZ}/${casa.cara}/${aRuta(lugar.nombre)}/${aRuta(hijo.nombre)}`,
        })),
      })),
    })),
  };
}

const GLIFOS: { estado: EstadoGlifo; nombre: string; porque: string }[] = [
  {
    estado: "en-movimiento",
    nombre: "En movimiento",
    porque: "Flecha llena, rotada al rumbo real. La punta dice a dónde va.",
  },
  { estado: "detenida", nombre: "Detenida", porque: "Círculo lleno: presente, pero sin dirección." },
  {
    estado: "en-destino",
    nombre: "En destino",
    porque: "Anillo punteado: está, pero ya no se le mira. Todavía nadie lo calcula.",
  },
  {
    estado: "sin-transmitir",
    nombre: "Sin transmitir",
    porque: "Flecha hueca: la silueta de lo que había, vacía.",
  },
];

export default async function MuestrarioCascaron({
  params,
}: {
  params: Promise<{ donde?: string[] }>;
}) {
  await exigirEnPagina({ tipo: "jstaff" });

  const { donde } = await params;
  const pedida = donde?.[0] as Cara | undefined;
  const cara: Cara = pedida && CARAS.includes(pedida) ? pedida : "transportista";
  const casa = conCuartosDeMuestra(CASAS[cara]);

  return (
    <Cascaron>
      <Aviso />
      <Marco casa={casa} alcance={{ conContrato: true, operaPublico: true }}>
        <div className="mx-auto flex max-w-3xl flex-col gap-10">
          <Casas actual={cara} />

          <Seccion
            titulo="La pieza"
            nota="La unidad básica: glifo, nombre, apoyo, y el único número que importa con su palabra. Las dos de arriba son tocables y llevan a una ficha; la de abajo no finge serlo. Toda cosa viva trae la edad de su último dato."
          >
            <div className="flex flex-col gap-2.5">
              <Pieza
                estado="en-movimiento"
                rumbo={38}
                nombre="10254"
                apoyo="Ruta Poniente"
                dato="42.7 km/h"
                etiqueta="al aire"
                edad="hace 14 s"
                ficha={`${RAIZ}/${cara}/ficha`}
              />
              <Pieza
                estado="detenida"
                nombre="10261"
                apoyo="Ruta Norte"
                dato="0.0 km/h"
                etiqueta="detenida"
                edad="hace 2 min"
                ficha={`${RAIZ}/${cara}/ficha`}
              />
              <Pieza
                estado="sin-transmitir"
                nombre="10118"
                apoyo="Sin asignar"
                dato="—"
                etiqueta="sin señal"
                edad="hace 3.8 h"
              />
            </div>
          </Seccion>

          <Seccion
            titulo="Los glifos"
            nota="El color nunca carga el significado solo: el sol de Juárez a las siete de la mañana basta para que desaparezca. Cada estado se distingue por su forma, también en blanco y negro."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {GLIFOS.map((g) => (
                <div
                  key={g.estado}
                  className="flex items-start gap-3 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-3"
                >
                  <span className="mt-[1px] flex-none">
                    <Glifo estado={g.estado} rumbo={38} />
                  </span>
                  <span>
                    <span className="block text-[14px]">{g.nombre}</span>
                    <span className="mt-1 block text-[13px] leading-snug text-[var(--tenue)]">
                      {g.porque}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-[13px] text-[var(--tenue)]">
              <Latido />
              Y el latido: el verde es del sistema respirando, nunca de un veredicto.
            </p>
          </Seccion>

          <Seccion
            titulo="El camino de regreso"
            nota="A una ficha se llega tocando una pieza, desde donde sea que esa cosa aparezca, y siempre hay por dónde volver. Las migas registran el descenso, no la jerarquía de la dirección: se llega a una unidad desde Flota en vivo o desde Dispositivos, y el regreso devuelve a donde se venía."
          >
            <Migas
              pasos={[
                { nombre: "Flota en vivo", ruta: `${RAIZ}/${cara}/flota-en-vivo` },
                { nombre: "Ver 10254" },
              ]}
            />
          </Seccion>

          <Seccion
            titulo="Las dos pieles"
            nota="Con el interruptor de arriba a la derecha. Ninguna pantalla se da por terminada sin verse en las dos: la piel clara no es la oscura con los fondos volteados, cada una tiene sus propios valores."
          >
            <p className="text-[13px] text-[var(--tenue)]">
              La preferencia se recuerda por navegador y se comparte con las pantallas
              anteriores, así que cruzar de una a otra no cambia de piel a media navegación.
            </p>
          </Seccion>
        </div>
      </Marco>
    </Cascaron>
  );
}

/**
 * El aviso de que nada de esto es un dato.
 *
 * Va arriba del marco y no adentro, para que se lea antes que cualquier cifra y
 * para que ninguna pantalla de verdad herede un adorno que sólo tiene sentido
 * aquí.
 */
function Aviso() {
  return (
    <p className="border-b border-[var(--linea)] bg-[var(--t-senal)] px-5 py-2 text-[12.5px] leading-snug md:px-6">
      <strong style={{ fontWeight: 600 }}>Muestrario del cascarón.</strong> El marco, las
      pestañas, los glifos y las piezas son los de verdad. Los lugares del menú y todas las
      cifras son muestra fija: no salen de ninguna consulta y no verifican nada.
    </p>
  );
}

function Casas({ actual }: { actual: Cara }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span data-medida className="text-[10.5px] uppercase tracking-[0.16em] text-[var(--tenue)]">
        Casa
      </span>
      {CARAS.map((cara) => (
        <Link
          key={cara}
          href={`${RAIZ}/${cara}`}
          className={`cursor-pointer rounded-md border px-2.5 py-1 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)] ${
            cara === actual
              ? "border-[var(--senal)] text-[var(--tinta)]"
              : "border-[var(--linea)] text-[var(--tenue)] hover:text-[var(--tinta)]"
          }`}
        >
          {CASAS[cara].nombre}
        </Link>
      ))}
    </div>
  );
}

function Seccion({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className="text-[17px]"
        style={{ fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.01em" }}
      >
        {titulo}
      </h2>
      <p className="mb-4 mt-1.5 max-w-prose text-[13px] leading-relaxed text-[var(--tenue)]">
        {nota}
      </p>
      {children}
    </section>
  );
}
