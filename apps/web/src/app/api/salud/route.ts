import { NextResponse } from "next/server";
import { getRepos, isDatabaseConfigured } from "@/lib/db";
import { evaluarSalud, diagnostico, UMBRALES_SALUD } from "@jtel/services";

export const dynamic = "force-dynamic";

/**
 * Estado de salud de la plataforma, para un vigilante EXTERNO.
 *
 * 200 = sano · 503 = enfermo. El código de estado es el contrato: quien vigila
 * no debería tener que interpretar el cuerpo para saber si gritar.
 *
 * Sin autenticación por omisión, y es deliberado. El vigilante corre en GitHub
 * Actions, fuera de Vercel y fuera de Neon; darle un secreto sería devolverle a
 * la cadena justo el eslabón que la rompió —una credencial que caduca—. Si
 * `SALUD_TOKEN` está definida, se exige; si no, la ruta es abierta.
 *
 * Por eso el cuerpo NO lleva nombres de clientes, plantas, rutas, carriers ni
 * IMEIs: solo antigüedades, umbrales y conteos. Nada que identifique operación.
 */

function responder(estado: "sano" | "enfermo", cuerpo: Record<string, unknown>) {
  return NextResponse.json(
    { estado, ...cuerpo },
    {
      status: estado === "sano" ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}

export async function GET(request: Request) {
  const token = process.env.SALUD_TOKEN;
  const autenticado = Boolean(token) && request.headers.get("authorization") === `Bearer ${token}`;
  if (token && !autenticado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ahora = new Date();

  if (!isDatabaseConfigured()) {
    return responder("enfermo", {
      diagnostico: "DATABASE_URL no está configurada",
      chequeos: [],
      ahora: ahora.toISOString(),
    });
  }

  try {
    const repos = getRepos();

    // ── La sonda de esquema, antes que nada ──────────────────────────────
    //
    // El 2026-08-02 la cara cliente entera devolvió 500 —monitoreo, cierre,
    // cumplimiento, pendiente por evidencia— con
    // `column compliance_facts.declared_driver_name does not exist`, y **esta
    // ruta siguió respondiendo 200 durante todo el episodio.**
    //
    // No por casualidad: todo lo que vigilaba —cuentas, marcas de agua,
    // alertas— se lee con listas explícitas de columnas, y una lista explícita
    // no se entera de que falte una columna que no nombra. La API relacional
    // de Drizzle pide TODAS las columnas de la tabla, y ahí es donde el hueco
    // revienta. El vigilante miraba el único estilo de consulta que no podía
    // fallar.
    //
    // Va primero y su fallo es terminal: un esquema que no sirve a las
    // pantallas es un producto caído, por muy fresca que venga la telemetría.
    // Decirlo en ese orden es la diferencia entre un 503 que explica y un 200
    // que miente.
    try {
      await repos.occurrences.sondaDeEsquema();
    } catch (err) {
      console.error("[api/salud] sonda de esquema", err);
      return responder("enfermo", {
        diagnostico:
          "el esquema de la base no sirve la consulta que usan las pantallas del cliente",
        ...(autenticado
          ? { error: err instanceof Error ? err.message.slice(0, 200) : "desconocido" }
          : {}),
        chequeos: [],
        ahora: ahora.toISOString(),
      });
    }

    // Las cuentas demo no se vigilan: archivarlas fue sacarlas de la vista, y
    // una demo sin telemetría no es una falla de plataforma.
    const carriers = await repos.accounts.listByType("carrier", { includeDemo: false });
    const reales = new Set(carriers.map((c) => c.id));

    const [marcasTodas, abiertas] = await Promise.all([
      repos.telemetry.listWatermarks(),
      repos.ingestAlerts.listUnresolved(100),
    ]);

    const marcas = marcasTodas
      .filter((m) => reales.has(m.carrierAccountId))
      .map((m) => ({ lastRecordedAt: m.lastRecordedAt, updatedAt: m.updatedAt }));

    const criticas = abiertas.filter((a) => a.severity === "critical");

    const resultado = evaluarSalud(
      {
        ahora,
        marcas,
        carriersEsperados: carriers.length,
        alertasCriticasAbiertas: criticas.length,
        alertaCriticaMasAntigua: criticas.length
          ? criticas.reduce((v, a) => (a.createdAt < v ? a.createdAt : v), criticas[0]!.createdAt)
          : null,
      },
      UMBRALES_SALUD,
    );

    return responder(resultado.estado, {
      diagnostico: diagnostico(resultado),
      chequeos: resultado.chequeos,
      ahora: ahora.toISOString(),
    });
  } catch (err) {
    // Que la base no responda ES el fallo que este endpoint existe para
    // delatar. Nunca debe salir como excepción sin explicar.
    //
    // El detalle del driver solo viaja si quien pregunta se autenticó: trae la
    // consulta con nombres de columnas, y en una ruta abierta eso es regalar
    // esquema a cambio de nada.
    console.error("[api/salud]", err);
    return responder("enfermo", {
      diagnostico: "no se pudo consultar la base",
      ...(autenticado
        ? { error: err instanceof Error ? err.message.slice(0, 200) : "desconocido" }
        : {}),
      chequeos: [],
      ahora: ahora.toISOString(),
    });
  }
}
