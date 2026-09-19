import Link from "next/link";
import { LICENCIA_MAX, NOMBRE_DE_CHOFER_MAX } from "@jtel/domain";
import { clases, estiloTitularDePanel } from "@/components/casa/formulario";

/**
 * El panel de la identidad de un chofer — Choferes V1. El mismo para dar de
 * alta (en el cajón Choferes) y para corregir (en Ver ‹chofer›), como el de la
 * unidad (C4-e).
 *
 * El alta pide lo mínimo que identifica (Plan-Choferes §3): nombre y número de
 * licencia. **El vencimiento** sólo se pide al dar de alta y sólo si el
 * catálogo del mercado tiene el papel «Licencia»: ahí se guarda (enmienda 2).
 * Sin ese papel no tiene dónde vivir, y un campo que no guarda nada no se
 * dibuja. Después se renueva o se corrige en su papel, no aquí.
 *
 * Es un formulario HTML que va a `/api/casa/choferes`. Si la ruta lo rechaza,
 * regresa con el error en palabras y lo tecleado.
 */
export function PanelDeIdentidadDeChofer({
  modo,
  cuenta,
  driverId,
  valores,
  pideVencimiento,
  error,
  cancelar,
}: {
  modo: "alta" | "corregir";
  cuenta: string;
  driverId?: string;
  valores: { nombre: string; licencia: string; venceEl: string };
  /** El catálogo del mercado tiene «Licencia». Sólo cuenta en el alta. */
  pideVencimiento: boolean;
  error: string | null;
  cancelar: string;
}) {
  const titulo = modo === "alta" ? "Dar de alta un chofer" : "Corregir la identidad";
  return (
    <form action="/api/casa/choferes" method="post" className={clases.panel} aria-label={titulo}>
      <h3 className="text-[17px]" style={estiloTitularDePanel}>
        {titulo}
      </h3>
      <input type="hidden" name="account" value={cuenta} />
      <input type="hidden" name="accion" value={modo} />
      {driverId && <input type="hidden" name="driverId" value={driverId} />}

      {error && (
        <p role="alert" className={clases.aviso}>
          {error}
        </p>
      )}

      <Campo nombre="nombre" etiqueta="Nombre completo" valor={valores.nombre} max={NOMBRE_DE_CHOFER_MAX} requerido ayuda="No se repite en esta cuenta." />
      <Campo
        nombre="licencia"
        etiqueta="Número de licencia"
        valor={valores.licencia}
        max={LICENCIA_MAX}
        requerido
        medida
        ayuda="Como viene impresa. No se repite en esta cuenta."
      />
      {modo === "alta" && pideVencimiento && (
        <Campo
          nombre="venceEl"
          etiqueta="Vence el"
          valor={valores.venceEl}
          max={10}
          tipo="date"
          medida
          ayuda="Opcional, si la licencia lo trae. Se guarda como su papel «Licencia»."
        />
      )}

      {modo === "corregir" && (
        <p className={clases.nota}>
          Corregir sobrescribe: el chofer se leerá con el nombre nuevo, y no queda registro de cómo se llamaba antes. Si
          cambia el número de licencia, también se corrige el folio de su papel «Licencia».
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={clases.primario}>
          {modo === "alta" ? "Dar de alta" : "Guardar"}
        </button>
        <Link href={cancelar} className={clases.secundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function Campo({
  nombre,
  etiqueta,
  valor,
  max,
  tipo = "text",
  requerido = false,
  medida = false,
  ayuda,
}: {
  nombre: string;
  etiqueta: string;
  valor: string;
  max: number;
  tipo?: "text" | "date";
  requerido?: boolean;
  medida?: boolean;
  ayuda: string;
}) {
  const id = `chofer-${nombre}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] text-[var(--tenue)]">
        {etiqueta}
      </label>
      <input
        id={id}
        name={nombre}
        type={tipo}
        defaultValue={valor}
        maxLength={tipo === "text" ? max : undefined}
        required={requerido}
        autoComplete="off"
        spellCheck={false}
        aria-describedby={`${id}-ayuda`}
        className={clases.campo}
        {...(medida ? { "data-medida": true, style: tipo === "text" ? { textTransform: "uppercase" as const } : undefined } : {})}
      />
      <span id={`${id}-ayuda`} className={clases.ayuda}>
        {ayuda}
      </span>
    </div>
  );
}
