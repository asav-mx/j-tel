"use client";

import { useEffect, useMemo, useState } from "react";
import { VENTANA_MS } from "@jtel/domain/boleto";
import {
  PAQUETES,
  TARIFA_MXN,
  codigoParaDictar,
  precioDe,
  viajesDisponibles,
  viajesPorConfirmar,
  type BoletoDelTelefono,
  type Movimiento,
  type Pase,
} from "@/lib/ontoy/pase";
import { textoDelQr } from "@/lib/ontoy/pase-del-telefono";
import { CodigoQr } from "@/components/ontoy/codigo-qr";
import { BandaRd } from "@/components/ontoy/banda-rd";

/**
 * **Tu pase** — la cartera del pasajero (8.14; Ontoy 3.0 · PR P2).
 *
 * Tres pantallas dentro de un lugar de la barra: el pase, el QR y la compra.
 * Toda pantalla tiene su salida (8.10): el QR y la compra vuelven con su botón,
 * y la barra sigue abajo.
 *
 * ## Lo que esta pantalla no afirma
 *
 * El teléfono **no tiene canal con el lector**. Cuando enseñas el pase, lo único
 * que consta es que lo enseñaste: si el chofer te dejó subir o no, aquí no se
 * sabe. Por eso el número de viajes baja —no vaya a ser que lo uses dos veces
 * creyendo que te sobra— pero el renglón se queda **por confirmar** hasta que
 * alguien sincronice, y no dice ni la ruta ni la unidad, porque no las sabe.
 *
 * Decidido por Asav el 23-sep-2026, sobre tres opciones. Es la única que no
 * afirma lo que no comprobó.
 */
export function VistaPase({
  pase,
  disponible,
  alComprar,
  alMostrar,
  alAlternarCuenta,
}: {
  pase: Pase;
  disponible: boolean;
  alComprar: (viajes: number) => void;
  alMostrar: () => BoletoDelTelefono | null;
  alAlternarCuenta: () => void;
}) {
  const [pantalla, setPantalla] = useState<"pase" | "qr" | "comprar">("pase");
  const [boleto, setBoleto] = useState<BoletoDelTelefono | null>(null);
  const [papelAbierto, setPapelAbierto] = useState(false);

  const disponibles = viajesDisponibles(pase);
  const porConfirmar = viajesPorConfirmar(pase);

  if (pantalla === "qr" && boleto) {
    return (
      <PantallaQr
        boleto={boleto}
        alVolver={() => {
          setBoleto(null);
          setPantalla("pase");
        }}
      />
    );
  }

  if (pantalla === "comprar") {
    return (
      <PantallaComprar
        alComprar={(viajes) => {
          alComprar(viajes);
          setPantalla("pase");
        }}
        alVolver={() => setPantalla("pase")}
      />
    );
  }

  return (
    <div className="ontoy-vista">
      <BandaRd />
      <section className="ontoy-seccion">
        <h2 className="ontoy-seccion-titulo">Tu pase</h2>

        <div className="ontoy-pase-tarjeta">
          <div className="ontoy-pase-cifra">
            <span className="ontoy-pase-viajes">
              {disponibles} <small>{disponibles === 1 ? "viaje" : "viajes"}</small>
            </span>
            <button type="button" className="ontoy-pase-chip mono" onClick={alAlternarCuenta}>
              {pase.cuenta ? `CUENTA · ${pase.cuenta}` : "AL PORTADOR"}
            </button>
          </div>

          {porConfirmar > 0 && (
            <p className="ontoy-pase-pendiente">
              {porConfirmar === 1 ? "Un viaje enseñado" : `${porConfirmar} viajes enseñados`} que
              nadie ha confirmado. <b>No sabemos si te dejaron subir:</b> el lector no le habla a tu
              teléfono. Se aclara cuando haya señal.
            </p>
          )}

          <p className="ontoy-pase-nota">
            {pase.cuenta ? (
              <>
                Tus viajes están ligados a tu cuenta: si pierdes el teléfono, entras en otro y{" "}
                <b>siguen ahí</b>.
              </>
            ) : (
              <>
                Este pase vive <b>sólo en este teléfono</b>, como traer efectivo: si lo pierdes, se
                pierde. Con una cuenta se puede recuperar.
              </>
            )}
          </p>

          <p className="ontoy-pase-tarifa">
            Tarifa vigente <b className="mono">${TARIFA_MXN}.00</b> · la fija el gobierno del estado
          </p>
        </div>

        {!disponible && (
          <p className="ontoy-vacio">
            Este navegador no deja guardar nada, así que aquí no se puede traer un pase. Todo lo
            demás de Ontoy funciona igual.
          </p>
        )}

        <button
          type="button"
          className="ontoy-boton"
          disabled={disponibles === 0 && porConfirmar === 0}
          onClick={() => {
            const elegido = alMostrar();
            if (elegido) {
              setBoleto(elegido);
              setPantalla("qr");
            }
          }}
        >
          Mostrar para subir
        </button>

        {disponibles === 0 && porConfirmar === 0 && (
          <p className="ontoy-pase-ayuda">
            No traes viajes. Compra unos, o paga tu camión en efectivo como siempre.
          </p>
        )}

        <button
          type="button"
          className="ontoy-boton ontoy-boton-segundo"
          onClick={() => setPantalla("comprar")}
        >
          Comprar viajes
        </button>

        <button
          type="button"
          className="ontoy-boton ontoy-boton-segundo"
          aria-expanded={papelAbierto}
          onClick={() => setPapelAbierto((x) => !x)}
        >
          Imprimir un pase de papel
        </button>
        {papelAbierto && (
          <p className="ontoy-pase-ayuda">
            Una hoja con un viaje en QR impreso, para regalar o por si el teléfono se muere. Llega
            con el lector: un papel no sirve hasta que algo pueda leerlo.
          </p>
        )}

        <h3 className="ontoy-pase-rotulo mono">Movimientos</h3>
        {pase.movimientos.length === 0 ? (
          <p className="ontoy-vacio">Todavía no hay movimientos.</p>
        ) : (
          <ul className="ontoy-pase-movs">
            {pase.movimientos.map((m, i) => (
              <RenglonDeMovimiento key={`${m.cuando}-${i}`} movimiento={m} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RenglonDeMovimiento({ movimiento }: { movimiento: Movimiento }) {
  const hora = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(movimiento.cuando));

  return (
    <li className="ontoy-pase-mov">
      <span className="ontoy-pase-mov-que">
        <span className="mono ontoy-pase-mov-hora">{hora}</span> · {movimiento.que}
        {movimiento.porConfirmar && (
          <span className="ontoy-pase-mov-pendiente"> · sin confirmar</span>
        )}
      </span>
      <span className="mono ontoy-pase-mov-cambio">
        {movimiento.cambio > 0 ? `+${movimiento.cambio}` : movimiento.cambio}
      </span>
    </li>
  );
}

/**
 * El QR, rotando.
 *
 * El anillo es un contador de 5 segundos: **es el único punto de color de la
 * pantalla, y va en cobre** porque el cobre es del dato que cambia mientras
 * alguien lo mira, que es exactamente lo que hace. Se mueve porque algo se está
 * gastando de verdad, no para gustar (`prefers-reduced-motion` lo deja quieto,
 * y el número sigue siendo cierto porque el ancho se recalcula igual).
 */
function PantallaQr({ boleto, alVolver }: { boleto: BoletoDelTelefono; alVolver: () => void }) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(reloj);
  }, []);

  const ventana = Math.floor(ahora / VENTANA_MS);
  const texto = useMemo(
    () => textoDelQr(boleto, ventana * VENTANA_MS),
    [boleto, ventana],
  );
  const restante = VENTANA_MS - (ahora % VENTANA_MS);
  const folio = boleto.sellado.cuerpo.folio;

  return (
    <div className="ontoy-vista">
      <BandaRd />
      <section className="ontoy-seccion ontoy-qr">
        <h2 className="ontoy-seccion-titulo">Muestra esto al lector</h2>

        <div className="ontoy-qr-caja">
          <CodigoQr texto={texto} etiqueta={`Código del pase, folio ${folio}`} />
        </div>

        <div
          className="ontoy-qr-anillo"
          role="timer"
          aria-label={`El código cambia en ${Math.ceil(restante / 1000)} segundos`}
        >
          <i style={{ width: `${(restante / VENTANA_MS) * 100}%` }} />
        </div>

        <p className="ontoy-qr-folio mono">FOLIO {folio}</p>
        <p className="ontoy-qr-nota">
          El código cambia solo <b>cada 5 s</b> y sirve una vez. Funciona <b>sin señal</b>: el lector
          lo revisa en el camión.
        </p>
        <p className="ontoy-qr-dictar">
          Si la cámara no puede, dicta: <b className="mono">{codigoParaDictar(folio)}</b>
        </p>

        <button type="button" className="ontoy-boton ontoy-boton-segundo" onClick={alVolver}>
          ‹ Volver al pase
        </button>
      </section>
    </div>
  );
}

function PantallaComprar({
  alComprar,
  alVolver,
}: {
  alComprar: (viajes: number) => void;
  alVolver: () => void;
}) {
  return (
    <div className="ontoy-vista">
      <BandaRd />
      <section className="ontoy-seccion">
        <h2 className="ontoy-seccion-titulo">Comprar viajes</h2>

        {PAQUETES.map((p) => (
          <button
            key={p.viajes}
            type="button"
            className="ontoy-paquete"
            onClick={() => alComprar(p.viajes)}
          >
            <span className="ontoy-paquete-que">
              <span className="ontoy-paquete-n">
                {p.viajes} {p.viajes === 1 ? "viaje" : "viajes"}
              </span>
              <span className="ontoy-paquete-apodo">{p.apodo}</span>
            </span>
            <span className="ontoy-paquete-precio mono">${precioDe(p.viajes)}</span>
          </button>
        ))}

        <p className="ontoy-pase-nota">
          Sin descuentos: la tarifa la fija el estado, y el paquete sólo te ahorra sacar el teléfono
          a pagar cada vez. <b>El cobro es simulado</b> — no se conecta ningún banco.
        </p>

        <button type="button" className="ontoy-boton ontoy-boton-segundo" onClick={alVolver}>
          ‹ Volver al pase
        </button>
      </section>
    </div>
  );
}
