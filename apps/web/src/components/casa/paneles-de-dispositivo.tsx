"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MOTIVO_MAX } from "@jtel/domain";
import { Pieza } from "@/components/casa/pieza";
import { clases, estiloTitularDePanel } from "@/components/casa/formulario";

/**
 * Los paneles de acción de Ver ‹dispositivo› (C4-c), contra el prototipo
 * aprobado el 17 sep 2026.
 *
 * Son formularios de verdad que postean a `/api/casa/dispositivos`: el cliente
 * sólo filtra la lista, marca la unidad elegida y llena el motivo con una
 * sugerencia. Todo lo que decide —si procede, quién actuó, a qué hora— lo
 * vuelve a decidir el servidor.
 */

type Comunes = {
  cuenta: string;
  deviceId: string;
  desde: string;
  nombre: string;
  cancelar: string;
  error: string | null;
};

/** La hora de «ahora» en la zona de la plataforma, al minuto. Se refresca sola. */
function useHoraDeAhora(inicial: string, timeZone: string) {
  const [hora, setHora] = useState(inicial);
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone });
    const tic = () => setHora(fmt.format(new Date()));
    tic();
    const id = setInterval(tic, 20_000);
    return () => clearInterval(id);
  }, [timeZone]);
  return hora;
}

export function PanelAsignar({
  cuenta,
  deviceId,
  desde,
  nombre,
  cancelar,
  error,
  unidadActual,
  unidades,
  horaInicial,
  timeZone,
}: Comunes & {
  /** El número económico donde está montado ahora, o null si está en bodega. */
  unidadActual: string | null;
  /** Las activas de la cuenta, sin la actual. */
  unidades: { id: string; numeroEconomico: string; trae: { nombre: string } | null }[];
  horaInicial: string;
  timeZone: string;
}) {
  const [buscar, setBuscar] = useState("");
  const [elegida, setElegida] = useState<string | null>(null);
  const hora = useHoraDeAhora(horaInicial, timeZone);

  // Libres primero: es lo que se busca al instalar. Dentro de cada grupo, en
  // orden numérico (ya viene así del servidor).
  const lista = unidades
    .filter((u) => u.numeroEconomico.includes(buscar))
    .sort((a, b) => Number(a.trae !== null) - Number(b.trae !== null));
  const unidad = unidades.find((u) => u.id === elegida) ?? null;

  return (
    <form action="/api/casa/dispositivos" method="post" className={clases.panel} aria-label="Asignar">
      <h3 className="text-[17px]" style={estiloTitularDePanel}>
        {unidadActual ? `Mover ${nombre} a otra unidad` : `Asignar ${nombre} a una unidad`}
      </h3>
      <input type="hidden" name="account" value={cuenta} />
      <input type="hidden" name="accion" value="asignar" />
      <input type="hidden" name="deviceId" value={deviceId} />
      <input type="hidden" name="desde" value={desde} />
      <input type="hidden" name="unitId" value={elegida ?? ""} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="buscar-unidad" className="text-[13px] text-[var(--tenue)]">
          Número económico
        </label>
        <input
          id="buscar-unidad"
          value={buscar}
          onChange={(e) => {
            setBuscar(e.target.value.replace(/\s/g, ""));
            setElegida(null);
          }}
          autoComplete="off"
          inputMode="numeric"
          placeholder={unidades[0]?.numeroEconomico ?? ""}
          data-medida
          className={clases.campo}
          autoFocus
        />
      </div>

      {error && (
        <p role="alert" className={clases.aviso}>
          {error}
        </p>
      )}

      <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto" role="group" aria-label="Unidades">
        {lista.map((u) => (
          <Pieza
            key={u.id}
            // Libre sí es un hecho: no trae dispositivo. A la ocupada el prototipo
            // le ponía el círculo de «detenida», un estado que aquí nadie midió;
            // va sin forma (skill: lo que liga sin afirmar estado, sin glifo).
            estado={u.trae ? undefined : "sin-dispositivo"}
            nombre={u.numeroEconomico}
            apoyo={u.trae ? `trae ${u.trae.nombre}` : "sin dispositivo"}
            dato={u.trae ? "ocupada" : "libre"}
            etiqueta="unidad"
            edad={null}
            alTocar={() => setElegida(u.id)}
            seleccionada={elegida === u.id}
          />
        ))}
        {lista.length === 0 && (
          <p className="rounded-lg border border-dashed border-[var(--linea)] px-4 py-3 text-[13px] text-[var(--tenue)]">
            {unidades.length === 0 ? "No hay otra unidad activa en esta cuenta" : `Ninguna unidad tiene ${buscar}`}
          </p>
        )}
      </div>

      {unidad && (
        <>
          <p className={clases.aviso}>
            Asignar <b>{nombre}</b> a <b>{unidad.numeroEconomico}</b> desde ahora, <span data-medida>{hora}</span>.
            {unidadActual && ` Sale de ${unidadActual}.`}
            {unidad.trae && ` ${unidad.numeroEconomico} trae ${unidad.trae.nombre}: ése queda en bodega.`}
          </p>
          <p className={clases.nota}>
            {unidadActual
              ? `Lo que mandó antes de este momento se queda con ${unidadActual}.`
              : "Lo que mandó antes de este momento se queda sin unidad."}
          </p>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={clases.primario} disabled={!unidad}>
          Asignar
        </button>
        <Link href={cancelar} className={clases.secundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

export function PanelMotivo({
  cuenta,
  deviceId,
  desde,
  cancelar,
  error,
  tipo,
  titulo,
  nota,
  sugerencias,
  motivoInicial,
}: Comunes & {
  tipo: "soltar" | "baja";
  titulo: string;
  nota: string;
  sugerencias: readonly string[];
  motivoInicial: string;
}) {
  const [motivo, setMotivo] = useState(motivoInicial);

  return (
    <form action="/api/casa/dispositivos" method="post" className={clases.panel} aria-label={titulo}>
      <h3 className="text-[17px]" style={estiloTitularDePanel}>
        {titulo}
      </h3>
      <input type="hidden" name="account" value={cuenta} />
      <input type="hidden" name="accion" value={tipo} />
      <input type="hidden" name="deviceId" value={deviceId} />
      <input type="hidden" name="desde" value={desde} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="motivo" className="text-[13px] text-[var(--tenue)]">
          Motivo
        </label>
        <textarea
          id="motivo"
          name="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={MOTIVO_MAX}
          rows={3}
          required
          aria-invalid={error ? true : undefined}
          className={`${clases.campo} min-h-16 resize-y text-[14px]`}
          autoFocus
        />
        <div className="flex flex-wrap gap-1.5">
          {sugerencias.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setMotivo(s)}
              className="cursor-pointer rounded-full border border-dashed border-[var(--linea)] px-2.5 py-1 text-[12.5px] text-[var(--tenue)] hover:border-[var(--tenue)] hover:text-[var(--tinta)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className={clases.aviso}>
          {error}
        </p>
      )}
      <p className={clases.nota}>{nota}</p>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={clases.primario}>
          {tipo === "soltar" ? "Soltar" : "Dar de baja"}
        </button>
        <Link href={cancelar} className={clases.secundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
