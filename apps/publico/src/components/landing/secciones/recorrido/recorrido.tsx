"use client";

import { useRef, useState } from "react";
import { Hilo } from "./hilo";

/**
 * **«El recorrido»** — lo que hace Ontoy, en cinco paradas.
 *
 * A la izquierda el hilo de la ruta, por el que Cami baja mientras tú bajas; a
 * la derecha las cinco tarjetas. Es la sección que explica el producto entero,
 * y por eso es donde más se cuida lo que NO se promete.
 *
 * ## Las dos paradas que cambiaron de tema, no de forma
 *
 * **La 02 era el planeador.** Decía «Dile a dónde vas… Ontoy te dice qué ruta
 * te acerca, en qué parada subirte y cuándo pasa», que es la 8.16 entera — y
 * la 8.16 no existe: hoy «Ir a» es el **buscador**, que empareja nombres de
 * paradas y de rutas en el teléfono y abre la que escojas. Eso es lo que dice
 * ahora la tarjeta, con la misma demo interactiva (decisión de ASAV, 24-sep).
 *
 * **La 04 era una notificación.** Enseñaba una pantalla bloqueada a las 7:42
 * con «¡Ya viene tu 51!», que es la 8.13 — y la 8.13 espera a que el servicio
 * real ruede semanas: un aviso sobre un servicio inestable enseña a
 * desinstalar. Ahora enseña **la app abierta**, y **sin minutos**: «¡ya viene!»
 * y «a 2 paradas de ti» (decisión de ASAV, 24-sep). Las cosquillas de Ontoy se
 * quedan, que eran la gracia de la tarjeta.
 *
 * ## Y la 01, que es la que sostiene todo
 *
 * «Si no hay dato, te lo dice: nunca adivina» es la frase que hace creíbles a
 * las otras cuatro. Por eso su tarjeta enseña la edad del dato —«posición de
 * hace 10 s»— junto al número: un dato vivo sin su edad es un dato que pide
 * que le crean.
 */
export function Recorrido() {
  const seccion = useRef<HTMLElement>(null);

  return (
    <section id="recorrido" className="landing-caja landing-recorrido" ref={seccion}>
      <header className="landing-recorrido-dicho">
        <p className="landing-rotulo">Lo que hace Ontoy · en cinco paradas</p>
        <h2>Súbete. Baja despacio.</h2>
        <p className="landing-lead">
          Mientras bajas, Cami recorre la ruta parada por parada. Fíjate en Tino:{" "}
          <strong>su placa cuenta a cuántas paradas viene</strong>, y ya sabes leer su mirada.
        </p>
      </header>

      <div className="landing-recorrido-cuerpo">
        <div className="landing-recorrido-hilo">
          <Hilo seccion={seccion} />
        </div>

        <div className="landing-paradas">
          <Parada n={1} titulo="Sabes cuándo pasa. De verdad.">
            <p>
              Ontoy ve la posición real de cada camión y te dice a cuántas paradas viene de la
              tuya. <strong>Si no hay dato, te lo dice: nunca adivina.</strong>
            </p>
            <UnaParada />
          </Parada>

          <Parada n={2} titulo="Busca tu ruta o tu parada.">
            <p>
              Escribe el nombre y Ontoy te la abre en el mapa, con sus camiones en vivo.
              Pruébalo aquí.
            </p>
            <Buscador />
          </Parada>

          <Parada n={3} titulo="Tu parada, a un toque.">
            <p>
              Guarda las paradas de siempre. Al abrir Ontoy ya te está diciendo cuándo pasa tu
              camión. <strong>Sin cuenta: se quedan en tu teléfono.</strong>
            </p>
            <Guardadas />
          </Parada>

          <Parada n={4} titulo="¡Ya viene! Sal a tiempo.">
            <p>
              Abres Ontoy y ya está ahí: a cuántas paradas viene tu camión. Ni esperas de más, ni
              lo ves pasar desde la esquina. (Hazle cosquillas.)
            </p>
            <YaViene />
          </Parada>

          <Parada n={5} titulo="Te enteras de los cambios.">
            <p>
              Desvíos por obra, horarios de fiesta: los avisos de la concesión están en la app
              <strong> con fecha y con quién lo dijo</strong>. Sin alarmas.
            </p>
            <Aviso />
          </Parada>
        </div>
      </div>
    </section>
  );
}

function Parada({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <article className="landing-parada">
      <p className="landing-parada-n">
        <span>{n}</span>
        Parada 0{n}
      </p>
      <h3>{titulo}</h3>
      {children}
    </article>
  );
}

/**
 * La tarjeta de una parada, como la enseña la app.
 *
 * **Lleva la edad del dato**, que es lo que separa esto de un número inventado.
 * Y **no dice minutos**: dice a cuántas paradas viene (8.9b).
 */
function UnaParada() {
  return (
    <div className="landing-demo landing-demo-parada">
      <span className="landing-chapa">51</span>
      <div>
        <b>Av. Tecnológico</b>
        <small>posición de hace 10 s</small>
      </div>
      <div className="landing-cuenta">
        3<span>paradas</span>
      </div>
    </div>
  );
}

/** Lo que «Ir a» empareja hoy: nombres de rutas y de paradas, en el teléfono. */
const LUGARES = [
  { que: "ruta", nombre: "Ruta 51", pista: "Oasis · Centro" },
  { que: "parada", nombre: "Av. Tecnológico", pista: "Ruta 51" },
  { que: "parada", nombre: "Hospital General", pista: "Ruta 51 · T1" },
  { que: "ruta", nombre: "Ruta T1", pista: "Parque industrial" },
];

/**
 * El buscador — lo que «Ir a» es hoy.
 *
 * **No arma un viaje.** Empareja lo que escribes contra los nombres que el
 * sistema ya conoce y abre el que escojas. Sin recorridos medidos no hay total
 * (8.16 regla 4), y un total sin ellos sería una llegada inventada.
 */
function Buscador() {
  const [escrito, setEscrito] = useState("");
  const busca = escrito.trim().toLowerCase();
  const encontrados = busca
    ? LUGARES.filter((l) => l.nombre.toLowerCase().includes(busca))
    : LUGARES.slice(0, 2);

  return (
    <div className="landing-demo landing-demo-buscar">
      <label>
        <span className="landing-lupa" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m15 15 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          value={escrito}
          placeholder="Escribe una ruta o una parada"
          onChange={(e) => setEscrito(e.target.value)}
          aria-label="Buscar una ruta o una parada"
        />
      </label>
      <ul>
        {encontrados.map((l) => (
          <li key={l.nombre}>
            <b>{l.nombre}</b>
            <small>{l.pista}</small>
          </li>
        ))}
        {encontrados.length === 0 && (
          /*
           * El vacío dice qué se buscó y dónde, no «sin resultados»: es la
           * diferencia entre que el pasajero sepa si hay algo que él pueda
           * hacer y que no lo sepa (8.10).
           */
          <li className="landing-vacio">
            Nada con ese nombre entre las rutas y paradas publicadas.
          </li>
        )}
      </ul>
      <p className="landing-pie-demo">Ejemplo · en la app busca sobre las rutas publicadas</p>
    </div>
  );
}

/** Las paradas guardadas viven en el teléfono: guardarlas no identifica a nadie (8.7, 8.8b). */
function Guardadas() {
  return (
    <div className="landing-demo landing-demo-guardadas">
      {[
        { apodo: "Casa", donde: "Av. Tecnológico", ruta: "51", falta: "a 3 paradas" },
        { apodo: "Trabajo", donde: "Parque industrial", ruta: "T1", falta: "a 6 paradas" },
      ].map((g) => (
        <div key={g.apodo}>
          <span className="landing-estrella" aria-hidden="true">
            ★
          </span>
          <div>
            <b>
              {g.apodo} · {g.donde}
            </b>
            <small>
              <span className="landing-chapa landing-chapa-chica">{g.ruta}</span> {g.falta}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Las cosquillas de Ontoy: suben con los clicks seguidos y bajan de ritmo solas. */
const COSQUILLAS = ["¡ja ja!", "¡jaja!", "¡ya, ya! jaja", "¡me haces llorar! jaja", "¡basta! JAJAJA"];

/**
 * La tarjeta 04 — **la app abierta, no una notificación**.
 *
 * El prototipo enseñaba una pantalla bloqueada a las 7:42. Las notificaciones
 * (8.13) esperan, así que esto enseña lo que la app sí hace: lo abres y ya
 * está ahí. Y **sin minutos**: «¡ya viene!» y «a 2 paradas de ti».
 */
function YaViene() {
  const [risa, setRisa] = useState(-1);
  const ultima = useRef(-99);

  const cosquillas = () => {
    const ahora = performance.now() / 1000;
    /* Cuentan como racha si pasan menos de 1.4 s entre una y otra. */
    setRisa((r) => (ahora - ultima.current < 1.4 ? Math.min(r + 1, COSQUILLAS.length - 1) : 0));
    ultima.current = ahora;
  };

  return (
    <div className="landing-demo landing-demo-yaviene">
      <div className="landing-yaviene-dicho">
        <b>¡Ya viene tu 51!</b>
        <small>A 2 paradas de Av. Tecnológico</small>
      </div>
      <button
        type="button"
        className="landing-cosquillas"
        onClick={cosquillas}
        aria-label="Hazle cosquillas a Ontoy"
      >
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <ellipse cx="44" cy="96" rx="9" ry="6" fill="var(--ontoy)" />
          <ellipse cx="76" cy="96" rx="9" ry="6" fill="var(--ontoy)" />
          <path
            d="M34 30 C40 18 60 16 74 19 C90 22 98 34 97 52 C96 68 94 80 86 88 C78 94 66 95 58 94 C46 95 34 92 28 82 C22 70 22 52 26 42 C28 36 30 33 34 30 Z"
            fill="var(--ontoy)"
          />
          {/* Riéndose los ojos se cierran: son dos arcos, como en el universo. */}
          {risa >= 0 ? (
            <path
              d="M40 50 q10 7 20 0 M66 48 q10 7 20 0"
              fill="none"
              stroke="var(--pupila)"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
          ) : (
            <>
              <circle cx="50" cy="52" r="11" fill="var(--ojo)" />
              <circle cx="76" cy="50" r="11" fill="var(--ojo)" />
              <circle cx="50" cy="52" r="6" fill="var(--pupila)" />
              <circle cx="76" cy="50" r="6" fill="var(--pupila)" />
            </>
          )}
          {/* La boca sólo sale en las reacciones, y reírse es una. */}
          {risa >= 0 && (
            <ellipse
              cx="63"
              cy="74"
              rx={7 + risa}
              ry={8 + risa * 1.5}
              fill="var(--pupila)"
            />
          )}
          <circle cx="12" cy="58" r="6" fill="var(--ontoy)" />
          <circle cx="110" cy="54" r="6" fill="var(--ontoy)" />
        </svg>
        <span className="landing-tocalo">{risa >= 0 ? COSQUILLAS[risa] : "tócalo"}</span>
      </button>
    </div>
  );
}

/**
 * Un aviso de la concesión, como se ve en la campana (8.13b).
 *
 * **Fechado y atribuido**, con la franja del color de su ruta y su nombre — el
 * color nunca va solo (8.8c). Y en la tinta de siempre: **nunca un letrero de
 * alarma**.
 */
function Aviso() {
  return (
    <div className="landing-demo landing-demo-aviso">
      <p className="landing-aviso-firma">Ayer 14:20 · según la concesión</p>
      <div>
        <span className="landing-chapa">51</span>
        <div>
          <b>Desvío por obra en Calle 16</b>
          <small>Sube en la parada de Av. Juárez hasta el viernes.</small>
        </div>
      </div>
    </div>
  );
}
