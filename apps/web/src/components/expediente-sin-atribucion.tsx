import { JTTEL_TZ } from "@jtel/domain";
import type {
  CandidataVista,
  ExpedienteSinAtribucion,
  Medida,
  MotivoVista,
  Procedencia,
} from "@/lib/expediente-sin-atribucion";

/**
 * El expediente de un servicio sin atribución — Parte 1.
 *
 * Ficha: `docs/marco-limpio/Ficha-Expediente-Sin-Atribucion.md`.
 * **Cara del transportista.** Nada de aquí puede llegar a la del cliente: son
 * candidatas, puntajes y recorridos —maquinaria de identificación— y revelan la
 * flota (Ley 3 del Marco).
 *
 * ---
 *
 * **Las tres leyes que lo gobiernan, y dónde se ven:**
 *
 * 1. *Nada de esto es un veredicto ni lo cambia.* No hay un solo botón, y el
 *    color de veredicto no aparece: todas las medidas van en acero.
 * 2. *Nada se inventa.* Lo que no se midió se dice; no se rellena.
 * 3. *Todo campo nuevo nace vacío hacia atrás.* De ahí `<Marca>`: cada dato
 *    lleva su procedencia, y **«no se preguntó» se escribe con palabras, nunca
 *    como `—` ni como una barra vacía**. Un hueco dibujado igual que un cero
 *    rompe la ley el primer día.
 */

function marcaTexto(p: Procedencia): string | null {
  if (p === "hoy") return "lectura de hoy";
  if (p === "no_preguntado") return "no se preguntó";
  return null; // Del sello: el silencio es el mensaje.
}

function Marca({ procedencia }: { procedencia: Procedencia }) {
  const texto = marcaTexto(procedencia);
  if (!texto) return null;
  return (
    <span
      className="ml-2 font-mono text-[10px] uppercase tracking-[.12em]"
      style={{ color: "var(--tenue)" }}
    >
      {texto}
    </span>
  );
}

function horaCompleta(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date(iso))
    .replace(",", "");
}

/**
 * Una medida con su umbral al lado — nunca uno sin el otro.
 *
 * Cuando no se preguntó, **se escribe la frase en lugar del número**. Poner `—`
 * aquí sería el hueco que se lee como cero.
 */
function MedidaFila({ m }: { m: Medida }) {
  const sinDato = m.valor === null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-[12.5px]" style={{ color: "var(--tenue)" }}>
        {m.etiqueta}
        {m.nota ? (
          <span className="ml-1.5 font-mono text-[10px]" style={{ color: "var(--tenue)" }}>
            · {m.nota}
          </span>
        ) : null}
      </span>
      <span className="text-right">
        {sinDato ? (
          <span className="text-[12px] italic" style={{ color: "var(--tenue)" }}>
            no se preguntó al sellar
          </span>
        ) : (
          <>
            <span
              className="font-mono text-[13px] tabular-nums"
              style={{ color: "var(--acero)" }}
            >
              {m.valor!.toFixed(m.decimales)}
              {m.sufijo}
            </span>
            {m.umbral !== null ? (
              <span className="ml-2 font-mono text-[11px]" style={{ color: "var(--tenue)" }}>
                · mínimo del contrato {m.umbral.toFixed(m.decimales)}
                {m.sufijo}
              </span>
            ) : null}
          </>
        )}
        {sinDato ? null : <Marca procedencia={m.procedencia} />}
      </span>
    </div>
  );
}

function MotivoFila({ m }: { m: MotivoVista }) {
  if (m.procedencia === "no_preguntado") {
    return (
      <li className="text-[12.5px] italic" style={{ color: "var(--tenue)" }}>
        {m.texto}.{" "}
        <span className="not-italic">
          El motor de esa época guardaba un motivo del servicio, no de cada candidata.
        </span>
      </li>
    );
  }
  return (
    <li className="text-[12.5px]" style={{ color: "var(--texto)" }}>
      {m.texto}
      {m.medido !== null && m.umbral !== null ? (
        <span className="ml-2 font-mono text-[11px]" style={{ color: "var(--tenue)" }}>
          · {m.medido.toFixed(m.medido < 1 ? 2 : 1)} contra {m.umbral.toFixed(m.umbral < 1 ? 2 : 1)}
        </span>
      ) : null}
      {/*
       * C25 a la vista: la misma comprobación cambia de respuesta según a quién
       * se le pregunte, y el expediente tiene que poder decir cuál contestó.
       */}
      <span className="ml-2 font-mono text-[10px]" style={{ color: "var(--tenue)" }}>
        · medido sobre {m.poblacion === "candidata" ? "esta unidad" : "la evidencia del viaje"}
      </span>
    </li>
  );
}

function CandidataTarjeta({
  c,
  tz,
  indice,
}: {
  c: CandidataVista;
  tz: string;
  indice: number;
}) {
  return (
    <li
      className="rounded-[10px] border p-4"
      style={{ borderColor: "var(--linea)", background: "var(--panel)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[13px]" style={{ color: "var(--texto)" }}>
          {indice}. {c.etiqueta}
        </span>
        {c.llegadaAt ? (
          <span className="font-mono text-[12px] tabular-nums" style={{ color: "var(--acero)" }}>
            Llegó {horaCompleta(c.llegadaAt, tz)}
          </span>
        ) : null}
      </div>

      <div className="mt-3 border-t pt-2" style={{ borderColor: "var(--linea-tenue)" }}>
        {c.medidas.map((m) => (
          <MedidaFila key={m.etiqueta} m={m} />
        ))}
      </div>

      <div className="mt-3">
        <p
          className="font-mono text-[10px] uppercase tracking-[.12em]"
          style={{ color: "var(--tenue)" }}
        >
          Por qué no acreditó
        </p>
        <ul className="mt-1.5 space-y-1">
          {c.motivos.map((m, i) => (
            <MotivoFila key={i} m={m} />
          ))}
        </ul>
      </div>

      {c.senal ? (
        <p className="mt-3 font-mono text-[11px]" style={{ color: "var(--tenue)" }}>
          Señal de esta unidad: {c.senal.coberturaPct.toFixed(1)}% de la ventana · hueco mayor{" "}
          {c.senal.huecoMaximoMin.toFixed(1)} min
          {c.senal.cadenciaMedianaS !== null
            ? ` · un punto cada ${c.senal.cadenciaMedianaS.toFixed(0)} s`
            : ""}
          <Marca procedencia={c.senal.procedencia} />
        </p>
      ) : null}

      {/*
       * El empalme, dentro de la fila y no como tarjeta aparte: los tres hechos
       * en orden de tiempo dicen algo que ninguno dice solo. Y NO dice «por eso
       * no acreditó aquí» — esa conclusión es C18 y sigue sin construir.
       */}
      {c.empalme ? (
        <p
          className="mt-2 border-t pt-2 text-[12.5px]"
          style={{ borderColor: "var(--linea-tenue)", color: "var(--texto)" }}
        >
          Ese mismo turno acreditó{" "}
          <span className="font-mono">{c.empalme.rutaNombre}</span>
          <Marca procedencia={c.empalme.procedencia} />
        </p>
      ) : null}
    </li>
  );
}

export function ExpedienteSinAtribucionView({
  expediente,
  timeZone = JTTEL_TZ,
}: {
  expediente: ExpedienteSinAtribucion;
  timeZone?: string;
}) {
  /*
   * El titular habla de LLEGADAS; la lista habla del CORTE. Son dos números y
   * hay que tomarlos de donde corresponde: contar las llegadas sobre la lista
   * recortada daba «13 unidades llegaron» en un servicio donde llegaron 15
   * —correcto como conteo, falso como afirmación—. Se atrapó al verlo en el
   * navegador, no compilando.
   */
  const llegaron = expediente.llegaron;
  const mostradas = expediente.candidatas.length;
  const hayCorte = mostradas < llegaron;
  const sinLlegadas = expediente.sinLlegadas;

  return (
    <section
      className="rounded-[10px] border p-5"
      style={{ borderColor: "var(--linea)", background: "var(--panel)" }}
    >
      {/* 1 · La declaración de límite va antes de cualquier dato. */}
      <div
        className="rounded-[8px] border p-4"
        style={{ borderColor: "var(--b-ambar)", background: "var(--t-ambar)" }}
      >
        <p className="text-[13.5px]" style={{ color: "var(--texto)" }}>
          <strong>
            {sinLlegadas
              ? "Ninguna unidad entró a la geocerca del destino."
              : "El sistema observó llegadas y no pudo atribuir ninguna a esta ruta."}
          </strong>{" "}
          Lo que sigue es lo que sí se observó: los recorridos guardados, sus
          medidas y sus umbrales.{" "}
          <strong>Ninguno de estos datos cambia el resultado sellado.</strong>
        </p>
        <p className="mt-2 text-[12px]" style={{ color: "var(--tenue)" }}>
          No responde si el servicio se hizo. Responde qué alcanzó a ver el
          instrumento.
        </p>
      </div>

      {/* 2 · El titular, con el conteo que exige la ley del corte. */}
      <div className="mt-5">
        <h2
          className="text-[19px] font-semibold tracking-[-.02em]"
          style={{ color: "var(--texto)" }}
        >
          {sinLlegadas ? (
            <>Ninguna de las {expediente.evaluadas} unidades evaluadas llegó al destino.</>
          ) : (
            <>
              {llegaron === 1
                ? "Una unidad llegó al destino."
                : `${llegaron} unidades llegaron al destino.`}{" "}
              Ninguna acreditó el trazado.
            </>
          )}
        </h2>

        {/*
         * «Nadie llegó» es un hallazgo, no una ausencia. Antes esto dejaba la
         * lista vacía bajo un titular de «0 unidades llegaron» — la pantalla que
         * afirma un no cumplido y no enseña una sola cosa de lo que pasó.
         * Estas tres cifras son lo que sí se puede decir, y separan las tres
         * lecturas que un transportista necesita distinguir: no fue nadie · fue
         * alguien y no se le vio · el GPS no reportó.
         */}
        {sinLlegadas ? (
          <p className="mt-1 font-mono text-[11.5px]" style={{ color: "var(--tenue)" }}>
            {sinLlegadas.conSenal} de {expediente.evaluadas} emitieron señal en la ventana ·{" "}
            {sinLlegadas.tocaronElTrazado} pisaron el corredor del trazado ·{" "}
            {sinLlegadas.puntosDeLaFlota.toLocaleString("es-MX")} puntos de la flota ese día
          </p>
        ) : (
          <p className="mt-1 font-mono text-[11.5px]" style={{ color: "var(--tenue)" }}>
            {mostradas} unidad{mostradas === 1 ? "" : "es"} relevante
            {mostradas === 1 ? "" : "s"} de {expediente.evaluadas} evaluadas
            {hayCorte ? (
              <>
                {" "}
                · {llegaron - mostradas} llegaron y no se acercaron al trazado
              </>
            ) : null}
            {expediente.criterio === "solo_llegada" ? (
              <> · ninguna se acercó al trazado contratado</>
            ) : null}
          </p>
        )}

        {sinLlegadas ? (
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--texto)" }}>
            {sinLlegadas.puntosDeLaFlota === 0
              ? "No hubo un solo punto de GPS en la ventana: el instrumento no vio nada, ni de esta ruta ni de ninguna otra."
              : mostradas === 0
                ? /*
                   * Hubo señal y nadie pisó el trazado. Antes esta rama decía
                   * «abajo, las que más se acercaron» sobre una lista vacía:
                   * prometía filas que no existen. El hecho es más fuerte dicho
                   * derecho — hubo camiones andando y ninguno sobre esta ruta.
                   */
                  `Hubo ${sinLlegadas.puntosDeLaFlota.toLocaleString("es-MX")} puntos de GPS de la flota en la ventana y ninguna de las ${expediente.evaluadas} unidades pisó el corredor del trazado contratado. Se observó movimiento; no sobre esta ruta.`
                : `Hubo unidades sobre el trazado y ninguna llegó al destino. Abajo, las ${mostradas} que más se acercaron.`}
          </p>
        ) : null}
      </div>

      {/*
       * El aviso de reconstruido, y va ANTES de los datos.
       *
       * Un dato calculado hoy y uno congelado al juzgar no pueden verse igual —
       * es la misma ley que gobierna las marcas de cada renglón, dicha para el
       * bloque entero. Aquí el hecho trae su expediente VACÍO, así que lo que se
       * enseña no salió del sello: se calculó ahora del asiento que juzgó.
       *
       * Borde de acero y no ámbar: esto es MEDICIÓN, no un estado de veredicto.
       */}
      {expediente.origen === "reconstruido" ? (
        <div
          className="mt-4 rounded-[8px] border p-3"
          style={{ borderColor: "var(--b-acero)", background: "var(--t-acero)" }}
        >
          <p className="text-[12.5px]" style={{ color: "var(--texto)" }}>
            <strong>Esto no salió del sello: se calculó ahora.</strong> El expediente de
            este servicio se congeló sin la lista de candidatas, y lo de abajo se
            reconstruyó de la evidencia guardada.{" "}
            <span style={{ color: "var(--tenue)" }}>
              El hecho sellado no se tocó — si la evidencia cambia, estos números
              cambian.
            </span>
          </p>
        </div>
      ) : null}

      {/* 3 · Qué no se preguntó en esta época — en palabras, arriba y una vez. */}
      {expediente.noSePregunto.length > 0 ? (
        <div
          className="mt-4 rounded-[8px] border border-dashed p-3"
          style={{ borderColor: "var(--linea)" }}
        >
          <p className="text-[12.5px]" style={{ color: "var(--tenue)" }}>
            <strong style={{ color: "var(--texto)" }}>
              Este servicio se selló antes de que el sistema registrara todo lo que hoy
              registra.
            </strong>{" "}
            No se preguntó: {expediente.noSePregunto.join(" · ")}. Los huecos de abajo son
            eso — preguntas que no se hicieron entonces—, no ceros.
          </p>
        </div>
      ) : null}

      {/* 4 · Las candidatas relevantes. */}
      <ul className="mt-4 space-y-3">
        {expediente.candidatas.map((c, i) => (
          <CandidataTarjeta key={c.clave || i} c={c} tz={timeZone} indice={i + 1} />
        ))}
      </ul>

      <p className="mt-4 text-[11.5px]" style={{ color: "var(--tenue)" }}>
        {sinLlegadas ? (
          mostradas === 0 ? (
            <>
              Ninguna de las {expediente.evaluadas} unidades evaluadas dejó rastro sobre
              esta ruta, así que no hay recorridos que enseñar aquí.
            </>
          ) : (
            <>
              Ninguna entró a la geocerca, así que se muestran las que más se acercaron al
              trazado contratado. Las demás de las {expediente.evaluadas} evaluadas no
              dejaron rastro sobre esta ruta.
            </>
          )
        ) : (
          <>
            Se muestran las unidades que entraron a la geocerca del destino
            {expediente.criterio === "llego_y_cerca"
              ? " y anduvieron cerca del trazado"
              : ""}
            . Las demás se evaluaron y no alcanzaron ese corte.
          </>
        )}
      </p>
    </section>
  );
}
