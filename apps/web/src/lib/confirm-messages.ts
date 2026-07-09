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
  generateOccurrences: (name: string, from: string, to: string) =>
    `¿Generar ocurrencias para «${name}» del ${from} al ${to}? Se crearán servicios a verificar.`,
  authorizeCarrier: (carrier: string, client: string) =>
    `¿Autorizar a ${carrier} para trabajar con ${client}? El cliente podrá crear contratos con este carrier.`,
  suspendCarrier: (carrier: string, client: string) =>
    `¿Suspender a ${carrier} para ${client}? No podrá usarse en contratos nuevos hasta reautorizar.`,
  verifyOccurrence: (date: string, contract: string) =>
    `¿Re-sincronizar y verificar el servicio del ${date} (${contract})?`,
  savePlant: (name: string) =>
    `¿Guardar cambios en ${name}? Si cambias de grupo, puede afectar la unidad operativa.`,
} as const;
