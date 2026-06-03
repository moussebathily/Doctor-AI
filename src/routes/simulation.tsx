import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { ClientOnly } from "@/components/ClientOnly";
import { AnatomyViewer } from "@/components/ar/AnatomyViewer";
import { OPERATIONS, type Operation } from "@/lib/operations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, AlertTriangle, ChevronRight, RotateCcw, Sparkles, Trophy, ArrowLeft, Activity, ListChecks, PlayCircle, Star, Clock, ShoppingBag, Volume2 } from "lucide-react";
import { AnatomyAtlas } from "@/components/AnatomyAtlas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { PatientMonitor, DEFAULT_VITALS } from "@/components/PatientMonitor";
import { PatientGenerator, DEFAULT_PATIENT, generatePatientScenario, type PatientProfile } from "@/components/PatientGenerator";
import { VoiceCommand } from "@/components/VoiceCommand";
import { setPharmacyPrefill, DEFAULT_TREATMENTS } from "@/lib/sim-bridge";
import { speak } from "@/lib/voice";
import { SystemSidebar, type AnatomySystem, type AnatomyView } from "@/components/simulation/SystemSidebar";
import { DiagnosticsPanel } from "@/components/simulation/DiagnosticsPanel";
import type { ViewerMode } from "@/components/ar/types";
import { Smartphone, Globe } from "lucide-react";
import { StepsPanel } from "@/components/simulation/StepsPanel";
import { ToolsPanel } from "@/components/simulation/ToolsPanel";
import { LaparoscopicView } from "@/components/simulation/LaparoscopicView";
import { InnovativeIdeasBar } from "@/components/simulation/InnovativeIdeasBar";
import { OrganInfoPanel } from "@/components/simulation/OrganInfoPanel";

export const Route = createFileRoute("/simulation")({
  validateSearch: (s: Record<string, unknown>) => ({ op: typeof s.op === "string" ? s.op : undefined }),
  head: () => ({
    meta: [
      { title: "Simulation 3D — Doctor AI" },
      { name: "description", content: "Entraînement immersif aux opérations médicales en 3D, guidé par IA." },
    ],
  }),
  component: SimulationPage,
});

type ProgressRow = {
  operation_id: string;
  current_step: number;
  errors: number;
  score: number;
  completed: boolean;
  debrief: string | null;
  elapsed_seconds?: number;
  patient?: PatientProfile | null;
};

const GLB_STORAGE_KEY = "doctorai_glb_url_v1";
// Operation-system default mapping
const OPERATION_SYSTEM: Record<string, AnatomySystem> = {
  appendicectomie: "digestive",
  "pontage-coronarien": "circulatory",
  "fracture-tibia": "skeletal",
};

function SimulationPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Operation | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [errors, setErrors] = useState(0);
  const [aiTip, setAiTip] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [debrief, setDebrief] = useState<string>("");
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, ProgressRow>>({});
  const [autoPreselect, setAutoPreselect] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientProfile>(DEFAULT_PATIENT);
  const [glbUrl, setGlbUrl] = useState<string>("");
  const [activeGlb, setActiveGlb] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);

  const [system, setSystem] = useState<AnatomySystem>("full");
  const [viewMode, setViewMode] = useState<AnatomyView>("complete");
  const [activeTool, setActiveTool] = useState<string>("bistouri");
  const [pickedOrgan, setPickedOrgan] = useState<string | null>(null);

  const score = useMemo(() => Math.max(0, 100 - errors * 12), [errors]);
  const stars = Math.max(1, Math.min(5, Math.round(score / 20)));
  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // Load persisted GLB url on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(GLB_STORAGE_KEY);
    if (saved) {
      setGlbUrl(saved);
      setActiveGlb(saved);
    }
  }, []);

  // Chrono
  useEffect(() => {
    if (!selected || completed) return;
    if (startedAt.current === null) startedAt.current = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000)), 1000);
    return () => clearInterval(t);
  }, [selected, completed]);

  // Load existing progress
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("surgery_progress").select("operation_id,current_step,errors,score,completed,debrief,elapsed_seconds,patient").eq("user_id", u.user.id);
      const map: Record<string, ProgressRow> = {};
      (data ?? []).forEach((r) => (map[r.operation_id] = r as ProgressRow));
      setProgressMap(map);
    })();
  }, []);

  // Deep-link from URL (?op=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const op = new URLSearchParams(window.location.search).get("op");
    if (op) setAutoPreselect(op);
  }, []);

  useEffect(() => {
    if (autoPreselect) {
      const o = OPERATIONS.find((x) => x.id === autoPreselect);
      if (o) launch(o);
      setAutoPreselect(null);
      return;
    }
    if (selected) return;
    const inProgress = Object.values(progressMap).filter((p) => !p.completed && p.current_step > 0);
    if (inProgress.length === 0) return;
    const op = OPERATIONS.find((o) => o.id === inProgress[0].operation_id);
    if (op) launch(op, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPreselect, progressMap]);

  // Periodic auto-save
  useEffect(() => {
    if (!selected || completed) return;
    const t = setInterval(() => {
      persistProgress(selected, { elapsed_seconds: elapsed, patient, current_step: stepIdx, errors, score, completed: false });
    }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, completed, elapsed, patient, stepIdx, errors, score]);

  // Save on tab close
  useEffect(() => {
    if (!selected || completed) return;
    const handler = () => {
      persistProgress(selected, { elapsed_seconds: elapsed, patient, current_step: stepIdx, errors, score, completed: false });
    };
    window.addEventListener("beforeunload", handler);
    document.addEventListener("visibilitychange", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      document.removeEventListener("visibilitychange", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, completed, elapsed, patient, stepIdx, errors, score]);

  const persistProgress = async (op: Operation, patch: Partial<ProgressRow>) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const base = progressMap[op.id] ?? { operation_id: op.id, current_step: 0, errors: 0, score: 100, completed: false, debrief: null, elapsed_seconds: 0, patient: null };
    const next = { ...base, ...patch };
    setProgressMap((m) => ({ ...m, [op.id]: next }));
    await supabase.from("surgery_progress").upsert({ user_id: u.user.id, ...next }, { onConflict: "user_id,operation_id" });
  };

  const launch = (op: Operation, resume = false) => {
    const saved = progressMap[op.id];
    setSelected(op);
    setSystem(OPERATION_SYSTEM[op.id] ?? "full");
    if (resume && saved && !saved.completed) {
      setStepIdx(saved.current_step);
      setErrors(saved.errors);
      setCompleted(false);
      setDebrief(saved.debrief ?? "");
      setElapsed(saved.elapsed_seconds ?? 0);
      startedAt.current = Date.now() - (saved.elapsed_seconds ?? 0) * 1000;
      if (saved.patient) setPatient(saved.patient);
      toast.success(`Reprise — étape ${saved.current_step + 1}`);
      speak(`Reprise de ${op.name}, étape ${saved.current_step + 1}.`);
    } else {
      setStepIdx(0);
      setErrors(0);
      setCompleted(false);
      setDebrief("");
      setElapsed(0);
      startedAt.current = Date.now();
      speak(`Lancement de ${op.name}. Étape 1, ${op.steps[0].title}.`);
    }
    setChecked({});
    setAiTip("");
  };

  const launchById = (id: string) => {
    const op = OPERATIONS.find((o) => o.id === id);
    if (op) launch(op);
  };

  const next = () => {
    if (!selected) return;
    if (stepIdx + 1 >= selected.steps.length) {
      setCompleted(true);
      saveSimulation(true);
      generateDebrief();
      return;
    }
    const newStep = stepIdx + 1;
    setStepIdx(newStep);
    setAiTip("");
    setChecked({});
    speak(`Étape ${newStep + 1}. ${selected.steps[newStep].title}.`);
    persistProgress(selected, { current_step: newStep, errors, score, completed: false });
  };

  const skip = () => {
    const newErr = errors + 1;
    setErrors(newErr);
    toast.error("Étape sautée — pénalité appliquée");
    if (selected) persistProgress(selected, { errors: newErr, score: Math.max(0, 100 - newErr * 12) });
    next();
  };

  const callAI = async (prompt: string) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/medical-ai`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "research", stream: false, prompt }),
    });
    const j = await r.json();
    return j.content ?? j.raw ?? "";
  };

  const askAI = async () => {
    if (!selected) return;
    setAiLoading(true);
    try {
      const step = selected.steps[stepIdx];
      const text = await callAI(
        `Tu es un chirurgien instructeur expert. Pour l'étape "${step.title}" de l'opération "${selected.name}" :\n1) 3 conseils pratiques\n2) 2 risques à anticiper\n3) 1 critère de réussite\nMarkdown, max 8 lignes. Description : ${step.description}`,
      );
      setAiTip(text || "Pas de conseil disponible.");
    } catch {
      setAiTip("Erreur IA — réessayez.");
    } finally {
      setAiLoading(false);
    }
  };

  const generateDebrief = async () => {
    if (!selected) return;
    setDebriefLoading(true);
    try {
      const text = await callAI(
        `Chirurgien-instructeur. L'apprenant termine "${selected.name}" avec ${errors} erreur(s), score ${score}/100, ${selected.steps.length} étapes.\nDEBRIEF markdown :\n## Points forts\n## Points d'amélioration\n## Recommandations\n## Niveau atteint\nMax 12 lignes.`,
      );
      setDebrief(text);
      if (selected) persistProgress(selected, { debrief: text, completed: true });
    } catch {
      setDebrief("Debrief indisponible.");
    } finally {
      setDebriefLoading(false);
    }
  };

  const saveSimulation = async (final: boolean) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !selected) return;
    if (final) {
      await supabase.from("lab_simulations").insert({
        user_id: u.user.id,
        kind: `surgery_${selected.id}`,
        patient: { operation: selected.name },
        result: { score, errors, steps: selected.steps.length },
      });
      toast.success(`Simulation terminée ! Score : ${score}/100`);
    }
  };

  const loadGlb = () => {
    const v = glbUrl.trim();
    setActiveGlb(v || null);
    if (typeof window !== "undefined") {
      if (v) localStorage.setItem(GLB_STORAGE_KEY, v);
      else localStorage.removeItem(GLB_STORAGE_KEY);
    }
    if (v) toast.success("Modèle 3D chargé");
  };

  const clearGlb = () => {
    setActiveGlb(null);
    setGlbUrl("");
    if (typeof window !== "undefined") localStorage.removeItem(GLB_STORAGE_KEY);
  };

  // ============ Active simulation view (AfriDoctor-style layout) ============
  if (selected) {
    const step = selected.steps[stepIdx];
    const allChecked = (step.checklist ?? []).every((_, i) => checked[i]);
    return (
      <AppShell>
        <div className="max-w-[1600px] mx-auto p-3 md:p-4 space-y-3 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 min-h-screen">
          {/* Top header bar */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="md:col-span-3 rounded-2xl border border-border bg-gradient-to-r from-slate-900 to-slate-800 text-white p-3 flex items-center gap-3 backdrop-blur">
              <Button variant="ghost" size="sm" className="text-white/90 hover:bg-white/10 hover:text-white" onClick={() => setSelected(null)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-widest text-emerald-400/90 font-semibold">Opération</p>
                <p className="font-display font-bold text-sm md:text-base truncate uppercase">{selected.name}</p>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" title="REC" />
            </div>
            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Temps</p>
                <p className="font-mono font-bold text-base leading-none">{fmtTime(elapsed)}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-warning" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Score</p>
                <div className="flex items-center gap-1">
                  <span className="font-mono font-bold text-base">{score}</span>
                  <span className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={cn("w-3 h-3", i < stars ? "fill-warning text-warning" : "text-muted")} />
                    ))}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3 flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-teal" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Étape</p>
                <p className="font-mono font-bold text-base">{stepIdx + 1} / {selected.steps.length}</p>
              </div>
            </div>
          </div>

          {/* Toolbar: patient + regenerate */}
          <div className="flex flex-wrap items-center gap-2">
            <PatientGenerator current={patient} onGenerated={(p) => { setPatient(p); if (selected) persistProgress(selected, { patient: p }); }} />
            <Button
              variant="outline"
              size="sm"
              disabled={regenLoading}
              onClick={async () => {
                setRegenLoading(true);
                try {
                  const p = await generatePatientScenario({ age: patient.age, sex: patient.sex, condition: patient.condition, weightKg: patient.weightKg });
                  setPatient(p);
                  if (selected) persistProgress(selected, { patient: p });
                  toast.success("Nouveau scénario patient");
                } catch {
                  toast.error("Échec régénération");
                } finally {
                  setRegenLoading(false);
                }
              }}
            >
              <RotateCcw className={cn("w-4 h-4 mr-1.5", regenLoading && "animate-spin")} /> Générer encore
            </Button>
            <Badge variant="secondary" className="text-[10px]">
              {patient.sex === "M" ? "Homme" : "Femme"} · {patient.age} ans · risque {patient.riskLevel}
            </Badge>
          </div>

          {/* Main grid: sidebar | 3D | right panels */}
          <div className="grid grid-cols-12 gap-3">
            {/* Left sidebar */}
            <div className="col-span-12 lg:col-span-2 order-2 lg:order-1">
              <SystemSidebar
                system={system}
                view={viewMode}
                onSystemChange={setSystem}
                onViewChange={setViewMode}
                glbUrl={glbUrl}
                onGlbUrlChange={setGlbUrl}
                onLoadGlb={loadGlb}
                onClearGlb={clearGlb}
                hasGlb={!!activeGlb}
              />
            </div>

            {/* Center: 3D viewport */}
            <div className="col-span-12 lg:col-span-7 order-1 lg:order-2 space-y-3">
              <AnatomyViewer
                mode="web"
                highlightOrgan={selected.organ}
                glbUrl={activeGlb}
                system={system}
                view={viewMode}
                onPickPart={setPickedOrgan}
                height="h-[420px] md:h-[560px]"
              />

              {/* Step description bar */}
              <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3 flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => speak(`Étape ${stepIdx + 1}. ${step.title}. ${step.description}`)} className="shrink-0 h-9 w-9" title="Lire l'étape">
                  <Volume2 className="w-4 h-4" />
                </Button>
                <p className="text-sm flex-1 min-w-0">
                  <span className="font-semibold">Étape {stepIdx + 1} :</span> {step.description}
                </p>
                <Button onClick={askAI} disabled={aiLoading} variant="outline" size="sm" className="shrink-0">
                  <Sparkles className="w-4 h-4 mr-1.5" /> {aiLoading ? "…" : "IA Assistant"}
                </Button>
              </div>

              {/* Step details (checklist / risks / AI tip) */}
              {!completed ? (
                <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-teal text-teal-foreground flex items-center justify-center font-bold text-sm shrink-0">{stepIdx + 1}</div>
                    <h3 className="font-display font-bold text-lg leading-tight">{step.title}</h3>
                  </div>

                  {step.vitalCheck && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-accent/10 border border-accent/30 text-xs">
                      <Activity className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                      <span><strong>Surveillance :</strong> {step.vitalCheck}</span>
                    </div>
                  )}

                  {step.checklist && step.checklist.length > 0 && (
                    <div className="p-3 rounded-lg bg-muted/40 border border-border">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        <ListChecks className="w-3.5 h-3.5" /> Checklist sécurité
                      </div>
                      <div className="space-y-1.5">
                        {step.checklist.map((item, i) => (
                          <label key={i} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-background/50 p-1 rounded">
                            <Checkbox checked={!!checked[i]} onCheckedChange={(v) => setChecked((c) => ({ ...c, [i]: !!v }))} className="mt-0.5" />
                            <span className={cn("flex-1", checked[i] && "line-through text-muted-foreground")}>{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {step.risks && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs">
                      <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                      <span><strong>Risque :</strong> {step.risks}</span>
                    </div>
                  )}

                  {aiTip && (
                    <div className="p-3 rounded-lg bg-accent/10 border border-accent/30 text-xs leading-relaxed prose prose-sm max-w-none prose-headings:text-sm prose-p:my-1 prose-ol:my-1 prose-ul:my-1">
                      <div className="flex items-center gap-1.5 font-semibold text-accent mb-1 not-prose"><Sparkles className="w-3.5 h-3.5" /> Conseil IA</div>
                      <ReactMarkdown>{aiTip}</ReactMarkdown>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={next} disabled={!!step.checklist?.length && !allChecked} className="flex-1 bg-accent hover:bg-accent/90" title={!allChecked ? "Cochez tous les items" : ""}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Valider l'étape
                    </Button>
                    <Button variant="ghost" onClick={skip} className="text-muted-foreground">Sauter</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-gradient-to-br from-teal/20 to-accent/10 rounded-2xl border border-teal/40 p-6 text-center">
                    <Trophy className="w-12 h-12 text-teal mx-auto mb-3" />
                    <h3 className="font-display font-bold text-2xl mb-1">Opération terminée !</h3>
                    <p className="text-sm text-muted-foreground mb-3">Score final : <strong className="text-foreground">{score}/100</strong> • {errors} erreur(s) • {fmtTime(elapsed)}</p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      <Button variant="outline" onClick={() => launch(selected)}><RotateCcw className="w-4 h-4 mr-1" />Recommencer</Button>
                      <Button variant="outline" onClick={() => setSelected(null)}>Autre opération</Button>
                      <Button
                        className="bg-teal hover:bg-teal/90 text-teal-foreground"
                        onClick={() => {
                          const t = DEFAULT_TREATMENTS[selected.id];
                          if (!t) { toast.info("Aucun protocole post-op pré-défini"); return; }
                          setPharmacyPrefill({ reason: t.reason, searchTerms: t.terms });
                          toast.success("Panier pharmacie pré-rempli");
                          navigate({ to: "/pharmacy" });
                        }}
                      >
                        <ShoppingBag className="w-4 h-4 mr-1" />Commander le traitement
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-accent" />
                      <h4 className="font-display font-bold">Debrief IA</h4>
                    </div>
                    {debriefLoading ? (
                      <p className="text-sm text-muted-foreground animate-pulse">Génération du debrief…</p>
                    ) : debrief ? (
                      <div className="prose prose-sm max-w-none text-sm prose-headings:text-base prose-headings:font-display prose-h2:mt-3">
                        <ReactMarkdown>{debrief}</ReactMarkdown>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={generateDebrief}>Générer le debrief</Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right column: steps + tools + monitor + laparo */}
            <div className="col-span-12 lg:col-span-3 order-3 space-y-3">
              <StepsPanel steps={selected.steps} currentStep={stepIdx} />
              <ToolsPanel activeTool={activeTool} onChange={setActiveTool} />
              <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-1">Moniteur patient</p>
                <PatientMonitor baseVitals={patient.vitals ?? DEFAULT_VITALS} alert={!!step.risks && stepIdx >= 2} />
              </div>
              <LaparoscopicView />
            </div>
          </div>

          <InnovativeIdeasBar />
          <MedicalDisclaimer />
        </div>
        <OrganInfoPanel organ={pickedOrgan} onClose={() => setPickedOrgan(null)} />
      </AppShell>
    );
  }

  // ============ Operation selection screen ============
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-2xl md:text-3xl">Simulation 3D d'opérations</h1>
            <p className="text-muted-foreground text-sm mt-1">Entraînement immersif guidé par IA — étudiants et professionnels.</p>
            <p className="text-[11px] text-muted-foreground mt-1">💡 Essayez : <em>« Montre-moi opération du cœur »</em></p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <VoiceCommand onLaunch={launchById} />
            <AnatomyAtlas />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <AnatomyViewer glbUrl={activeGlb} system="full" view="complete" onPickPart={setPickedOrgan} height="h-[420px] md:h-[520px]" />
          <div className="space-y-3">
            <h2 className="font-display font-semibold text-lg">Choisissez une opération</h2>
            {OPERATIONS.map((op) => {
              const saved = progressMap[op.id];
              const inProgress = saved && !saved.completed && saved.current_step > 0;
              return (
                <div key={op.id} className="rounded-xl border border-border bg-card overflow-hidden hover:border-teal hover:shadow-lg transition-all">
                  <button onClick={() => launch(op)} className="w-full text-left p-4 group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-display font-bold">{op.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{op.description}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{op.difficulty}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{op.duration}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{op.steps.length} étapes</Badge>
                          {saved?.completed && <Badge className="text-[10px] bg-success text-success-foreground">✓ Terminé · {saved.score}/100</Badge>}
                          {inProgress && <Badge className="text-[10px] bg-warning text-warning-foreground">En cours · étape {saved.current_step + 1}</Badge>}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-teal transition-colors shrink-0 mt-1" />
                    </div>
                  </button>
                  {inProgress && (
                    <div className="border-t border-border px-4 py-2 bg-muted/30 flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => launch(op, true)}>
                        <PlayCircle className="w-3.5 h-3.5 mr-1" /> Reprendre
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <MedicalDisclaimer />
      </div>
      <OrganInfoPanel organ={pickedOrgan} onClose={() => setPickedOrgan(null)} />
    </AppShell>
  );
}
