import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Plus, Pill, CalendarDays, Beaker, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reminders")({
  head: () => ({
    meta: [
      { title: "Rappels santé — Doctor AI" },
      { name: "description", content: "Gérez vos rappels de médicaments, rendez-vous et analyses." },
    ],
  }),
  component: RemindersPage,
});

type Reminder = {
  id: string;
  type: "medicament" | "rdv" | "analyse";
  title: string;
  dose: string | null;
  time: string | null;
  date: string | null;
  notes: string | null;
};

const TYPE_META = {
  medicament: { icon: Pill, label: "Médicament", color: "text-accent bg-accent/10" },
  rdv: { icon: CalendarDays, label: "Rendez-vous", color: "text-primary bg-primary/10" },
  analyse: { icon: Beaker, label: "Analyse", color: "text-teal bg-teal/15" },
} as const;

function RemindersPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "medicament", title: "", dose: "", time: "", date: "", notes: "" });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { navigate({ to: "/auth" }); return; }
      setUser({ id: data.user.id });
    });
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("reminders").select("*").order("created_at", { ascending: false });
      if (error) toast.error("Chargement échoué");
      else setItems((data ?? []) as Reminder[]);
      setLoading(false);
    })();
  }, [user]);

  const add = async () => {
    if (!form.title.trim() || !user) return;
    const payload = {
      user_id: user.id,
      type: form.type,
      title: form.title.trim(),
      dose: form.dose || null,
      time: form.time || null,
      date: form.date || null,
      notes: form.notes || null,
    };
    const { data, error } = await supabase.from("reminders").insert(payload).select().single();
    if (error) { toast.error("Erreur d'ajout"); return; }
    setItems((p) => [data as Reminder, ...p]);
    setOpen(false);
    setForm({ type: "medicament", title: "", dose: "", time: "", date: "", notes: "" });
    toast.success("Rappel ajouté");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    if (error) { toast.error("Erreur"); return; }
    setItems((p) => p.filter((r) => r.id !== id));
    toast.success("Rappel supprimé");
  };

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-10 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl gradient-teal flex items-center justify-center shadow-soft">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold">Rappels santé</h1>
              <p className="text-sm text-muted-foreground">Médicaments, rendez-vous, analyses.</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" />Ajouter</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouveau rappel</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medicament">Médicament</SelectItem>
                      <SelectItem value="rdv">Rendez-vous</SelectItem>
                      <SelectItem value="analyse">Analyse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Titre</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex : Doliprane 500mg" />
                </div>
                {form.type === "medicament" && (
                  <div>
                    <Label className="text-xs">Dose / fréquence</Label>
                    <Input value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="1 comprimé matin et soir" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Heure</Label>
                    <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button onClick={add} className="w-full">Ajouter le rappel</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucun rappel. Ajoutez votre premier rappel santé.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((r) => {
              const meta = TYPE_META[r.type];
              const Icon = meta.icon;
              return (
                <div key={r.id} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:shadow-soft transition">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{meta.label}</span>
                    </div>
                    <div className="font-medium truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.dose && <span>{r.dose} · </span>}
                      {r.time && <span>{r.time.slice(0, 5)}</span>}
                      {r.date && <span> · {r.date}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <MedicalDisclaimer compact />
      </div>
    </AppShell>
  );
}
