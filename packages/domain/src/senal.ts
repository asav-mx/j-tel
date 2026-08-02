/**
 * Cuándo se considera que una señal GPS está vieja.
 *
 * Vive en el dominio, y no en la torre ni en el servicio de ingesta, porque más
 * de una cara del producto tiene que afirmar lo mismo sobre el mismo silencio:
 * la banda de Monitoreo que marca la unidad en ámbar, el marcador del mapa, la
 * llegada estimada que se niega a calcularse, y el dead-man switch de ingesta.
 * Que una unidad se vea "sin señal" y a la vez tenga una hora estimada sería la
 * pantalla contradiciéndose sola.
 */

/**
 * Minutos sin punto GPS que vuelven vieja una señal.
 *
 * **Un solo número, un solo lugar.** Antes vivía dos veces —`SIN_SENAL_MINUTOS`
 * en la torre y `DEFAULT_STALE_MINUTES` en `IngestHealthService`— y lo único que
 * los mantenía iguales era un comentario en prosa pidiéndolo. Eso no es una
 * garantía: es una nota que alguien puede no leer al mover uno de los dos.
 *
 * El razonamiento que los iguala sigue siendo el de entonces: si el sistema da
 * por caída la ingesta a los 15 minutos, una unidad callada 15 minutos está
 * igual de callada.
 *
 * **NO confundir con `verificationGraceMinutes` de la política del contrato**,
 * que hoy también vale 15. Esa es la holgura comercial que se concede DESPUÉS
 * del deadline —cuánto se tolera llegar tarde— y no dice nada sobre el silencio
 * de un GPS. Valen lo mismo por casualidad. Meterlas en la misma constante haría
 * que renegociar la tolerancia de un contrato moviera el corte de la estimación
 * de llegada, que es una consecuencia que nadie pidió.
 *
 * El día que esto se vuelva perilla de contrato, este es el único sitio que
 * cambia.
 */
export const SIN_SENAL_MINUTOS = 15;
