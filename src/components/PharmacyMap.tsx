import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Pharmacy } from "@/lib/pharmacy";

// Fix default icon paths (Leaflet + bundlers)
const ICON = L.divIcon({
  className: "",
  html: `<div style="background:#2d8a9e;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <span style="transform:rotate(45deg);color:white;font-weight:bold;font-size:14px;">+</span>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const USER_ICON = L.divIcon({
  className: "",
  html: `<div style="background:#1a4a6e;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(26,74,110,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export function PharmacyMap({
  user,
  pharmacies,
  selectedId,
  onSelect,
}: {
  user: { lat: number; lng: number } | null;
  pharmacies: Pharmacy[];
  selectedId?: string | null;
  onSelect?: (p: Pharmacy) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;
    const center: L.LatLngExpression = user ? [user.lat, user.lng] : [48.8566, 2.3522];
    const map = L.map(mapRef.current).setView(center, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    leafletRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = leafletRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (user) {
      L.marker([user.lat, user.lng], { icon: USER_ICON }).bindPopup("Vous êtes ici").addTo(layer);
      map.setView([user.lat, user.lng], 13);
    }
    pharmacies.forEach((p) => {
      const m = L.marker([p.lat, p.lng], { icon: ICON })
        .bindPopup(`<strong>${p.name}</strong><br/>${p.address ?? ""}<br/>${p.distance_km?.toFixed(2) ?? "?"} km`)
        .addTo(layer);
      m.on("click", () => onSelect?.(p));
      if (selectedId === p.id) m.openPopup();
    });
  }, [user, pharmacies, selectedId, onSelect]);

  return <div ref={mapRef} className="w-full h-[360px] md:h-[480px] rounded-2xl overflow-hidden border border-border z-0" />;
}
