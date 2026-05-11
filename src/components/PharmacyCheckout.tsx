import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Store, PackageCheck, Loader2, CheckCircle2, Clock, MapPin, Phone, Pill } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CartItem = { med: { id: string; name: string; requires_prescription: boolean }; qty: number };
type Pharmacy = { id: string; name: string; address?: string | null; lat: number; lng: number };

export function CheckoutDialog({
  cart,
  pharmacy,
  delivery,
  onSuccess,
  trigger,
}: {
  cart: CartItem[];
  pharmacy: Pharmacy | null;
  delivery: "pickup" | "delivery";
  onSuccess: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"info" | "review" | "done">("info");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ id: string; eta: Date } | null>(null);

  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  const requiresPrescription = cart.some((i) => i.med.requires_prescription);

  const reset = () => {
    setStep("info");
    setPhone("");
    setAddress("");
    setNotes("");
    setConfirmation(null);
  };

  const submit = async () => {
    if (!pharmacy) return;
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.error("Connectez-vous");
      setSubmitting(false);
      return;
    }
    const eta = new Date(Date.now() + (delivery === "delivery" ? 60 : 25) * 60_000);
    const noteParts = [
      phone && `Tél : ${phone}`,
      delivery === "delivery" && address && `Adresse : ${address}`,
      notes,
    ].filter(Boolean);

    const { data, error } = await supabase
      .from("pharmacy_orders")
      .insert({
        user_id: u.user.id,
        pharmacy_name: pharmacy.name,
        pharmacy_address: pharmacy.address ?? null,
        pharmacy_lat: pharmacy.lat,
        pharmacy_lng: pharmacy.lng,
        items: cart.map((i) => ({ med_id: i.med.id, name: i.med.name, qty: i.qty, requires_prescription: i.med.requires_prescription })),
        total_items: totalItems,
        delivery_method: delivery,
        status: "pending",
        notes: noteParts.join(" • ") || null,
        estimated_ready_at: eta.toISOString(),
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message ?? "Erreur");
      return;
    }
    setConfirmation({ id: data.id, eta });
    setStep("done");
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTimeout(reset, 300); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            {delivery === "delivery" ? <Truck className="w-5 h-5 text-teal" /> : <Store className="w-5 h-5 text-teal" />}
            {step === "done" ? "Commande confirmée" : "Finaliser la commande"}
          </DialogTitle>
        </DialogHeader>

        {step === "info" && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs space-y-1">
              <p className="font-semibold flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{pharmacy?.name}</p>
              {pharmacy?.address && <p className="text-muted-foreground">{pharmacy.address}</p>}
              <p className="text-muted-foreground">{totalItems} article(s) • {delivery === "delivery" ? "Livraison" : "Retrait en pharmacie"}</p>
            </div>

            <div>
              <Label htmlFor="phone" className="text-xs">Téléphone *</Label>
              <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" />
            </div>

            {delivery === "delivery" && (
              <div>
                <Label htmlFor="addr" className="text-xs">Adresse de livraison *</Label>
                <Textarea id="addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="N°, rue, code postal, ville" rows={2} />
              </div>
            )}

            <div>
              <Label htmlFor="notes" className="text-xs">Notes (optionnel)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Étage, code, allergie connue…" rows={2} />
            </div>

            {requiresPrescription && (
              <div className="text-[11px] text-warning bg-warning/10 p-2 rounded border border-warning/30">
                ⚠️ Pensez à présenter votre ordonnance lors du retrait/livraison.
              </div>
            )}

            <Button className="w-full" onClick={() => setStep("review")} disabled={!phone || (delivery === "delivery" && !address)}>
              Continuer
            </Button>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Articles</h4>
              {cart.map((i) => (
                <div key={i.med.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Pill className="w-3.5 h-3.5 text-teal shrink-0" />
                    <span className="truncate">{i.med.name}</span>
                  </div>
                  <Badge variant="secondary">×{i.qty}</Badge>
                </div>
              ))}
            </div>

            <div className="text-xs space-y-1 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2"><Phone className="w-3 h-3 text-muted-foreground" />{phone}</div>
              {delivery === "delivery" && <div className="flex items-start gap-2"><MapPin className="w-3 h-3 text-muted-foreground mt-0.5" />{address}</div>}
              <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-muted-foreground" />Prêt en ~{delivery === "delivery" ? 60 : 25} min</div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("info")}>Retour</Button>
              <Button className="flex-1" onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PackageCheck className="w-4 h-4 mr-1" />}
                Confirmer
              </Button>
            </div>
          </div>
        )}

        {step === "done" && confirmation && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-success/10 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <div>
              <p className="font-display font-bold text-lg">Merci, votre commande est enregistrée !</p>
              <p className="text-xs text-muted-foreground mt-1">N° : <code className="bg-muted px-1.5 py-0.5 rounded">{confirmation.id.slice(0, 8)}</code></p>
            </div>
            <div className="text-sm bg-teal/10 border border-teal/30 rounded-lg p-3">
              <Clock className="w-4 h-4 inline mr-1 text-teal" />
              {delivery === "delivery" ? "Livraison estimée à " : "Prêt pour retrait à "}
              <strong>{confirmation.eta.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</strong>
            </div>
            <Button className="w-full" onClick={() => setOpen(false)}>Fermer</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// === Order Status Timeline ===

const STATUS_FLOW = ["pending", "preparing", "ready", "delivered"] as const;
type Status = typeof STATUS_FLOW[number];

const STATUS_META: Record<Status, { label: string; description: string }> = {
  pending: { label: "Reçue", description: "La pharmacie a reçu votre commande" },
  preparing: { label: "En préparation", description: "Vos médicaments sont en cours de préparation" },
  ready: { label: "Prête", description: "Disponible — venez la chercher" },
  delivered: { label: "Livrée", description: "Commande livrée / remise" },
};

export function OrderStatusTimeline({
  order,
  onAdvance,
}: {
  order: { id: string; status: string; delivery_method: string; estimated_ready_at?: string | null; pharmacy_name: string };
  onAdvance: () => void;
}) {
  const [advancing, setAdvancing] = useState(false);
  const currentIdx = Math.max(0, STATUS_FLOW.indexOf(order.status as Status));
  const finalLabel = order.delivery_method === "delivery" ? "Livrée" : "Récupérée";

  const advance = async (target: Status) => {
    setAdvancing(true);
    const { error } = await supabase.from("pharmacy_orders").update({ status: target }).eq("id", order.id);
    setAdvancing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(target === "delivered" ? "Commande clôturée 🎉" : `Statut mis à jour : ${STATUS_META[target].label}`);
    onAdvance();
  };

  const nextStatus = STATUS_FLOW[currentIdx + 1];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-start gap-1.5">
          {STATUS_FLOW.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all", i <= currentIdx ? "bg-teal text-teal-foreground" : "bg-muted text-muted-foreground border border-border")}>
                {i < currentIdx ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < STATUS_FLOW.length - 1 && <div className={cn("w-6 h-0.5", i < currentIdx ? "bg-teal" : "bg-border")} />}
            </div>
          ))}
        </div>
        <Badge variant={currentIdx >= STATUS_FLOW.length - 1 ? "default" : "secondary"} className="text-[10px]">
          {currentIdx >= 3 ? finalLabel : STATUS_META[STATUS_FLOW[currentIdx]].label}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">{STATUS_META[STATUS_FLOW[currentIdx]].description}</p>

      {order.estimated_ready_at && currentIdx < 2 && (
        <p className="text-xs flex items-center gap-1 text-teal"><Clock className="w-3 h-3" /> Prêt vers {new Date(order.estimated_ready_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
      )}

      {nextStatus && (
        <Button size="sm" variant="outline" className="w-full text-xs" disabled={advancing} onClick={() => advance(nextStatus)}>
          {advancing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
          Marquer comme « {STATUS_META[nextStatus].label} »
        </Button>
      )}

      {currentIdx >= STATUS_FLOW.length - 1 && (
        <p className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Commande finalisée</p>
      )}
    </div>
  );
}

// === Polling helper hook for live order updates ===
export function useOrderPolling(intervalMs = 15000, callback: () => void) {
  useEffect(() => {
    const t = setInterval(callback, intervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);
}
