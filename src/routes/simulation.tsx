import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { AnatomyViewer } from "@/components/ar/AnatomyViewer";
import { OPERATIONS, type Operation } from "@/lib/operations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Trophy,
  Activity,
  ListChecks,
  PlayCircle,
  Star,
  ShoppingBag,
  Volume2,
  Maximize2,
  BookOpen,
  Save,
  Share2,
  BrainCog,
  StickyNote,
  ArrowRight,
} from "lucide-react";
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
import { StepsPanel } from "@/components/simulation/StepsPanel";
import { ToolsPanel } from "@/components/simulation/ToolsPanel";
import { LaparoscopicView } from "@/components/simulation/LaparoscopicView";
import { OrganInfoPanel } from "@/components/simulation/OrganInfoPanel";
import { ViewportControls } from "@/components/simulation/ViewportControls";
import { RealtimeOverlay } from "@/components/simulation/RealtimeOverlay";

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
const OPERATION_SYSTEM: Record<string, AnatomySystem> = {
  appendicectomie: "digestive",
  "pontage-coronarien": "circulatory",
  "fracture-tibia": "skeletal",
};

function shortOpName(name: string) {
  // Show a short label in the breadcrumb (matches mockup style "APPENDICITE")
  if (/appendic/i.test(name)) return "APPENDICITE";
  if (/pontage|coronar/i.test(name)) return "PONTAGE CORONARIEN";
  if (/tibia|fracture/i.test(name)) return "FRACTURE TIBIA";
  return name.toUpperCase();
}

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

  const [system, setSystem] = useState<AnatomySystem>("digestive");
  const [viewMode, setViewMode] = useState<AnatomyView>("complete");
  const [activeTool, setActiveTool] = useState<string>("bistouri");
  const [pickedOrgan, setPickedOrgan] = useState<string | null>(null);
  const [viewerMode] = useState<ViewerMode>("web");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [casesOpen, setCasesOpen] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const notesKey = selected ? `doctorai_notes_${selected.id}` : null;
  useEffect(() => {
    if (!notesKey || typeof window === "undefined") return;
    setNotes(localStorage.getItem(notesKey) ?? "");
  }, [notesKey]);
  const saveNotes = () => {
    if (!notesKey || typeof window === "undefined") return;
    localStorage.setItem(notesKey, notes);
    toast.success("Notes enregistrées");
    setNotesOpen(false);
  };

  const score = useMemo(() => Math.max(0, 1000 - errors * 120), [errors]);
  const scoreOn100 = useMemo(() => Math.max(0, 100 - errors * 12), [errors]);
  const stars = Math.max(1, Math.min(5, Math.round(scoreOn100 / 20)));
  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(GLB_STORAGE_KEY);
    if (saved) {
      setGlbUrl(saved);
      setActiveGlb(saved);
    }
  }, []);

  useEffect(() => {
    if (!selected || completed) return;
    if (startedAt.current === null) startedAt.current = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000)), 1000);
    return () => clearInterval(t);
  }, [selected, completed]);

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

  useEffect(() => {
    if (!selected || completed) return;
    const t = setInterval(() => {
      persistProgress(selected, { elapsed_seconds: elapsed, patient, current_step: stepIdx, errors, score: scoreOn100, completed: false });
    }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, completed, elapsed, patient, stepIdx, errors, scoreOn100]);

  useEffect(() => {
    if (!selected || completed) return;
    const handler = () => {
      persistProgress(selected, { elapsed_seconds: elapsed, patient, current_step: stepIdx, errors, score: scoreOn100, completed: false });
    };
    window.addEventListener("beforeunload", handler);
    document.addEventListener("visibilitychange", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      document.removeEventListener("visibilitychange", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, completed, elapsed, patient, stepIdx, errors, scoreOn100]);

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
    setSystem(OPERATION_SYSTEM[op.id] ?? "digestive");
    if (resume && saved && !saved.completed) {
      setStepIdx(saved.current_step);
      setErrors(saved.errors);
      setCompleted(false);
      setDebrief(saved.debrief ?? "");
      setElapsed(saved.elapsed_seconds ?? 0);
      startedAt.current = Date.now() - (saved.elapsed_seconds ?? 0) * 1000;
      if (saved.patient) setPatient(saved.patient);
      toast.success(`Reprise — étape ${saved.current_step + 1}`);
      if (soundOn) speak(`Reprise de ${op.name}, étape ${saved.current_step + 1}.`);
    } else {
      setStepIdx(0);
      setErrors(0);
      setCompleted(false);
      setDebrief("");
      setElapsed(0);
      startedAt.current = Date.now();
      if (soundOn) speak(`Lancement de ${op.name}. Étape 1, ${op.steps[0].title}.`);
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
    if (soundOn) speak(`Étape ${newStep + 1}. ${selected.steps[newStep].title}.`);
    persistProgress(selected, { current_step: newStep, errors, score: scoreOn100, completed: false });
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
        `Chirurgien-instructeur. L'apprenant termine "${selected.name}" avec ${errors} erreur(s), score ${scoreOn100}/100, ${selected.steps.length} étapes.\nDEBRIEF markdown :\n## Points forts\n## Points d'amélioration\n## Recommandations\n## Niveau atteint\nMax 12 lignes.`,
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
        result: { score: scoreOn100, errors, steps: selected.steps.length },
      });
      toast.success(`Simulation terminée ! Score : ${scoreOn100}/100`);
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

  const toggleFullscreen = () => {
    const el = viewportRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const manualSave = async () => {
    if (!selected) return;
    await persistProgress(selected, { elapsed_seconds: elapsed, patient, current_step: stepIdx, errors, score: scoreOn100, completed: false });
    toast.success("Progression enregistrée");
  };

  const sharePermalink = async () => {
    if (!selected) return;
    const url = `${window.location.origin}/simulation?op=${selected.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié dans le presse-papiers");
    } catch {
      toast.info(url);
    }
  };

  // ============ Active simulation view (matches AfriDoctor mockup) ============
  if (selected) {
    const step = selected.steps[stepIdx];
    const allChecked = (step.checklist ?? []).every((_, i) => checked[i]);
    return (
      <AppShell>
        <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-4 space-y-3">
          {/* Breadcrumb row */}
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold">
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white transition-colors">
              Simulation 3D
            </button>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="text-sky-400">{shortOpName(selected.name)}</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[10px] text-rose-300 tracking-widest">REC</span>
            </span>
          </div>

          {/* Main grid: sidebar | controls + viewport | right panel */}
          <div className="grid grid-cols-12 gap-3">
            {/* Left sidebar */}
            <div className="col-span-12 lg:col-span-3 xl:col-span-2 order-2 lg:order-1 space-y-3">
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
              {showDiagnostics && <DiagnosticsPanel activeGlbUrl={activeGlb} onSetViewerMode={() => {}} />}
            </div>

            {/* Center: vertical controls + viewport */}
            <div className="col-span-12 lg:col-span-6 xl:col-span-7 order-1 lg:order-2">
              <div className="flex gap-3">
                <div className="hidden md:block">
                  <ViewportControls />
                </div>

                <div ref={viewportRef} className="flex-1 relative rounded-2xl overflow-hidden border border-white/5 bg-gradient-to-b from-[oklch(0.18_0.04_252)] to-[oklch(0.11_0.03_255)]">
                  {/* Top-right viewport actions */}
                  <div className="absolute top-3 right-3 z-10 flex gap-2">
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 text-xs backdrop-blur"
                    >
                      <Maximize2 className="w-3.5 h-3.5" /> Plein écran
                    </button>
                    <button
                      type="button"
                      onClick={() => setSoundOn((v) => !v)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs backdrop-blur",
                        soundOn
                          ? "bg-sky-500/20 border-sky-400/40 text-sky-100"
                          : "bg-white/5 border-white/10 text-slate-100 hover:bg-white/10",
                      )}
                    >
                      <Volume2 className="w-3.5 h-3.5" /> Son
                    </button>
                  </div>

                  <AnatomyViewer
                    mode={viewerMode}
                    highlightOrgan={selected.organ}
                    glbUrl={activeGlb}
                    system={system}
                    view={viewMode}
                    onPickPart={setPickedOrgan}
                    height="h-[520px] md:h-[640px]"
                  />
                  <RealtimeOverlay
                    stepIndex={stepIdx}
                    stepTitle={step.title}
                    totalSteps={selected.steps.length}
                    activeTool={activeTool}
                    hr={patient.vitals?.hr ?? 72}
                  />
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="col-span-12 lg:col-span-3 order-3 space-y-3">
              <StepsPanel
                steps={selected.steps}
                currentStep={stepIdx}
                onSelect={(i) => {
                  if (i < stepIdx) {
                    setStepIdx(i);
                    setChecked({});
                    setAiTip("");
                    if (soundOn) speak(`Retour à l'étape ${i + 1}.`);
                  }
                }}
              />
              <ToolsPanel
                activeTool={activeTool}
                onChange={(id) => {
                  setActiveTool(id);
                  toast.success(`Outil : ${id}`);
                }}
              />

              <div className="rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur p-4 space-y-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">Description</p>
                <p className="text-[13px] text-slate-200 leading-relaxed">{step.description}</p>
              </div>

              <LaparoscopicView stepIndex={stepIdx} label={step.title} />
            </div>
          </div>

          {/* Expanded step details (checklist, risks, AI tip) */}
          {!completed && (
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 lg:col-start-4 lg:col-span-6 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-sm shrink-0">{stepIdx + 1}</div>
                  <h3 className="font-display font-bold text-base text-white leading-tight flex-1">{step.title}</h3>
                  <Button onClick={askAI} disabled={aiLoading} size="sm" variant="outline" className="h-8 bg-white/5 border-white/10 text-slate-100 hover:bg-white/10">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" /> {aiLoading ? "…" : "Aide IA"}
                  </Button>
                </div>

                {step.vitalCheck && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs text-slate-200">
                    <Activity className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                    <span><strong className="text-sky-200">Surveillance :</strong> {step.vitalCheck}</span>
                  </div>
                )}

                {step.checklist && step.checklist.length > 0 && (
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                      <ListChecks className="w-3.5 h-3.5" /> Checklist sécurité
                    </div>
                    <div className="space-y-1.5">
                      {step.checklist.map((item, i) => (
                        <label key={i} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-white/5 p-1 rounded text-slate-200">
                          <Checkbox checked={!!checked[i]} onCheckedChange={(v) => setChecked((c) => ({ ...c, [i]: !!v }))} className="mt-0.5" />
                          <span className={cn("flex-1", checked[i] && "line-through text-slate-500")}>{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {step.risks && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-slate-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong className="text-amber-200">Risque :</strong> {step.risks}</span>
                  </div>
                )}

                {aiTip && (
                  <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ol:my-1 prose-ul:my-1">
                    <div className="flex items-center gap-1.5 font-semibold text-sky-300 mb-1 not-prose"><Sparkles className="w-3.5 h-3.5" /> Conseil IA</div>
                    <ReactMarkdown>{aiTip}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Patient monitor + generator (secondary row) */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 lg:col-span-5 xl:col-span-4 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">Moniteur patient</p>
                <Badge variant="secondary" className="text-[10px] bg-white/5 text-slate-200 border-white/10">
                  {patient.sex === "M" ? "H" : "F"} · {patient.age} ans · {patient.riskLevel}
                </Badge>
              </div>
              <PatientMonitor baseVitals={patient.vitals ?? DEFAULT_VITALS} alert={!!step.risks && stepIdx >= 2} />
            </div>

            <div className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-wrap items-center gap-2">
              <PatientGenerator current={patient} onGenerated={(p) => { setPatient(p); if (selected) persistProgress(selected, { patient: p }); }} />
              <Button
                variant="outline"
                size="sm"
                disabled={regenLoading}
                className="bg-white/5 border-white/10 text-slate-100 hover:bg-white/10"
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
              <VoiceCommand onLaunch={launchById} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDiagnostics((v) => !v)}
                className="bg-white/5 border-white/10 text-slate-100 hover:bg-white/10"
              >
                <Activity className="w-3.5 h-3.5 mr-1.5" /> Diagnostics
              </Button>
            </div>
          </div>

          {/* Completion panel */}
          {completed && (
            <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 to-cyan-500/10 border border-sky-500/30 backdrop-blur p-6">
              <div className="text-center mb-4">
                <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <h3 className="font-display font-bold text-2xl mb-1 text-white">Opération terminée !</h3>
                <p className="text-sm text-slate-300">Score final : <strong className="text-white">{score}/1000</strong> • {errors} erreur(s) • {fmtTime(elapsed)}</p>
                <div className="flex gap-2 justify-center flex-wrap mt-3">
                  <Button variant="outline" onClick={() => launch(selected)} className="bg-white/5 border-white/10 text-slate-100 hover:bg-white/10">
                    <RotateCcw className="w-4 h-4 mr-1" />Recommencer
                  </Button>
                  <Button variant="outline" onClick={() => setSelected(null)} className="bg-white/5 border-white/10 text-slate-100 hover:bg-white/10">
                    Autre opération
                  </Button>
                  <Button
                    className="bg-sky-500 hover:bg-sky-400 text-white"
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

              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <h4 className="font-display font-bold text-white">Debrief IA</h4>
                </div>
                {debriefLoading ? (
                  <p className="text-sm text-slate-400 animate-pulse">Génération du debrief…</p>
                ) : debrief ? (
                  <div className="prose prose-invert prose-sm max-w-none text-slate-200 prose-headings:text-white prose-headings:font-display prose-h2:mt-3">
                    <ReactMarkdown>{debrief}</ReactMarkdown>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={generateDebrief} className="bg-white/5 border-white/10 text-slate-100 hover:bg-white/10">
                    Générer le debrief
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Bottom bar: actions + time / score / next (matches mockup) */}
          <div className="sticky bottom-3 z-20">
            <div className="rounded-2xl bg-[oklch(0.16_0.035_252/0.9)] border border-white/5 backdrop-blur-xl px-3 md:px-4 py-3 shadow-[0_-8px_30px_-12px_oklch(0.1_0.03_255/0.6)]">
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <button onClick={askAI} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 text-xs">
                  <BrainCog className="w-4 h-4" /> Aide IA
                </button>
                <button onClick={() => setCasesOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 text-xs">
                  <BookOpen className="w-4 h-4" /> Cas pratiques
                </button>
                <button onClick={() => setNotesOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 text-xs">
                  <StickyNote className="w-4 h-4" /> Notes{notes.trim() ? ` (${notes.trim().length})` : ""}
                </button>
                <button onClick={manualSave} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 text-xs">
                  <Save className="w-4 h-4" /> Enregistrer
                </button>
                <button onClick={sharePermalink} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 text-xs">
                  <Share2 className="w-4 h-4" /> Partager
                </button>

                <div className="ml-auto flex items-center gap-3 md:gap-5">
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">Temps</p>
                    <p className="font-mono font-bold text-base text-white leading-none mt-0.5">{fmtTime(elapsed)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">Score</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-bold text-base text-white leading-none">{score} <span className="text-slate-500 font-normal">/ 1000</span></span>
                      <span className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn("w-3 h-3", i < stars ? "fill-amber-400 text-amber-400" : "text-slate-700")} />
                        ))}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={next}
                    disabled={!!step.checklist?.length && !allChecked}
                    className="h-10 px-4 md:px-5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl"
                  >
                    Suivant <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                  <button
                    onClick={skip}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Sauter
                  </button>
                </div>
              </div>
            </div>
          </div>

          <MedicalDisclaimer />
        </div>
        <OrganInfoPanel organ={pickedOrgan} onClose={() => setPickedOrgan(null)} />

        <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
          <DialogContent className="bg-[oklch(0.16_0.035_252)] border-white/10 text-slate-100">
            <DialogHeader>
              <DialogTitle className="text-white">Notes de session</DialogTitle>
              <DialogDescription className="text-slate-400">
                Vos observations sur « {selected.name} ». Sauvegardées localement.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={10}
              placeholder="Ex : penser à vérifier la ligature de la base…"
              className="bg-white/5 border-white/10 text-slate-100"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesOpen(false)} className="bg-white/5 border-white/10 text-slate-100 hover:bg-white/10">Fermer</Button>
              <Button onClick={saveNotes} className="bg-sky-500 hover:bg-sky-400 text-white">Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={casesOpen} onOpenChange={setCasesOpen}>
          <DialogContent className="bg-[oklch(0.16_0.035_252)] border-white/10 text-slate-100 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">Cas pratiques</DialogTitle>
              <DialogDescription className="text-slate-400">
                Sélectionnez un scénario pour recharger un profil patient adapté.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {OPERATIONS.map((op) => (
                <button
                  key={op.id}
                  onClick={() => { launch(op); setCasesOpen(false); }}
                  className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white text-sm">{op.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{op.description}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-white/10 text-slate-300 shrink-0">{op.difficulty}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </AppShell>
    );
  }

  // ============ Operation selection screen ============
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-2xl md:text-3xl text-white">Simulation 3D d'opérations</h1>
            <p className="text-slate-400 text-sm mt-1">Entraînement immersif guidé par IA — étudiants et professionnels.</p>
            <p className="text-[11px] text-slate-500 mt-1">💡 Essayez : <em>« Montre-moi opération du cœur »</em></p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <VoiceCommand onLaunch={launchById} />
            <AnatomyAtlas />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="rounded-2xl overflow-hidden border border-white/5 bg-gradient-to-b from-[oklch(0.18_0.04_252)] to-[oklch(0.11_0.03_255)]">
            <AnatomyViewer glbUrl={activeGlb} system="full" view="complete" onPickPart={setPickedOrgan} height="h-[420px] md:h-[520px]" />
          </div>
          <div className="space-y-3">
            <h2 className="font-display font-semibold text-lg text-white">Choisissez une opération</h2>
            {OPERATIONS.map((op) => {
              const saved = progressMap[op.id];
              const inProgress = saved && !saved.completed && saved.current_step > 0;
              return (
                <div key={op.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-sky-500/50 hover:bg-white/[0.07] transition-all">
                  <button onClick={() => launch(op)} className="w-full text-left p-4 group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-display font-bold text-white">{op.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{op.description}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] border-white/10 text-slate-300">{op.difficulty}</Badge>
                          <Badge variant="secondary" className="text-[10px] bg-white/5 text-slate-300 border-white/10">{op.duration}</Badge>
                          <Badge variant="secondary" className="text-[10px] bg-white/5 text-slate-300 border-white/10">{op.steps.length} étapes</Badge>
                          {saved?.completed && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-500/30">✓ Terminé · {saved.score}/100</Badge>}
                          {inProgress && <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30">En cours · étape {saved.current_step + 1}</Badge>}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-sky-400 transition-colors shrink-0 mt-1" />
                    </div>
                  </button>
                  {inProgress && (
                    <div className="border-t border-white/10 px-4 py-2 bg-white/5 flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => launch(op, true)} className="bg-white/5 border-white/10 text-slate-100 hover:bg-white/10">
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
