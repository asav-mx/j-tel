import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { createContractSchema, contractPolicySchema, type EnforcementRules, parseOperationalScope, operationalScopeColumns } from "@jtel/domain";
import { configApiBack } from "@/lib/config-api-back";

function back(
  request: Request,
  slug: string,
  scope: ReturnType<typeof parseOperationalScope>,
  params: Record<string, string>,
) {
  return configApiBack(request, slug, "contratos", scope, params);
}

/**
 * A dónde volver después de guardar.
 *
 * La oficina del contrato manda su propia ruta para que el usuario regrese a
 * donde estaba y no a la lista. Se acepta SOLO una ruta interna de la oficina:
 * cualquier otra cosa —una URL absoluta, un `//host`, otra sección— se ignora
 * y se cae al comportamiento de siempre. Un `returnTo` sin validar es una
 * redirección abierta.
 */
function backOficina(
  request: Request,
  formData: FormData,
  params: Record<string, string>,
): NextResponse | null {
  const raw = String(formData.get("returnTo") ?? "").trim();
  if (!/^\/cliente\/contrato\/[A-Za-z0-9-]+(\?[^#]*)?$/.test(raw)) return null;
  const url = new URL(raw, request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

function toInt(value: unknown, fallback: number): number {
  const raw = String(value ?? "").trim();
  if (raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/**
 * Para perillas OPCIONALES: un campo vacío es `undefined`, no un default.
 *
 * `toInt` no sirve aquí — su fallback volvería indistinguible "sin configurar"
 * de un número, y además haría imposible borrar el valor una vez puesto.
 * Devolver `undefined` deja la llave fuera del jsonb de la política, que es
 * exactamente lo que significa "este contrato no lo configuró".
 */
function toOptionalInt(value: unknown): number | undefined {
  const raw = String(value ?? "").trim();
  if (raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/** Como `toInt` pero conserva decimales: hay perillas que no son enteras. */
function toNumber(value: unknown, fallback: number): number {
  const raw = String(value ?? "").trim();
  if (raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Una fracción que en pantalla se escribe como porcentaje.
 *
 * `kmlOriginToleranceFraction` vive como 0–1 en la política, pero pedirle a un
 * humano "0.15" cuando quiere decir "15% del arranque de la ruta" es cómo se
 * acaban tecleando valores diez veces más grandes de lo que se quería.
 */
function fraccionDeCampoPct(value: unknown, fallback: number): number {
  const raw = String(value ?? "").trim();
  if (raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n / 100));
}

function buildEnforcementRule(formData: FormData): EnforcementRules[] {
  const type = String(formData.get("enforcementType") ?? "").trim();
  const tolerance = toInt(formData.get("enforcementTolerance"), 0);

  if (type === "no_pago_viaje") {
    return [{ type: "no_pago_viaje", toleranceMinutes: Math.max(1, tolerance) }];
  }
  if (type === "rebate_escalonado") {
    return [
      {
        type: "rebate_escalonado",
        toleranceMinutes: Math.max(1, tolerance),
        baseRebatePercent: Number(formData.get("baseRebatePercent") ?? 0),
        baseFailureCount: Math.max(1, toInt(formData.get("baseFailureCount"), 1)),
        additionalRebatePercent: Number(formData.get("additionalRebatePercent") ?? 0),
      },
    ];
  }
  if (type === "reembolso") {
    const amountRaw = String(formData.get("reembolsoAmount") ?? "").trim();
    const amount = amountRaw ? Number(amountRaw) : undefined;
    return [{ type: "reembolso", ...(amount !== undefined && Number.isFinite(amount) ? { amount } : {}) }];
  }
  return [];
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientSlug = String(formData.get("clientSlug") ?? "").trim();
  const action = String(formData.get("action") ?? "create").trim();

  const repos = getRepos();
  const client = await repos.accounts.findBySlug(clientSlug);
  if (!client || client.type !== "client") {
    const url = new URL("/cliente", request.url);
    url.searchParams.set("error", "Cliente no encontrado.");
    return NextResponse.redirect(url, 303);
  }

  if (action === "activate") {
    const contractId = String(formData.get("contractId") ?? "").trim();
    const contract = contractId ? await repos.contracts.findById(contractId) : null;
    if (!contract || contract.clientAccountId !== client.id) {
      return back(request, client.slug, null, { error: "Contrato no encontrado." });
    }
    await repos.contracts.activate(contractId);
    const scope = parseOperationalScope({
      plantId: contract.plantId,
      plantGroupId: contract.plantGroupId,
    });
    return back(request, client.slug, scope, { created: "activado" });
  }

  if (action === "updateValidity") {
    const contractId = String(formData.get("contractId") ?? "").trim();
    const validFrom = String(formData.get("validFrom") ?? "").trim();
    const validTo = String(formData.get("validTo") ?? "").trim();
    const contract = contractId ? await repos.contracts.findById(contractId) : null;
    if (!contract || contract.clientAccountId !== client.id) {
      return back(request, client.slug, null, { error: "Contrato no encontrado." });
    }
    const scope = parseOperationalScope({
      plantId: contract.plantId,
      plantGroupId: contract.plantGroupId,
    });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(validTo)) {
      return back(request, client.slug, scope, { error: "Fechas de vigencia inválidas." });
    }
    if (validFrom > validTo) {
      return back(request, client.slug, scope, {
        error: "La vigencia debe tener fecha inicio ≤ fecha fin.",
      });
    }
    await repos.contracts.updateValidity(contractId, validFrom, validTo);
    return back(request, client.slug, scope, { created: "vigencia" });
  }

  if (action === "updatePolicy") {
    const contractId = String(formData.get("contractId") ?? "").trim();
    const contract = contractId ? await repos.contracts.findById(contractId) : null;
    if (!contract || contract.clientAccountId !== client.id) {
      return back(request, client.slug, null, { error: "Contrato no encontrado." });
    }
    const scope = parseOperationalScope({
      plantId: contract.plantId,
      plantGroupId: contract.plantGroupId,
    });

    const existingPolicy = contract.policy;

    /*
     * Se parte de la política que ya existe y se encima lo que vino en el
     * formulario.
     *
     * Antes se armaba el objeto desde cero, y las perillas que ningún
     * formulario mandaba —`kmlOriginToleranceFraction`,
     * `permitirConsolidacion`— no viajaban. Como el esquema les da default,
     * zod las rellenaba y `updatePolicy` guardaba el default encima del valor
     * configurado: guardar cualquier cambio reseteaba en silencio la tolerancia
     * de origen a 0.15 y apagaba la consolidación. Un contrato con
     * consolidación permitida la perdía por editar la zona horaria, y nadie se
     * enteraba hasta ver veredictos raros.
     */
    const policyPayload = {
      ...existingPolicy,
      toleranceMinutes: toInt(formData.get("toleranceMinutes"), existingPolicy.toleranceMinutes),
      arrivalAnticipationMinutes: toInt(
        formData.get("arrivalAnticipationMinutes"),
        existingPolicy.arrivalAnticipationMinutes ?? 15,
      ),
      // Opcional: vacío BORRA el valor, no cae al anterior. Es la única forma
      // de que el contrato pueda volver a "sin hora de cierre".
      shiftCloseMinutesAfterStart: toOptionalInt(
        formData.get("shiftCloseMinutesAfterStart"),
      ),
      maxRouteDurationMinutes: toInt(
        formData.get("maxRouteDurationMinutes"),
        existingPolicy.maxRouteDurationMinutes ?? 60,
      ),
      verificationGraceMinutes: toInt(
        formData.get("verificationGraceMinutes"),
        existingPolicy.verificationGraceMinutes ?? 15,
      ),
      routeStrictness: String(formData.get("routeStrictness") ?? existingPolicy.routeStrictness).trim(),
      kmlMatchMinPct: toInt(formData.get("kmlMatchMinPct"), existingPolicy.kmlMatchMinPct ?? 60),
      kmlCorridorMeters: toInt(
        formData.get("kmlCorridorMeters"),
        existingPolicy.kmlCorridorMeters ?? 120,
      ),
      kmlCorridorMinPct: toInt(
        formData.get("kmlCorridorMinPct"),
        existingPolicy.kmlCorridorMinPct ?? 60,
      ),
      excusableReasons: formData.getAll("excusableReasons").map((r) => String(r)),
      enforcementRules: buildEnforcementRule(formData),
      evidenceMarginMinutesBefore: toInt(
        formData.get("evidenceMarginMinutesBefore"),
        existingPolicy.evidenceMarginMinutesBefore ?? 60,
      ),
      evidenceMarginMinutesAfter: toInt(
        formData.get("evidenceMarginMinutesAfter"),
        existingPolicy.evidenceMarginMinutesAfter ?? 30,
      ),
      evidenceMinCoveragePct: toInt(
        formData.get("evidenceMinCoveragePct"),
        existingPolicy.evidenceMinCoveragePct ?? 80,
      ),
      evidenceMaxGapMinutes: toInt(
        formData.get("evidenceMaxGapMinutes"),
        existingPolicy.evidenceMaxGapMinutes ?? 10,
      ),
      timeZone: String(formData.get("timeZone") ?? existingPolicy.timeZone ?? "America/Ciudad_Juarez").trim(),

      /*
       * Estas dos solo las edita la oficina del contrato. Un formulario que no
       * las trae NO debe apagarlas: por eso se preservan salvo que el
       * formulario declare explícitamente que las está editando.
       *
       * La marca es necesaria para el booleano — un checkbox desmarcado
       * simplemente no viaja, y sin la marca sería imposible distinguir
       * "lo apagué" de "mi formulario no lo tiene".
       */
      kmlOriginToleranceFraction: fraccionDeCampoPct(
        formData.get("kmlOriginToleranceFractionPct"),
        existingPolicy.kmlOriginToleranceFraction ?? 0.15,
      ),
      permitirConsolidacion: formData.has("editaConsolidacion")
        ? formData.get("permitirConsolidacion") === "on"
        : (existingPolicy.permitirConsolidacion ?? false),

      /*
       * Las perillas de la ventana derivada. No fijan el ancho: gobiernan cómo
       * el sistema lo aprende de la duración real de cada ruta. Mismo trato que
       * arriba — un formulario que no las trae las preserva, y el booleano
       * necesita su marca porque una casilla desmarcada no viaja.
       */
      windowDerivationEnabled: formData.has("editaVentanaDerivada")
        ? formData.get("windowDerivationEnabled") === "on"
        : (existingPolicy.windowDerivationEnabled ?? true),
      windowSlackPct: toNumber(
        formData.get("windowSlackPct"),
        existingPolicy.windowSlackPct ?? 25,
      ),
      routeAvgSpeedKmh: toNumber(
        formData.get("routeAvgSpeedKmh"),
        existingPolicy.routeAvgSpeedKmh ?? 20,
      ),
      maxWindowBeforeMinutes: toInt(
        formData.get("maxWindowBeforeMinutes"),
        existingPolicy.maxWindowBeforeMinutes ?? 360,
      ),
      routeDurationPercentile: toInt(
        formData.get("routeDurationPercentile"),
        existingPolicy.routeDurationPercentile ?? 90,
      ),
      routeDurationMinSamples: toInt(
        formData.get("routeDurationMinSamples"),
        existingPolicy.routeDurationMinSamples ?? 3,
      ),
    };

    const parsed = contractPolicySchema.safeParse(policyPayload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const mensaje =
        `Revisa la política: ${first?.path.join(".") || ""} ${first?.message ?? ""}`.trim();
      return (
        backOficina(request, formData, { error: mensaje }) ??
        back(request, client.slug, scope, { error: mensaje })
      );
    }

    // La política nueva aplica solo hacia adelante. Hechos definitivos
    // (cumplido / no_cumplido) no se recalculan; pendiente_evidencia sí se
    // reintenta en el cron normal (verifyOccurrence sin force).
    await repos.contracts.updatePolicy(contractId, parsed.data);

    return (
      backOficina(request, formData, { created: "politica" }) ??
      back(request, client.slug, scope, { created: "politica" })
    );
  }

  if (action === "delete") {
    const contractId = String(formData.get("contractId") ?? "").trim();
    const contract = contractId ? await repos.contracts.findById(contractId) : null;
    const scope = contract
      ? parseOperationalScope({
          plantId: contract.plantId,
          plantGroupId: contract.plantGroupId,
        })
      : null;

    const deleted = contractId
      ? await repos.contracts.deleteDraft(contractId, client.id)
      : null;
    if (!deleted) {
      return back(request, client.slug, scope, {
        error: "No se pudo eliminar. Solo borradores sin perfiles de servicio.",
      });
    }
    return back(request, client.slug, scope, { created: "eliminado" });
  }

  const plantId = String(formData.get("plantId") ?? "").trim();
  const plantGroupId = String(formData.get("plantGroupId") ?? "").trim();
  const scope = parseOperationalScope({ plantId, plantGroupId });
  if (!scope) {
    return back(request, client.slug, null, { error: "Elige una unidad operativa válida." });
  }

  const resolved = await repos.clients.resolveOperationalScope(client.id, scope);
  if (!resolved) {
    return back(request, client.slug, scope, { error: "Unidad operativa no válida." });
  }

  const scopeCols = operationalScopeColumns(resolved);

  if (action !== "create") {
    return back(request, client.slug, resolved, { error: "Acción no reconocida." });
  }

  const name = String(formData.get("name") ?? "").trim();
  const carrierAccountId = String(formData.get("carrierAccountId") ?? "").trim();
  const validFrom = String(formData.get("validFrom") ?? "").trim();
  const validTo = String(formData.get("validTo") ?? "").trim();
  const arrivalAnticipationMinutes = toInt(formData.get("arrivalAnticipationMinutes"), 15);
  const shiftCloseMinutesAfterStart = toOptionalInt(
    formData.get("shiftCloseMinutesAfterStart"),
  );
  const maxRouteDurationMinutes = toInt(formData.get("maxRouteDurationMinutes"), 60);
  const toleranceMinutes = toInt(formData.get("toleranceMinutes"), 0);
  const verificationGraceMinutes = toInt(formData.get("verificationGraceMinutes"), 15);
  const routeStrictness = String(formData.get("routeStrictness") ?? "destino_only").trim();
  const kmlMatchMinPct = toInt(formData.get("kmlMatchMinPct"), 60);
  const kmlCorridorMeters = toInt(formData.get("kmlCorridorMeters"), 120);
  const kmlCorridorMinPct = toInt(formData.get("kmlCorridorMinPct"), 60);
  const evidenceMarginMinutesBefore = toInt(formData.get("evidenceMarginMinutesBefore"), 60);
  const evidenceMarginMinutesAfter = toInt(formData.get("evidenceMarginMinutesAfter"), 30);
  const evidenceMinCoveragePct = toInt(formData.get("evidenceMinCoveragePct"), 80);
  const evidenceMaxGapMinutes = toInt(formData.get("evidenceMaxGapMinutes"), 10);
  const excusableReasons = formData.getAll("excusableReasons").map((r) => String(r));
  const timeZone = String(formData.get("timeZone") ?? "America/Ciudad_Juarez").trim();

  const payload = {
    carrierAccountId,
    clientAccountId: client.id,
    ...scopeCols,
    name,
    validFrom,
    validTo,
    status: "draft" as const,
    policy: {
      toleranceMinutes,
      arrivalAnticipationMinutes,
      // Solo viaja si el usuario lo puso: `undefined` no llega al jsonb.
      ...(shiftCloseMinutesAfterStart !== undefined
        ? { shiftCloseMinutesAfterStart }
        : {}),
      maxRouteDurationMinutes,
      verificationGraceMinutes,
      routeStrictness,
      kmlMatchMinPct,
      // kmlCorridorMeters y kmlCorridorMinPct se leían del formulario pero no
      // llegaban al payload: lo que el usuario escribía al crear el contrato se
      // perdía en silencio y el contrato nacía con el default del esquema.
      kmlCorridorMeters,
      kmlCorridorMinPct,
      excusableReasons,
      enforcementRules: buildEnforcementRule(formData),
      evidenceMarginMinutesBefore,
      evidenceMarginMinutesAfter,
      evidenceMinCoveragePct,
      evidenceMaxGapMinutes,
      timeZone,
    },
  };

  const parsed = createContractSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return back(request, client.slug, resolved, {
      error: `Revisa los datos: ${first?.path.join(".") || ""} ${first?.message ?? ""}`.trim(),
    });
  }

  const carrier = await repos.accounts.findById(parsed.data.carrierAccountId);
  if (!carrier || carrier.type !== "carrier") {
    return back(request, client.slug, resolved, { error: "Elige un carrier válido." });
  }

  const authorized = await repos.commercial.isAuthorized(client.id, carrier.id);
  if (!authorized) {
    return back(request, client.slug, resolved, {
      error: "Ese carrier no está autorizado para este cliente. Contacta a JTEL.",
    });
  }

  const existing = await repos.contracts.findOpenForScopeAndCarrier(
    client.id,
    carrier.id,
    scopeCols,
  );
  if (existing) {
    const statusLabel =
      existing.status === "active"
        ? "activo"
        : existing.status === "draft"
          ? "borrador"
          : existing.status;
    return back(request, client.slug, resolved, {
      error: `Ya existe un contrato ${statusLabel} para ${carrier.name} en esta unidad operativa («${existing.name}»). Actívalo, elimínalo si es borrador, o suspende el anterior.`,
    });
  }

  await repos.contracts.create(parsed.data);
  return back(request, client.slug, resolved, { created: "contrato" });
}
