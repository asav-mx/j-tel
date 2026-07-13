export const confirmMessages = {
  activateContract: (name: string) =>
    `¿Activar el contrato «${name}»? Pasará a vigente y aplicará su política de cumplimiento.`,
  deleteContractDraft: (name: string) =>
    `¿Eliminar el borrador «${name}»? Esta acción no se puede deshacer.`,
  createContract: (unitLabel: string) =>
    `¿Crear contrato para ${unitLabel}? Revisa carrier y política antes de continuar.`,
  createProfile: (unitLabel: string) =>
    `¿Crear perfil de servicio para ${unitLabel}? Verifica contrato, ruta y geocerca.`,
  deleteProfile: (name: string) =>
    `¿Eliminar el perfil «${name}»? Solo es posible si no tiene ocurrencias generadas.`,
  generateOccurrencesTemplate: (name: string) =>
    `¿Generar ocurrencias para «${name}» del {fromDate} al {toDate}? Solo se materializan hasta 30 días adelante. Puede tardar; no pulses otra vez hasta ver el resultado.`,
  authorizeCarrierTemplate: (client: string) =>
    `¿Autorizar a {__selectLabel:carrierAccountId} para trabajar con ${client}? El cliente podrá crear contratos con este carrier.`,
  suspendCarrier: (carrier: string, client: string) =>
    `¿Suspender a ${carrier} para ${client}? No podrá usarse en contratos nuevos hasta reautorizar.`,
  updatePolicy: (name: string) =>
    `¿Guardar la política de «${name}»? Aplica solo hacia adelante: no recalcula hechos ya cerrados (cumplido / no cumplido).`,
  verifyOccurrence: (date: string, contract: string) =>
    `¿Re-sincronizar y verificar el servicio del ${date} (${contract})?`,
  savePlantTemplate:
    "¿Guardar cambios en {name}? Si cambias de grupo, puede afectar la unidad operativa.",
  deleteShift: (name: string, time: string) =>
    `¿Eliminar el turno «${name}» (inicio ${time})? Solo es posible si no está programado en un perfil de servicio.`,
  updateShift: (name: string) =>
    `¿Guardar cambios en el turno «${name}»? Los servicios ya generados conservan su hora; aplica a nuevos.`,
  deleteRoute: (name: string, shiftLabel: string) =>
    `¿Eliminar la ruta «${name}» (${shiftLabel})? Solo es posible si no está en un perfil de servicio.`,
} as const;
