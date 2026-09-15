/**
 * Re-verifica un día de un contrato: re-ingiere evidencia desde memoria y
 * aplica asignación exclusiva de unidades (calles compartidas).
 *
 * ## Esto re-sella veredictos, y por eso pide un sí
 *
 * Con `force`, cada servicio del día pierde su hecho sellado y recibe uno
 * nuevo. No escribe datos: **re-emite el juicio sobre la jornada de un
 * cliente**. El Marco: «el hecho no se reescribe nunca; la justificación se
 * adjunta y la consecuencia se ajusta».
 *
 * Hasta el 14 de septiembre de 2026 bastaba con correrlo: sin `--aplicar`, sin
 * lista y sin confirmación, contra `DATABASE_URL`. Ahora:
 *
 *   · **Sin `--aplicar` sólo simula.** Enseña qué servicios re-sellaría, con su
 *     veredicto de hoy y cuándo se selló, y no escribe nada.
 *   · **Con `--aplicar`** enseña la misma lista y espera que una persona teclee
 *     `RESELLAR <n>`, con `n` = veredictos ya sellados que se van a reescribir.
 *     Sólo desde una terminal: una confirmación por tubería no es de nadie.
 *   · **Lo autorizado es lo que se hace.** Los ids de la lista viajan al motor,
 *     y si el día cambió entre la lista y el sí, no se re-sella nada.
 *   · **La lista se lee con la base de solo lectura**; el usuario dueño sólo se
 *     abre después del sí.
 *
 * Uso:
 *   SERVICE_DATE=2026-07-09 CONTRACT=campus \
 *     pnpm --filter @jtel/services exec tsx src/reverify-day.ts            # simula
 *   SERVICE_DATE=2026-07-09 CONTRACT=campus \
 *     pnpm --filter @jtel/services exec tsx src/reverify-day.ts --aplicar  # pide el sí
 */
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { createDb, createRepositories } from "@jtel/db";
import { JTTEL_TZ } from "@jtel/domain";
import { VerificationService } from "./verification.js";
import {
  confirma,
  fraseDeConfirmacion,
  modoDeResello,
  planDeResello,
  resumenDelPlan,
  tablaDelPlan,
} from "./resello.js";

for (const p of ["../../.env", ".env"]) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
      break;
    } catch {
      /* ignore */
    }
  }
}

function salir(mensaje: string): never {
  console.error(`\n  ✗ [reverify-day] ${mensaje}\n`);
  process.exit(1);
}

async function main() {
  const modo = modoDeResello(process.argv);

  const serviceDate = process.env.SERVICE_DATE;
  if (!serviceDate || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    salir("Falta SERVICE_DATE=YYYY-MM-DD");
  }

  const contractIdEnv = process.env.CONTRACT_ID?.trim();
  const contractEnv = process.env.CONTRACT?.trim();
  if (!contractIdEnv && !contractEnv) {
    salir(
      "Define CONTRACT=<nombre_o_fragmento> o CONTRACT_ID=<uuid>. El alcance debe ser explícito — no hay valor por defecto.",
    );
  }

  // La lista se lee con la base de solo lectura. Sin ella no hay lista, y sin
  // lista no hay nada que autorizar.
  const lectura = process.env.DATABASE_URL_READONLY;
  if (!lectura) salir("Falta DATABASE_URL_READONLY: la lista de lo que se re-sellaría se lee con ella.");
  const reposLectura = createRepositories(createDb(lectura));

  const filter = contractEnv?.toLowerCase() ?? "";
  const clients = await reposLectura.accounts.listByType("client");
  const contracts = [];
  for (const client of clients) {
    contracts.push(...(await reposLectura.contracts.findForClient(client.id)));
  }
  const candidatos = contractIdEnv
    ? contracts.filter((c) => c.id === contractIdEnv)
    : contracts.filter((c) => {
        const hay = `${c.name ?? ""} ${c.plantGroup?.name ?? ""} ${c.plant?.name ?? ""}`.toLowerCase();
        return filter.split("|").some((f) => hay.includes(f.trim()));
      });

  if (candidatos.length === 0) {
    salir(
      "No se encontró contrato. Contratos:\n    " +
        contracts.map((c) => `${c.id} · ${c.name} / ${c.plantGroup?.name ?? c.plant?.name ?? "?"}`).join("\n    "),
    );
  }
  // Antes tomaba el primero que coincidiera con el fragmento. Para re-sellar,
  // «el primero» no es un alcance: si hay dos, se nombra uno.
  if (candidatos.length > 1) {
    salir(
      `«${contractEnv}» coincide con ${candidatos.length} contratos. Usa CONTRACT_ID:\n    ` +
        candidatos.map((c) => `${c.id} · ${c.name}`).join("\n    "),
    );
  }
  const contract = candidatos[0]!;

  const plan = planDeResello(await reposLectura.occurrences.findForContract(contract.id), serviceDate);
  const r = resumenDelPlan(plan);

  console.log(`\n  ${contract.name} (${contract.plantGroup?.name ?? contract.plant?.name ?? ""}) · ${serviceDate}`);
  console.log(`  ${contract.id}\n`);
  if (plan.length === 0) {
    console.log("  No hay servicios con viaje ese día. Nada que re-sellar.\n");
    process.exit(0);
  }
  console.log(tablaDelPlan(plan, JTTEL_TZ));
  console.log(
    `\n  ${r.total} servicios · ${r.yaSellados} ya sellados que se REESCRIBIRÍAN ` +
      `(${r.porVeredicto.cumplido} cumplido, ${r.porVeredicto.no_cumplido} no cumplido, ` +
      `${r.porVeredicto.pendiente_evidencia} pendiente) · ${r.sinHecho} sin hecho todavía`,
  );
  console.log("  Modo: force · re-ingesta desde memoria (keepEvidence:false) · unidades exclusivas\n");

  if (modo === "simulacion") {
    console.log("  SIMULACIÓN: no se escribió nada. Para re-sellar, vuelve a correrlo con --aplicar.\n");
    process.exit(0);
  }

  if (!process.stdin.isTTY) {
    salir("--aplicar necesita una terminal: el sí lo teclea una persona, no una tubería.");
  }
  const escritura = process.env.DATABASE_URL;
  if (!escritura) salir("Falta DATABASE_URL para escribir.");

  const frase = fraseDeConfirmacion(plan);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let respuesta: string | null = null;
  try {
    respuesta = await rl.question(
      `  Esto re-emite el juicio de ${r.yaSellados} veredictos ya entregados.\n  Para seguir, escribe exactamente «${frase}»: `,
    );
  } catch {
    // La entrada se cerró sin respuesta (Ctrl-D, terminal cerrada). Sin
    // respuesta no hay sí.
  } finally {
    rl.close();
  }
  if (!confirma(respuesta, plan)) {
    salir("No coincide. No se re-selló nada.");
  }

  const repos = createRepositories(createDb(escritura));
  const svc = new VerificationService(repos);
  const results = await svc.reverifyContract(contract.id, {
    serviceDate,
    keepEvidence: false,
    exclusiveUnits: true,
    actorKind: "system:cli",
    actorId: null,
    actorIntent: "decision",
    esperadas: plan.map((s) => s.occurrenceId),
  });

  // Lo que cambió, servicio por servicio: el antes viene de la lista autorizada.
  const antes = new Map(plan.map((s) => [s.occurrenceId, s]));
  let cambiaron = 0;
  for (const res of results as Array<{ occurrenceId: string; status?: string; error?: string }>) {
    const a = antes.get(res.occurrenceId);
    const despues = res.error ? `error: ${res.error}` : (res.status ?? "sin hecho");
    const previo = a?.veredicto ?? "sin hecho";
    if (previo !== despues) cambiaron += 1;
    console.log(`  ${a?.perfil ?? res.occurrenceId}: ${previo} → ${despues}${previo !== despues ? "   ← CAMBIÓ" : ""}`);
  }
  console.log(`\n  Re-sellados ${results.length} · cambiaron ${cambiaron}.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
