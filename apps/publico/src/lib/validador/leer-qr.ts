import jsQR from "jsqr";

/**
 * Leer un QR de un cuadro de la cámara — Ontoy 3.0 · PR P3.
 *
 * Una sola puerta alrededor de jsQR, y una sola razón: que el resto del lector
 * no sepa qué librería lee. `BarcodeDetector` nativo es más rápido pero no
 * existe en el Safari de un iPhone, y `zxing-wasm` lee mejor pero mete un
 * archivo wasm que el service worker tendría que guardar aparte para que el
 * lector abra sin señal. jsQR es JavaScript puro, viaja en el paquete y
 * funciona igual en cualquier teléfono. Para el laboratorio, ése es el cambio
 * correcto (ASAV, 23-sep-2026); si esto va a producción, se reconsidera.
 *
 * `inversionAttempts: "dontInvert"` porque el pase se enseña siempre oscuro
 * sobre blanco: buscar también el negativo duplicaría el trabajo por cuadro sin
 * encontrar nada. En un teléfono barato eso son cuadros perdidos.
 */
export function leerQr(datos: Uint8ClampedArray, ancho: number, alto: number): string | null {
  const hallado = jsQR(datos, ancho, alto, { inversionAttempts: "dontInvert" });
  return hallado?.data ?? null;
}
