import type { Metadata } from "next";
import Link from "next/link";
import "./landing.css";
import { CaraDeOntoy } from "@/components/landing/ontoy";
import { MarcaDelHero } from "@/components/landing/marca-del-hero";
import { Calle } from "@/components/landing/calle/calle";
import { ProveedorDeNivel } from "@/components/landing/nivel-contexto";
import { LaPreguntaDeSiempre } from "@/components/landing/secciones/pregunta-de-siempre";
import { TuColor } from "@/components/landing/secciones/tu-color";
import { Personajes } from "@/components/landing/secciones/personajes";
import { Recorrido } from "@/components/landing/secciones/recorrido/recorrido";
import { Instalar } from "@/components/landing/secciones/instalar";

/**
 * **La landing de `ontoy.app`** — la raíz, para quien todavía no conoce Ontoy.
 *
 * Decisión de ASAV del 25-sep-2026: la gente escribe «ontoy.app» y nada más,
 * así que la raíz es de la landing y **la app vive en `/rutas`**
 * (`docs/Ontoy-Direcciones.md`). Hasta este archivo, la raíz era un reenvío de
 * una línea a la app, puesto ahí a propósito para que el día de la landing lo
 * único que se reemplazara fuera la raíz, sin llevarse nada. Es hoy.
 *
 * El diseño es el del #552 (`Ontoy-Landing/index.html`), traducido a React: el
 * archivo original es de la herramienta de diseño y no se puede servir tal cual.
 *
 * ## Lo que esta página NO promete, y es lo más importante de ella
 *
 * Una portada es lo único que lee alguien que todavía no tiene la app, así que
 * cada cosa que promete es una deuda. Tres no se contraen:
 *
 *  - **El planeador** (8.16) no existe: hoy «Ir a» es el buscador de nombres.
 *    Los tres títulos que traía el diseño —«Ontoy te lleva», «¿A dónde vas?»,
 *    «Tú dime a dónde»— lo prometían los tres, y por eso ninguno se usó.
 *  - **Las notificaciones** (8.13) esperan a que el servicio real ruede
 *    semanas: un aviso sobre un servicio inestable enseña a desinstalar.
 *  - **Los minutos.** Mientras la velocidad del corredor no esté calibrada, la
 *    app no dice «llega en 3 min»: dice a cuántas paradas viene (8.9b). La
 *    landing dice lo mismo, en todas sus secciones y no sólo en algunas — los
 *    minutos en cinco lugares y las paradas en uno serían el dato correcto con
 *    la afirmación falsa.
 *
 * Lo que sí promete está en el lead, y la última frase es la que sostiene todo
 * lo demás: **si no sabe, te lo dice.**
 *
 * ## Y lo que esta página NO lee: la base de datos
 *
 * **La portada no enseña una ruta real** (decisión de ASAV, 24-sep-2026). Una
 * ruta de una concesión en la portada de la plataforma es vestir la plataforma
 * de transportista — la razón misma por la que Ontoy se mudó de
 * `juarezbus.digital` a su propio dominio. Así que lo que se ve aquí es
 * **ilustración**: la 51 del universo de Ontoy como ejemplo dibujado, y donde
 * el texto pregunta, pregunta en genérico («¿Ya pasó tu camión?»).
 *
 * La regla de que **nada de una ruta se escribe a mano** es de la app, que
 * informa. Esta página no informa de ninguna ruta: dibuja una.
 *
 * El efecto secundario es que la portada **no consulta nada y se queda
 * estática**, que es lo que la hace aparecer de inmediato en el teléfono de
 * alguien que apenas está conociendo Ontoy. Lo cuida `direcciones.test.ts`.
 */

/**
 * El nombre, aquí, **sí va en el código** — y es la única página de esta app
 * donde eso es correcto.
 *
 * Las pantallas de la app leen `NEXT_PUBLIC_APP_NOMBRE` porque sirven a
 * cualquier concesionario invitado, y hornear un nombre ahí convertiría el alta
 * del siguiente en un despliegue. Esto es otra cosa: es la portada de
 * `ontoy.app`, el producto, y **¿Ontoy? es su marca**, con sus dos signos. No
 * hay un concesionario al que renombrarla.
 */
const ONTOY = "¿Ontoy?";

export const metadata: Metadata = {
  title: `${ONTOY} · Sabes cuándo pasa tu camión`,
  description:
    "Ontoy te dice cuándo pasa tu camión, qué ruta te lleva y en qué parada subirte. Gratis, sin cuenta, desde tu navegador.",
};

/** Las secciones de la landing, en el orden en que se bajan. */
const SECCIONES = [
  { ancla: "#ruta", palabra: "Tu color" },
  { ancla: "#personajes", palabra: "Personajes" },
  { ancla: "#recorrido", palabra: "Cómo funciona" },
  { ancla: "#instalar", palabra: "Instalar" },
];

export default function Landing() {
  return (
    <div className="landing">
      {/*
       * El nivel de rendimiento se averigua UNA vez y baja por contexto. Esto
       * es cliente, pero lo que envuelve no: el título, la frase y el botón
       * siguen llegando en el HTML.
       */}
      <ProveedorDeNivel>
        <header className="landing-cabecera">
          <div className="landing-caja">
            <Link
              href="/rutas"
              className="landing-wordmark"
              style={{
                fontSize: 23,
                color: "var(--texto)",
                textDecoration: "none",
              }}
            >
              {ONTOY}
            </Link>
            <nav aria-label="Secciones">
              {SECCIONES.map((s) => (
                <a key={s.ancla} href={s.ancla}>
                  {s.palabra}
                </a>
              ))}
              {/*
               * La única salida que no puede faltar, y por eso viaja fija con la
               * cabecera: quien ya sabe qué es Ontoy no tiene que bajar la
               * portada entera para poder usarla.
               */}
              <Link
                href="/rutas"
                className="landing-boton landing-boton-principal landing-boton-chico"
              >
                Abrir la app
              </Link>
            </nav>
          </div>
        </header>

        <section className="landing-caja landing-hero">
          {/*
           * La única parte cliente del hero: el wordmark y Ontoy, que parpadean
           * y siguen a quien lee. Todo lo demás de esta página llega ya escrito
           * en el HTML.
           */}
          <MarcaDelHero />

          <div className="landing-hero-dicho">
            <div>
              <span className="landing-etiqueta">
                <span>
                  <CaraDeOntoy />
                </span>
                La app de tu camión
              </span>
              <h1>¿Ontás? Mira cuándo pasa tu camión.</h1>
            </div>
            <div className="landing-hero-columna">
              <p className="landing-lead">
                Qué camión tomar, dónde subirte y cuándo pasa, con la posición
                real del camión. <strong>Si no sabe, te lo dice.</strong>
              </p>
              <div className="landing-acciones">
                <Link
                  href="/rutas"
                  className="landing-boton landing-boton-principal"
                >
                  Úsala ya en tu navegador
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
              {/*
               * Las tiendas van en «muy pronto» hasta que haya algo que bajar de
               * verdad. Es el estado `próximamente` del diseño, y no se adelanta:
               * una tienda anunciada y vacía es la primera promesa incumplida que
               * alguien se lleva de la portada.
               */}
              <p className="landing-tiendas">
                Muy pronto en App Store y Google Play
              </p>
            </div>
          </div>
        </section>

        {/*
         * La calle cruza a TODO el ancho, así que va fuera de la caja del hero —
         * una calle que se acaba antes del filo de la pantalla es una maqueta de
         * calle.
         */}
        <Calle />

        <LaPreguntaDeSiempre />

        <TuColor />

        <Personajes />

        <Recorrido />

        <Instalar />

        <footer className="landing-pie">
          <div className="landing-caja">
            <span className="landing-wordmark">{ONTOY}</span>
            <Link href="/privacidad">Privacidad</Link>
            <span>Horarios y avisos según cada concesión</span>
            <span className="landing-pie-dominio">ontoy.app</span>
          </div>
        </footer>
      </ProveedorDeNivel>
    </div>
  );
}
