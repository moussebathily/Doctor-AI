import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { ClientOnly } from "@/components/ClientOnly";
import { lazy } from "react";
const PharmacyMap = lazy(() => import("@/components/PharmacyMap").then((m) => ({ default: m.PharmacyMap })));
import { fetchNearbyPharmacies, getUserLocation, type Pharmacy } from "@/lib/pharmacy";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, ShoppingCart, Plus, Minus, Trash2, Pill, AlertTriangle, Truck, Store, Loader2, PackageCheck } from "lucide-react";
import { CheckoutDialog, OrderStatusTimeline } from "@/components/PharmacyCheckout";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pharmacy")({
  head: () => ({
    meta: [
      { title: "Pharmacies — Doctor AI" },
      { name: "description", content: "Trouvez une pharmacie, commandez vos médicaments et vérifiez les interactions." },
    ],
  }),
  component: PharmacyPage,
});

type Med = {
  id: string;
  name: string;
  generic_name: string | null;
  category: string | null;
  requires_prescription: boolean;
  common_doses: string[] | null;
  interactions: string[] | null;
  description: string | null;
};

type CartItem = { med: Med; qty: number };

type Order = {
  id: string;
  pharmacy_name: string;
  status: string;
  total_items: number;
  delivery_method: string;
  created_at: string;
  estimated_ready_at?: string | null;
};

function PharmacyPage() {
  const [user, setUser] = useState<{ lat: number; lng: number } | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selected, setSelected] = useState<Pharmacy | null>(null);
  const [loadingMap, setLoadingMap] = useState(false);

  const [meds, setMeds] = useState<Med[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [delivery, setDelivery] = useState<"pickup" | "delivery">("pickup");
  const [submitting, setSubmitting] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    supabase.from("medications").select("*").order("name").then(({ data }) => setMeds((data as Med[]) ?? []));
    loadOrders();
  }, []);

  const loadOrders = async () => {
    const { data } = await supabase.from("pharmacy_orders").select("id,pharmacy_name,status,total_items,delivery_method,created_at,estimated_ready_at").order("created_at", { ascending: false }).limit(10);
    setOrders((data as Order[]) ?? []);
  };

  const locate = async () => {
    setLoadingMap(true);
    try {
      const loc = await getUserLocation();
      setUser(loc);
      const ph = await fetchNearbyPharmacies(loc.lat, loc.lng, 3000);
      setPharmacies(ph.slice(0, 30));
      if (ph.length === 0) toast.warning("Aucune pharmacie trouvée à proximité");
      else toast.success(`${ph.length} pharmacies trouvées`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur géolocalisation");
    } finally {
      setLoadingMap(false);
    }
  };

  const filteredMeds = useMemo(() => {
    if (!search.trim()) return meds.slice(0, 12);
    const s = search.toLowerCase();
    return meds.filter((m) => m.name.toLowerCase().includes(s) || (m.generic_name ?? "").toLowerCase().includes(s) || (m.category ?? "").toLowerCase().includes(s)).slice(0, 20);
  }, [meds, search]);

  const addToCart = (med: Med) => {
    setCart((c) => {
      const existing = c.find((i) => i.med.id === med.id);
      if (existing) return c.map((i) => (i.med.id === med.id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { med, qty: 1 }];
    });
    toast.success(`${med.name} ajouté`);
  };

  const updateQty = (id: string, delta: number) =>
    setCart((c) => c.map((i) => (i.med.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)).filter((i) => i.qty > 0));

  const removeFromCart = (id: string) => setCart((c) => c.filter((i) => i.med.id !== id));

  // Detect interactions in cart
  const interactionWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (let i = 0; i < cart.length; i++) {
      for (let j = i + 1; j < cart.length; j++) {
        const a = cart[i].med;
        const b = cart[j].med;
        const aInt = (a.interactions ?? []).map((x) => x.toLowerCase());
        const bInt = (b.interactions ?? []).map((x) => x.toLowerCase());
        const aTokens = [a.name, a.generic_name ?? "", a.category ?? ""].join(" ").toLowerCase();
        const bTokens = [b.name, b.generic_name ?? "", b.category ?? ""].join(" ").toLowerCase();
        if (aInt.some((x) => bTokens.includes(x))) warnings.push(`⚠️ ${a.name} interagit avec ${b.name}`);
        else if (bInt.some((x) => aTokens.includes(x))) warnings.push(`⚠️ ${b.name} interagit avec ${a.name}`);
      }
    }
    return [...new Set(warnings)];
  }, [cart]);

  const requiresPrescription = cart.some((i) => i.med.requires_prescription);
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  const submitOrder = async () => {
    if (!authed) {
      toast.error("Connectez-vous pour commander");
      return;
    }
    if (!selected) {
      toast.error("Sélectionnez une pharmacie sur la carte");
      return;
    }
    if (cart.length === 0) {
      toast.error("Panier vide");
      return;
    }
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("pharmacy_orders").insert({
      user_id: u.user!.id,
      pharmacy_name: selected.name,
      pharmacy_address: selected.address,
      pharmacy_lat: selected.lat,
      pharmacy_lng: selected.lng,
      items: cart.map((i) => ({ med_id: i.med.id, name: i.med.name, qty: i.qty, requires_prescription: i.med.requires_prescription })),
      total_items: totalItems,
      delivery_method: delivery,
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Commande envoyée à la pharmacie !");
    setCart([]);
    loadOrders();
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl">Pharmacies & médicaments</h1>
          <p className="text-muted-foreground text-sm mt-1">Trouvez une pharmacie proche, commandez en ligne, vérifiez les interactions.</p>
        </div>

        {/* Map + actions */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={locate} disabled={loadingMap}>
                {loadingMap ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <MapPin className="w-4 h-4 mr-1" />}
                Localiser les pharmacies proches
              </Button>
              {selected && <Badge variant="outline" className="px-3 py-1.5">📍 {selected.name}</Badge>}
            </div>
            <ClientOnly fallback={<div className="w-full h-[360px] md:h-[480px] rounded-2xl bg-muted animate-pulse" />}><PharmacyMap user={user} pharmacies={pharmacies} selectedId={selected?.id} onSelect={setSelected} /></ClientOnly>
          </div>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">{pharmacies.length || "—"} pharmacies</h2>
            {pharmacies.length === 0 && <p className="text-sm text-muted-foreground">Cliquez sur "Localiser" pour afficher les pharmacies de votre quartier.</p>}
            {pharmacies.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  selected?.id === p.id ? "border-teal bg-teal/5" : "border-border bg-card hover:border-accent",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                    {p.address && <p className="text-xs text-muted-foreground truncate">{p.address}</p>}
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{p.distance_km?.toFixed(1)} km</Badge>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Search meds + Cart */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un médicament (Doliprane, ibuprofène...)" className="pl-9" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {filteredMeds.map((m) => (
                <div key={m.id} className="p-3 rounded-xl border border-border bg-card flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-teal/10 text-teal flex items-center justify-center shrink-0"><Pill className="w-4 h-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-sm">{m.name}</h3>
                      {m.requires_prescription && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Ordonnance</Badge>}
                    </div>
                    {m.generic_name && <p className="text-[11px] text-muted-foreground">{m.generic_name} • {m.category}</p>}
                    {m.description && <p className="text-xs mt-1 text-foreground/80 line-clamp-2">{m.description}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => addToCart(m)}><Plus className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
              {filteredMeds.length === 0 && <p className="text-sm text-muted-foreground col-span-2">Aucun résultat.</p>}
            </div>
          </div>

          {/* Cart */}
          <div className="space-y-3">
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Panier</h2>
                <Badge variant="secondary">{totalItems}</Badge>
              </div>

              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Panier vide</p>
              ) : (
                <div className="space-y-2 mb-3">
                  {cart.map((i) => (
                    <div key={i.med.id} className="flex items-center gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{i.med.name}</p>
                        {i.med.requires_prescription && <span className="text-[9px] text-destructive">Ordonnance requise</span>}
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(i.med.id, -1)}><Minus className="w-3 h-3" /></Button>
                      <span className="w-5 text-center text-sm font-medium">{i.qty}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(i.med.id, 1)}><Plus className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(i.med.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              )}

              {interactionWarnings.length > 0 && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs space-y-1 mb-3">
                  <div className="flex items-center gap-1 font-semibold text-destructive"><AlertTriangle className="w-3.5 h-3.5" />Interactions détectées</div>
                  {interactionWarnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}

              {requiresPrescription && cart.length > 0 && (
                <p className="text-[11px] text-warning bg-warning/10 p-2 rounded mb-3">⚠️ Ordonnance requise pour certains médicaments — présentez-la à la pharmacie.</p>
              )}

              {cart.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button onClick={() => setDelivery("pickup")} className={cn("p-2 rounded-lg border text-xs flex flex-col items-center gap-1", delivery === "pickup" ? "border-teal bg-teal/10" : "border-border")}>
                      <Store className="w-4 h-4" />Retrait
                    </button>
                    <button onClick={() => setDelivery("delivery")} className={cn("p-2 rounded-lg border text-xs flex flex-col items-center gap-1", delivery === "delivery" ? "border-teal bg-teal/10" : "border-border")}>
                      <Truck className="w-4 h-4" />Livraison
                    </button>
                  </div>
                  <Button onClick={submitOrder} disabled={submitting || !selected} className="w-full">
                    {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PackageCheck className="w-4 h-4 mr-1" />}
                    Commander
                  </Button>
                  {!selected && <p className="text-[11px] text-muted-foreground text-center mt-2">Sélectionnez une pharmacie d'abord</p>}
                </>
              )}
            </div>

            {orders.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="font-display font-bold text-sm mb-2">Mes commandes</h3>
                <div className="space-y-2">
                  {orders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{o.pharmacy_name}</p>
                        <p className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString("fr-FR")} • {o.total_items} items • {o.delivery_method === "delivery" ? "livraison" : "retrait"}</p>
                      </div>
                      <Badge variant={o.status === "pending" ? "secondary" : "default"} className="text-[9px]">{o.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <MedicalDisclaimer />
      </div>
    </AppShell>
  );
}
