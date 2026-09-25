"use client";

import { useRef, useState } from "react";
import { Hilo } from "./hilo";
import { OntoyQueReacciona } from "../../ontoy-que-reacciona";

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
          Mientras bajas, Cami recorre la ruta parada por parada. Fíjate en Páris:{" "}
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
            <div className="landing-con-ontoy">
              <Buscador />
              {/*
               * El Ontoy que brinca y se marea. El diseño lo tenía en esta
               * tarjeta y se perdió al reescribirla como buscador: la tarjeta
               * cambió de tema, no de gracia.
               */}
              <OntoyQueReacciona reaccion="brinca" />
            </div>
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

/**
 * La tarjeta 04 — **la app abierta, no una notificación**.
 *
 * El prototipo enseñaba una pantalla bloqueada a las 7:42. Las notificaciones
 * (8.13) esperan, así que esto enseña lo que la app sí hace: lo abres y ya
 * está ahí. Y **sin minutos**: «¡ya viene!» y «a 2 paradas de ti».
 *
 * Las cosquillas las pone `OntoyQueReacciona`, que es el mismo Ontoy de la
 * tarjeta 02 y de los personajes: **una sola mecánica de reacciones para toda
 * la portada**, porque un Ontoy que se ríe distinto en cada sección son tres
 * dibujos, no un personaje.
 */
function YaViene() {
  return (
    <div className="landing-demo landing-demo-yaviene">
      <div className="landing-yaviene-dicho">
        <b>¡Ya viene tu 51!</b>
        <small>A 2 paradas de Av. Tecnológico</small>
      </div>
      <OntoyQueReacciona reaccion="cosquillas" />
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
