import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, Loader2, Activity, Droplet, Heart, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/lab")({
  head: () => ({
    meta: [
      { title: "Virtual Lab — Simulation médicale" },
      { name: "description", content: "Simulez analyses, créez un patient virtuel et explorez des cas cliniques." },
    ],
  }),
  component: LabPage,
});

type Patient = { age: string; sex: string; symptoms: string };
type LabResult = {
  values?: Array<{ name: string; value: string; unit: string; normal: string; status: string }>;
  interpretation?: string;
  recommendations?: string[];
  severity?: string;
  raw?: string;
};
type PatientResult = {
  diagnosis_likely?: string;
  differential?: string[];
  evolution?: string;
  recommended_tests?: string[];
  treatment_options?: string[];
  raw?: string;
};

const ANALYSES = [
  { id: "sang", label: "Sang (NFS, glycémie)", icon: Droplet },
  { id: "urine", label: "Urinaire (ECBU)", icon: Droplet },
  { id: "rein", label: "Bilan rénal", icon: Activity },
  { id: "coeur", label: "Bilan cardiaque", icon: Heart },
];

async function callAI<T>(payload: object): Promise<T> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/medical-ai`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stream: false }),
  });
  if (!resp.ok) throw new Error("AI error");
  return resp.json();
}

function LabPage() {
  const [patient, setPatient] = useState<Patient>({ age: "35", sex: "femme", symptoms: "fatigue, vertiges" });
  const [analysis, setAnalysis] = useState("sang");
  const [labResult, setLabResult] = useState<LabResult | null>(null);
  const [patientResult, setPatientResult] = useState<PatientResult | null>(null);
  const [loading, setLoading] = useState<"lab" | "patient" | null>(null);

  const runAnalysis = async () => {
    setLoading("lab"); setLabResult(null);
    try {
      const prompt = `Patient virtuel : ${patient.age} ans, ${patient.sex}. Symptômes : ${patient.symptoms || "aucun"}. Génère une analyse "${ANALYSES.find(a => a.id === analysis)?.label}" cohérente avec ces symptômes (résultats partiellement anormaux si pertinent).`;
      const r = await callAI<LabResult>({ mode: "lab", prompt });
      setLabResult(r);
    } catch { toast.error("Échec de la simulation."); }
    finally { setLoading(null); }
  };

  const runPatient = async () => {
    setLoading("patient"); setPatientResult(null);
    try {
      const prompt = `Patient virtuel : ${patient.age} ans, ${patient.sex}, symptômes : ${patient.symptoms}. Donne le diagnostic le plus probable, diagnostic différentiel, évolution, examens recommandés et options de traitement.`;
      const r = await callAI<PatientResult>({ mode: "patient", prompt });
      setPatientResult(r);
    } catch { toast.error("Échec de la simulation patient."); }
    finally { setLoading(null); }
  };

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-10 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl gradient-teal flex items-center justify-center shadow-soft">
            <FlaskConical className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">Virtual Lab</h1>
            <p className="text-sm text-muted-foreground">Simulation médicale pédagogique — analyses et patient virtuel.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-6">
          {/* Patient form */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 h-fit">
            <div className="flex items-center gap-2 font-display font-semibold">
              <User className="w-4 h-4" /> Patient virtuel
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Âge</Label>
                  <Input type="number" value={patient.age} onChange={(e) => setPatient({ ...patient, age: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Sexe</Label>
                  <Select value={patient.sex} onValueChange={(v) => setPatient({ ...patient, sex: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="femme">Femme</SelectItem>
                      <SelectItem value="homme">Homme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Symptômes</Label>
                <Textarea rows={3} value={patient.symptoms} onChange={(e) => setPatient({ ...patient, symptoms: e.target.value })} placeholder="ex : fièvre, toux, fatigue" />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="analyse" className="space-y-4">
            <TabsList className="grid grid-cols-2 max-w-sm">
              <TabsTrigger value="analyse">Analyse</TabsTrigger>
              <TabsTrigger value="patient">Cas patient</TabsTrigger>
            </TabsList>

            <TabsContent value="analyse" className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ANALYSES.map((a) => (
                    <button key={a.id} onClick={() => setAnalysis(a.id)}
                      className={`p-3 rounded-xl border text-sm flex flex-col items-center gap-1.5 transition ${
                        analysis === a.id ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-accent/50"
                      }`}>
                      <a.icon className="w-4 h-4" />{a.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
                <Button onClick={runAnalysis} disabled={loading === "lab"} className="w-full">
                  {loading === "lab" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Simulation...</> : "Lancer la simulation"}
                </Button>
              </div>

              {labResult && (
                <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                  {labResult.severity && (
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                      labResult.severity === "critique" ? "bg-destructive/15 text-destructive" :
                      labResult.severity === "attention" ? "bg-warning/20 text-warning-foreground" :
                      "bg-success/15 text-success"
                    }`}>{labResult.severity}</span>
                  )}
                  {labResult.values && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground">
                          <tr><th className="text-left py-2">Marqueur</th><th className="text-left">Valeur</th><th className="text-left">Norme</th><th className="text-left">Statut</th></tr>
                        </thead>
                        <tbody>
                          {labResult.values.map((v, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="py-2 font-medium">{v.name}</td>
                              <td>{v.value} <span className="text-muted-foreground text-xs">{v.unit}</span></td>
                              <td className="text-muted-foreground text-xs">{v.normal}</td>
                              <td>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  v.status === "normal" ? "bg-success/15 text-success" :
                                  v.status === "critique" ? "bg-destructive/15 text-destructive" :
                                  "bg-warning/20 text-foreground"
                                }`}>{v.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {labResult.interpretation && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Interprétation</div>
                      <p className="text-sm">{labResult.interpretation}</p>
                    </div>
                  )}
                  {labResult.recommendations && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Recommandations</div>
                      <ul className="text-sm list-disc list-inside space-y-1">
                        {labResult.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                  {labResult.raw && <pre className="text-xs bg-muted p-3 rounded overflow-auto">{labResult.raw}</pre>}
                </div>
              )}
            </TabsContent>

            <TabsContent value="patient" className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground mb-3">Génère un cas clinique pédagogique à partir du patient virtuel.</p>
                <Button onClick={runPatient} disabled={loading === "patient"} className="w-full">
                  {loading === "patient" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Génération...</> : "Générer le cas clinique"}
                </Button>
              </div>

              {patientResult && (
                <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  {patientResult.diagnosis_likely && (
                    <div>
                      <div className="text-xs uppercase text-muted-foreground font-semibold">Diagnostic probable</div>
                      <p className="font-display font-semibold text-lg">{patientResult.diagnosis_likely}</p>
                    </div>
                  )}
                  {patientResult.differential && (
                    <div>
                      <div className="text-xs uppercase text-muted-foreground font-semibold">Différentiel</div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {patientResult.differential.map((d, i) => (
                          <span key={i} className="px-2 py-1 rounded-full bg-muted text-xs">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {patientResult.evolution && (
                    <div>
                      <div className="text-xs uppercase text-muted-foreground font-semibold">Évolution</div>
                      <p className="text-sm">{patientResult.evolution}</p>
                    </div>
                  )}
                  {patientResult.recommended_tests && (
                    <div>
                      <div className="text-xs uppercase text-muted-foreground font-semibold">Examens recommandés</div>
                      <ul className="text-sm list-disc list-inside">{patientResult.recommended_tests.map((t, i) => <li key={i}>{t}</li>)}</ul>
                    </div>
                  )}
                  {patientResult.treatment_options && (
                    <div>
                      <div className="text-xs uppercase text-muted-foreground font-semibold">Options de traitement</div>
                      <ul className="text-sm list-disc list-inside">{patientResult.treatment_options.map((t, i) => <li key={i}>{t}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <MedicalDisclaimer />
      </div>
    </AppShell>
  );
}
