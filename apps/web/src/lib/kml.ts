/** Extrae coordenadas de KML/KMZ (texto) — soporta <coordinates>lng,lat,... */
export function parseKmlWaypoints(kmlText: string): Array<{ lat: number; lng: number }> {
  const out: Array<{ lat: number; lng: number }> = [];
  const coordBlocks = kmlText.match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi);
  if (!coordBlocks) return out;

  for (const block of coordBlocks) {
    const inner = block.replace(/<\/?coordinates[^>]*>/gi, "").trim();
    for (const token of inner.split(/\s+/)) {
      const parts = token.split(",").map(Number);
      if (parts.length < 2) continue;
      const lng = parts[0];
      const lat = parts[1];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      out.push({ lat, lng });
    }
  }
  return out;
}
