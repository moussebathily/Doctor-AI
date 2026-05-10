// Overpass API helper — fetch real pharmacies near a location
export type Pharmacy = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  opening_hours?: string;
  distance_km?: number;
};

const OVERPASS = "https://overpass-api.de/api/interpreter";

export async function fetchNearbyPharmacies(lat: number, lng: number, radiusM = 3000): Promise<Pharmacy[]> {
  const query = `[out:json][timeout:25];
    (
      node["amenity"="pharmacy"](around:${radiusM},${lat},${lng});
      way["amenity"="pharmacy"](around:${radiusM},${lat},${lng});
    );
    out center tags;`;
  const r = await fetch(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  });
  if (!r.ok) throw new Error("Overpass API error");
  const j = await r.json();
  const items: Pharmacy[] = (j.elements ?? []).map((el: any) => {
    const plat = el.lat ?? el.center?.lat;
    const plng = el.lon ?? el.center?.lon;
    const tags = el.tags ?? {};
    const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:postcode"], tags["addr:city"]].filter(Boolean).join(" ");
    return {
      id: String(el.id),
      name: tags.name ?? "Pharmacie",
      lat: plat,
      lng: plng,
      address: address || undefined,
      phone: tags.phone ?? tags["contact:phone"],
      opening_hours: tags.opening_hours,
      distance_km: haversineKm(lat, lng, plat, plng),
    };
  }).filter((p: Pharmacy) => p.lat && p.lng);
  return items.sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function getUserLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Géolocalisation non disponible"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}
