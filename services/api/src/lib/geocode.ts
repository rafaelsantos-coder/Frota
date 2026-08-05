const cache = new Map<string, { address: string; expires: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.address;

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": "SulnetGestaoFrota/1.0" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { display_name?: string };
    const address = data.display_name ?? null;
    if (address) {
      cache.set(key, { address, expires: Date.now() + CACHE_TTL_MS });
    }
    return address;
  } catch {
    return null;
  }
}
