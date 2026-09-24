"use client";

import Link from "next/link";
import { useState } from "react";
import { LARGO_DE_LA_HUELLA, MOTIVO_MAX, huellaDeLlave } from "@jtel/domain";
import { clases, estiloTitularDePanel } from "@/components/casa/formulario";

/**
 * Los paneles de la pantalla Lectores.
 *
 * Son formularios de verdad que postean a `/api/casa/lectores`: el cliente sólo
 * filtra listas y calcula la huella mientras se teclea. **Todo lo que decide
 * —si procede, quién actuó, a qué hora— lo vuelve a decidir el servidor.**
 */

/**
 * La huella, grande, para comparar a ojo con la que el aparato enseña
 * (decisión de ASAV, 23-sep-2026).
 *
 * Seis caracteres no son una garantía criptográfica y no pretenden serlo: la
 * llave entera es la que se pega y la que se guarda. Son lo que un humano
 * puede comparar de un vistazo **con el teléfono en la otra mano**, que es la
 * tarea de verdad; cotejar 64 hexadecimales es la que nadie hace bien.
 */
export function Huella({ llave, tamano = 22 }: { llave: string; tamano?: number }) {
  const huella = huellaDeLlave(llave);
  if (!huella) return null;
  return (
    <span
      data-medida
      className="tracking-[0.18em] text-[var(--tinta)]"
      style={{ fontSize: `${tamano}px`, fontWeight: 500 }}
      aria-label={`Huella de la llave: ${huella.split("").join(" ")}`}
    >
      {huella}
    </span>
  );
}

export function PanelDeAlta({
  carriers,
  llave: llaveInicial,
  cancelar,
}: {
  carriers: { id: string; nombre: string }[];
  /** Lo tecleado que regresó con un aviso, para no volver a copiarlo. */
  llave: string;
  cancelar: string;
}) {
  const [llave, setLlave] = useState(llaveInicial);
  const limpia = llave.trim().toLowerCase();

  return (
    <form method="post" action="/api/casa/lectores" className={clases.panel}>
      <input type="hidden" name="accion" value="alta" />
      <h2 className="text-[17px]" style={estiloTitularDePanel}>
        Dar de alta un lector
      </h2>

      <p className={clases.ayuda}>
        El aparato enseña su llave en cuanto se abre <span data-medida>/validador</span>, con un
        botón para compartirla. El nombre lo pone el sistema: el siguiente consecutivo, que no se
        reutiliza ni se renumera.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="llave" className="text-[13px]">
          Llave pública del lector
        </label>
        <input
          id="llave"
          name="llave"
          value={llave}
          onChange={(e) => setLlave(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className={`${clases.campo} font-[family-name:var(--letra-medida)]`}
          placeholder="64 caracteres hexadecimales"
        />
        {/*
          La huella aparece mientras se teclea y se compara con la del aparato.
          Vacía cuando la llave todavía no es una llave: enseñar seis
          caracteres de algo mal pegado invitaría a darlos por buenos.
        */}
        <div className="flex min-h-[30px] items-center gap-3">
          {huellaDeLlave(limpia) ? (
            <>
              <span className={clases.ayuda}>Últimos {LARGO_DE_LA_HUELLA}, para comparar:</span>
              <Huella llave={limpia} />
            </>
          ) : (
            <span className={clases.ayuda}>
              {limpia.length > 0 ? `Van ${limpia.length} de 64 caracteres` : " "}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="carrier" className="text-[13px]">
          Transportista
        </label>
        <select id="carrier" name="carrier" className={clases.campo} defaultValue="">
          <option value="" disabled>
            Escoge de quién es el lector
          </option>
          {carriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <p className={clases.ayuda}>
          Se pregunta siempre. La unidad se le pone después, desde su ficha: un lector nace en
          bodega y se monta cuando hay camión.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={clases.primario}>
          Dar de alta
        </button>
        <Link href={cancelar} className={clases.secundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

export function PanelAsignar({
  lectorId,
  unidades,
  cancelar,
}: {
  lectorId: string;
  /** Las activas y libres de su transportista. */
  unidades: { id: string; label: string }[];
  cancelar: string;
}) {
  const [buscar, setBuscar] = useState("");
  const filtradas = unidades.filter((u) => u.label.toLowerCase().includes(buscar.trim().toLowerCase()));

  return (
    <form method="post" action="/api/casa/lectores" className={clases.panel}>
      <input type="hidden" name="accion" value="asignar" />
      <input type="hidden" name="lectorId" value={lectorId} />
      <h2 className="text-[17px]" style={estiloTitularDePanel}>
        Montar en una unidad
      </h2>

      {unidades.length === 0 ? (
        <p className={clases.ayuda}>
          Este transportista no tiene ninguna unidad activa y libre. Una unidad que ya trae lector
          no se ofrece: sólo cabe uno, y montarlo ahí soltaría al otro sin decirlo.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="buscar" className="text-[13px]">
              Buscar unidad
            </label>
            <input
              id="buscar"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className={clases.campo}
              placeholder="Número económico"
            />
          </div>
          <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {filtradas.map((u) => (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--linea)] px-3 py-2.5 text-[15px] hover:bg-[var(--roce)]"
              >
                <input type="radio" name="unitId" value={u.id} required />
                <span data-medida>{u.label}</span>
              </label>
            ))}
            {filtradas.length === 0 && <p className={clases.ayuda}>Ninguna con ese número.</p>}
          </div>
        </>
      )}

      <p className={clases.ayuda}>
        Sólo se ofrecen las <b>activas, libres y de su mismo transportista</b>: un lector en el
        camión de otra cuenta haría que el libro no pudiera decir a quién le toca ese viaje.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={clases.primario} disabled={unidades.length === 0}>
          Montar
        </button>
        <Link href={cancelar} className={clases.secundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

export function PanelConMotivo({
  lectorId,
  accion,
  titulo,
  boton,
  nota,
  motivo: motivoInicial,
  cancelar,
}: {
  lectorId: string;
  accion: "soltar" | "baja";
  titulo: string;
  boton: string;
  nota: React.ReactNode;
  motivo: string;
  cancelar: string;
}) {
  const [motivo, setMotivo] = useState(motivoInicial);

  return (
    <form method="post" action="/api/casa/lectores" className={clases.panel}>
      <input type="hidden" name="accion" value={accion} />
      <input type="hidden" name="lectorId" value={lectorId} />
      <h2 className="text-[17px]" style={estiloTitularDePanel}>
        {titulo}
      </h2>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`motivo-${accion}`} className="text-[13px]">
          Motivo
        </label>
        <input
          id={`motivo-${accion}`}
          name="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={MOTIVO_MAX}
          className={clases.campo}
          placeholder="Por qué"
          required
        />
        <p className={clases.ayuda}>
          El motivo no es opcional: es lo que convierte una fecha en historia. Queda con quién lo
          hizo.
        </p>
      </div>

      <p className={clases.nota}>{nota}</p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={clases.primario}>
          {boton}
        </button>
        <Link href={cancelar} className={clases.secundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
