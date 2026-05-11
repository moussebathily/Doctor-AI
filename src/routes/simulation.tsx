import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { ClientOnly } from "@/components/ClientOnly";
import { lazy, Suspense } from "react";
const HumanBody3D = lazy(() => import("@/components/HumanBody3D").then((m) => ({ default: m.HumanBody3D })));
import { OPERATIONS, type Operation } from "@/lib/operations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, ChevronRight, RotateCcw, Sparkles, Trophy, ArrowLeft } from "lucide-react";
import { AnatomyAtlas } from "@/components/AnatomyAtlas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/simulation")({
  head: () => ({
    meta: [
      { title: "Simulation 3D — Doctor AI" },
      { name: "description", content: "Entraînement immersif aux opérations médicales en 3D, guidé par IA." },
    ],
  }),
  component: SimulationPage,
});

function SimulationPage() {
  const [selected, setSelected] = useState<Operation | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [errors, setErrors] = useState(0);
  const [aiTip, setAiTip] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const score = useMemo(() => {
    if (!selected) return 0;
    return Math.max(0, 100 - errors * 12);
  }, [errors, selected]);

  const launch = (op: Operation) => {
    setSelected(op);
    setStepIdx(0);
    setErrors(0);
    setAiTip("");
    setCompleted(false);
  };

  const next = () => {
    if (!selected) return;
    if (stepIdx + 1 >= selected.steps.length) {
      setCompleted(true);
      saveSimulation();
      return;
    }
    setStepIdx((i) => i + 1);
    setAiTip("");
  };

  const skip = () => {
    setErrors((e) => e + 1);
    toast.error("Étape sautée — pénalité appliquée");
    next();
  };

  const askAI = async () => {
    if (!selected) return;
    setAiLoading(true);
    try {
      const step = selected.steps[stepIdx];
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/medical-ai`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "research",
          stream: false,
          prompt: `En tant que chirurgien instructeur, donne en 4 phrases maximum un conseil pratique pour réussir l'étape "${step.title}" de l'opération "${selected.name}". Étape : ${step.description}. Risque : ${step.risks ?? "—"}.`,
        }),
      });
      const j = await r.json();
      setAiTip(j.content ?? j.raw ?? "Pas de conseil disponible.");
    } catch {
      setAiTip("Erreur IA — réessayez.");
    } finally {
      setAiLoading(false);
    }
  };

  const saveSimulation = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !selected) return;
    await supabase.from("lab_simulations").insert({
      user_id: u.user.id,
      kind: `surgery_${selected.id}`,
      patient: { operation: selected.name },
      result: { score, errors, steps: selected.steps.length },
    });
    toast.success(`Simulation terminée ! Score : ${score}/100`);
  };

  if (selected) {
    const step = selected.steps[stepIdx];
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Quitter
            </Button>
            <div className="flex-1">
              <h1 className="font-display font-bold text-xl md:text-2xl">{selected.name}</h1>
              <p className="text-xs text-muted-foreground">{selected.organLabel}</p>
            </div>
            <Badge variant="outline" className="text-sm">Score : <span className="font-bold ml-1">{score}</span></Badge>
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <ClientOnly fallback={<div className="w-full h-[420px] md:h-[520px] rounded-2xl bg-muted animate-pulse" />}><Suspense fallback={null}><HumanBody3D highlightOrgan={selected.organ} /></Suspense></ClientOnly>
              <p className="text-[11px] text-muted-foreground mt-2 text-center">Glissez pour pivoter • Molette pour zoomer</p>
            </div>

            <div className="lg:col-span-2 space-y-4">
              {/* Progress */}
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                  <span>Étape {stepIdx + 1} / {selected.steps.length}</span>
                  {errors > 0 && <span className="text-destructive">{errors} erreur(s)</span>}
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-teal transition-all" style={{ width: `${((stepIdx + (completed ? 1 : 0)) / selected.steps.length) * 100}%` }} />
                </div>
              </div>

              {!completed ? (
                <div className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-teal text-teal-foreground flex items-center justify-center font-bold text-sm shrink-0">{stepIdx + 1}</div>
                    <div>
                      <h3 className="font-display font-bold text-lg leading-tight">{step.title}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed mb-3">{step.description}</p>
                  {step.risks && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs">
                      <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                      <span><strong>Risque :</strong> {step.risks}</span>
                    </div>
                  )}

                  {aiTip && (
                    <div className="mt-3 p-3 rounded-lg bg-accent/10 border border-accent/30 text-xs leading-relaxed">
                      <div className="flex items-center gap-1.5 font-semibold text-accent mb-1"><Sparkles className="w-3.5 h-3.5" /> Conseil IA</div>
                      {aiTip}
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Button onClick={next} className="flex-1">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Valider
                    </Button>
                    <Button variant="outline" onClick={askAI} disabled={aiLoading}>
                      <Sparkles className="w-4 h-4 mr-1" />{aiLoading ? "..." : "IA"}
                    </Button>
                    <Button variant="ghost" onClick={skip} className="text-muted-foreground">Sauter</Button>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-teal/20 to-accent/10 rounded-xl border border-teal/40 p-6 text-center">
                  <Trophy className="w-12 h-12 text-teal mx-auto mb-3" />
                  <h3 className="font-display font-bold text-2xl mb-1">Opération terminée !</h3>
                  <p className="text-sm text-muted-foreground mb-3">Score final : <strong className="text-foreground">{score}/100</strong> • {errors} erreur(s)</p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={() => launch(selected)}><RotateCcw className="w-4 h-4 mr-1" />Recommencer</Button>
                    <Button onClick={() => setSelected(null)}>Autre opération</Button>
                  </div>
                </div>
              )}

              {/* Step list */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Protocole</h4>
                <ol className="space-y-1.5">
                  {selected.steps.map((s, i) => (
                    <li key={i} className={cn("flex items-center gap-2 text-xs", i < stepIdx ? "text-success" : i === stepIdx ? "text-foreground font-medium" : "text-muted-foreground")}>
                      {i < stepIdx ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px]">{i + 1}</span>}
                      {s.title}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
          <div className="mt-6"><MedicalDisclaimer /></div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl md:text-3xl">Simulation 3D d'opérations</h1>
          <p className="text-muted-foreground text-sm mt-1">Entraînement immersif guidé par IA — étudiants et professionnels.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <ClientOnly fallback={<div className="w-full h-[420px] md:h-[520px] rounded-2xl bg-muted animate-pulse" />}><Suspense fallback={null}><HumanBody3D /></Suspense></ClientOnly>
          <div className="space-y-3">
            <h2 className="font-display font-semibold text-lg">Choisissez une opération</h2>
            {OPERATIONS.map((op) => (
              <button
                key={op.id}
                onClick={() => launch(op)}
                className="w-full text-left p-4 rounded-xl border border-border bg-card hover:border-teal hover:shadow-lg transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display font-bold">{op.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{op.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px]">{op.difficulty}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{op.duration}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{op.steps.length} étapes</Badge>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-teal transition-colors shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>

        <MedicalDisclaimer />
      </div>
    </AppShell>
  );
}
