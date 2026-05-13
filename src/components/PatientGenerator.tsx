import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCog, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Vitals } from "./PatientMonitor";
import { DEFAULT_VITALS } from "./PatientMonitor";

export type PatientProfile = {
  age: number;
  sex: "M" | "F";
  condition: string;
  weightKg?: number;
  scenario?: string; // AI-generated narrative
  vitals: Vitals;
  riskLevel: "low" | "medium" | "high";
};

export const DEFAULT_PATIENT: PatientProfile = {
  age: 35,
  sex: "M",
  condition: "État stable",
  vitals: DEFAULT_VITALS,
  riskLevel: "low",
};

async function callAI(prompt: string): Promise<string> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/medical-ai`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "research", stream: false, prompt }),
  });
  const j = await r.json();
  return j.content ?? j.raw ?? "";
}

export type PatientSeed = { age: number; sex: "M" | "F"; condition: string; weightKg?: number };

export async function generatePatientScenario(seed: PatientSeed): Promise<PatientProfile> {
  const { age, sex, condition, weightKg = 70 } = seed;
  const txt = await callAI(
    `Génère un scénario clinique court (4-6 lignes max, markdown) pour un patient ${sex === "M" ? "homme" : "femme"} de ${age} ans, ${weightKg} kg, présentant : "${condition}". Inclure : antécédents, signes vitaux attendus, niveau de risque (faible/moyen/élevé), précautions chirurgicales spécifiques. Varie les détails par rapport à un précédent scénario. Termine par une ligne JSON sur sa propre ligne, exactement: {"bpm": <int>, "spo2": <int>, "temp": <float>, "bp": "<systo/diasto>", "risk": "low|medium|high"}`,
  );
  const match = txt.match(/\{[^}]*"bpm"[\s\S]*?\}/);
  let vitals = { ...DEFAULT_VITALS };
  let risk: PatientProfile["riskLevel"] = "low";
  if (match) {
    try {
      const o = JSON.parse(match[0]);
      vitals = {
        bpm: Math.round(o.bpm ?? 72),
        spo2: Math.round(o.spo2 ?? 98),
        tempC: +Number(o.temp ?? 36.6).toFixed(1),
        bp: String(o.bp ?? "120/80"),
      };
      if (o.risk === "medium" || o.risk === "high") risk = o.risk;
    } catch { /* ignore */ }
  }
  const scenario = match ? txt.replace(match[0], "").trim() : txt;
  return { age, sex, condition, weightKg, scenario, vitals, riskLevel: risk };
}

export function PatientGenerator({
  current,
  onGenerated,
}: {
  current: PatientProfile;
  onGenerated: (p: PatientProfile) => void;
}) {
  const [open, setOpen] = useState(false);
  const [age, setAge] = useState(current.age);
  const [sex, setSex] = useState<"M" | "F">(current.sex);
  const [condition, setCondition] = useState(current.condition);
  const [weight, setWeight] = useState<number>(current.weightKg ?? 70);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const profile = await generatePatientScenario({ age, sex, condition, weightKg: weight });
      onGenerated(profile);
      toast.success("Patient personnalisé généré");
      setOpen(false);
    } catch {
      toast.error("Échec génération scénario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserCog className="w-4 h-4 mr-1.5" /> Patient
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="w-4 h-4 text-teal" /> Personnaliser le patient
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Âge</Label>
            <Input type="number" value={age} onChange={(e) => setAge(parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs">Sexe</Label>
            <div className="flex gap-2 mt-1">
              {(["M", "F"] as const).map((s) => (
                <Button key={s} type="button" size="sm" variant={sex === s ? "default" : "outline"} onClick={() => setSex(s)} className="flex-1">
                  {s === "M" ? "Homme" : "Femme"}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Poids (kg)</Label>
            <Input type="number" value={weight} onChange={(e) => setWeight(parseInt(e.target.value) || 0)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Pathologie / contexte</Label>
            <Input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="ex: diabétique, HTA non contrôlée" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            Générer scénario IA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
