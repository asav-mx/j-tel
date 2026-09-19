import Link from "next/link";
import { NOMBRE_DE_UNIDAD_MAX, PLACA_MAX } from "@jtel/domain";
import { clases, estiloTitularDePanel } from "@/components/casa/formulario";

/**
 * El panel de la identidad de una unidad — C4-e. El mismo para dar de alta
 * (en el cuarto Expedientes) y para corregir (en Ver ‹unidad›): son los mismos
 * tres datos, y dos formularios distintos terminarían pidiéndolos distinto.
 *
 * Es un formulario HTML que va a `/api/casa/unidades`. Si la ruta lo rechaza,
 * regresa con el error en palabras y lo tecleado, y aquí se vuelve a pintar.
 */
export function PanelDeIdentidadDeUnidad({
  modo,
  cuenta,
  unitId,
  valores,
  error,
  cancelar,
}: {
  modo: "alta" | "corregir";
  cuenta: string;
  unitId?: string;
  valores: { nombre: string; placa: string; vin: string };
  error: string | null;
  cancelar: string;
}) {
  const titulo = modo === "alta" ? "Dar de alta una unidad" : "Corregir la identidad";
  return (
    <form action="/api/casa/unidades" method="post" className={clases.panel} aria-label={titulo}>
      <h3 className="text-[17px]" style={estiloTitularDePanel}>
        {titulo}
      </h3>
      <input type="hidden" name="account" value={cuenta} />
      <input type="hidden" name="accion" value={modo} />
      {unitId && <input type="hidden" name="unitId" value={unitId} />}

      {error && (
        <p role="alert" className={clases.aviso}>
          {error}
        </p>
      )}

      <Campo
        nombre="nombre"
        etiqueta="Número económico"
        valor={valores.nombre}
        max={NOMBRE_DE_UNIDAD_MAX}
        requerido
        ayuda="No se repite en esta cuenta."
      />
      <Campo nombre="placa" etiqueta="Placa" valor={valores.placa} max={PLACA_MAX} ayuda="Opcional." />
      <Campo
        nombre="vin"
        etiqueta="VIN"
        valor={valores.vin}
        max={40}
        medida
        ayuda="Opcional. 17 letras y números, sin I, O ni Q."
      />

      {modo === "corregir" && (
        <p className={clases.nota}>
          Corregir sobrescribe: toda la historia de la unidad se leerá con el nombre nuevo, y no queda registro de cómo se
          llamaba antes.
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
  requerido = false,
  medida = false,
  ayuda,
}: {
  nombre: string;
  etiqueta: string;
  valor: string;
  max: number;
  requerido?: boolean;
  medida?: boolean;
  ayuda: string;
}) {
  const id = `unidad-${nombre}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] text-[var(--tenue)]">
        {etiqueta}
      </label>
      <input
        id={id}
        name={nombre}
        defaultValue={valor}
        maxLength={max}
        required={requerido}
        autoComplete="off"
        spellCheck={false}
        aria-describedby={`${id}-ayuda`}
        className={clases.campo}
        {...(medida ? { "data-medida": true, style: { textTransform: "uppercase" as const } } : {})}
      />
      <span id={`${id}-ayuda`} className={clases.ayuda}>
        {ayuda}
      </span>
    </div>
  );
}
