import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ZoomIn, ZoomOut, Play, Pause, RotateCcw, Settings2, Flag, Plus, X, AlertTriangle, Stethoscope, ListChecks, Pencil, Check, Upload, FileJson, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SeriesKey = "hr" | "spo2" | "bp" | "glu" | "urine" | "creat";

type SeriesDef = {
  key: SeriesKey;
  label: string;
  unit: string;
  color: string;
  min: number;
  max: number;
  group: "vitals" | "labs";
};

const SERIES: SeriesDef[] = [
  { key: "hr",    label: "HR",         unit: "bpm",     color: "#f43f5e", min: 40, max: 180, group: "vitals" },
  { key: "spo2",  label: "SpO₂",       unit: "%",       color: "#38bdf8", min: 85, max: 100, group: "vitals" },
  { key: "bp",    label: "PA syst.",   unit: "mmHg",    color: "#a78bfa", min: 80, max: 170, group: "vitals" },
  { key: "glu",   label: "Glycémie",   unit: "g/L",     color: "#f59e0b", min: 0.6, max: 1.8, group: "labs" },
  { key: "urine", label: "Diurèse",    unit: "mL/kg/h", color: "#22d3ee", min: 0.2, max: 1.6, group: "labs" },
  { key: "creat", label: "Créatinine", unit: "mg/L",    color: "#34d399", min: 5, max: 18, group: "labs" },
];

type Point = { t: number; v: Record<SeriesKey, number> };

type AnnotationKind = "event" | "symptom" | "step";
type Annotation = { id: string; t: number; label: string; kind: AnnotationKind; stepIndex?: number };

const KIND_META: Record<AnnotationKind, { color: string; label: string; Icon: typeof Flag }> = {
  event:   { color: "#f59e0b", label: "Événement", Icon: Flag },
  symptom: { color: "#f43f5e", label: "Symptôme",  Icon: AlertTriangle },
  step:    { color: "#38bdf8", label: "Étape",     Icon: ListChecks },
};

const MAX_HISTORY = 3600; // ~1h at 1Hz

export function TimelinePanel({
  hr = 72,
  alert = false,
  currentStepTitle,
  stepIdx,
  stepTitles,
  onSelectStep,
}: {
  hr?: number;
  alert?: boolean;
  currentStepTitle?: string;
  stepIdx?: number;
  stepTitles?: string[];
  onSelectStep?: (index: number) => void;
}) {
  const [intervalMs, setIntervalMs] = useState(1000);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    hr: true, spo2: true, bp: true, glu: false, urine: false, creat: false,
  });
  const [zoom, setZoom] = useState(1);
  const [cursor, setCursor] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annoDraft, setAnnoDraft] = useState("");
  const [annoKind, setAnnoKind] = useState<AnnotationKind>("event");

  const historyRef = useRef<Point[]>([]);
  const startRef = useRef<number>(Date.now());
  const [, setTick] = useState(0);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      const j = (a: number) => (Math.random() - 0.5) * a;
      const t = Date.now() - startRef.current;
      const p: Point = {
        t,
        v: {
          hr:    Math.max(45, Math.min(180, hr + j(alert ? 12 : 4))),
          spo2:  Math.max(88, Math.min(100, 97 + j(alert ? 3 : 1.2))),
          bp:    Math.max(90, Math.min(160, 120 + j(alert ? 12 : 5))),
          glu:   Math.max(0.7, Math.min(1.6, 0.95 + j(0.08))),
          urine: Math.max(0.3, Math.min(1.5, 0.9 + j(0.1))),
          creat: Math.max(6, Math.min(16, 9 + j(0.6))),
        },
      };
      historyRef.current.push(p);
      if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
      setTick((n) => n + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, paused, hr, alert]);

  const history = historyRef.current;
  const total = history.length;

  const windowSize = Math.max(20, Math.floor(total / zoom));
  const startIdx = Math.max(0, total - windowSize);
  const slice = history.slice(startIdx);

  const cursorIdx = cursor === null ? slice.length - 1 : Math.min(cursor, slice.length - 1);
  const cursorPoint = slice[cursorIdx];

  const W = 560;
  const H = 140;
  const stepX = slice.length > 1 ? W / (slice.length - 1) : W;

  const visibleSeries = SERIES.filter((s) => visible[s.key]);

  const paths = useMemo(() => {
    return visibleSeries.map((s) => {
      const range = s.max - s.min || 1;
      const pts = slice.map((p, i) => {
        const x = i * stepX;
        const y = H - ((p.v[s.key] - s.min) / range) * (H - 8) - 4;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
      return { s, pts };
    });
  }, [slice, visibleSeries, stepX]);

  // Map annotation time to x within current window
  const tMin = slice[0]?.t ?? 0;
  const tMax = slice[slice.length - 1]?.t ?? 0;
  const tSpan = Math.max(1, tMax - tMin);
  const annoInWindow = annotations
    .map((a) => ({ a, x: ((a.t - tMin) / tSpan) * W }))
    .filter(({ a }) => a.t >= tMin && a.t <= tMax);

  // Annotation near cursor
  const cursorT = cursorPoint?.t ?? 0;
  const nearAnno = annotations
    .filter((a) => Math.abs(a.t - cursorT) <= Math.max(intervalMs, tSpan / Math.max(20, slice.length)) * 1.5)
    .sort((a, b) => Math.abs(a.t - cursorT) - Math.abs(b.t - cursorT));

  const fmtClock = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const toggle = (k: SeriesKey) => setVisible((v) => ({ ...v, [k]: !v[k] }));
  const reset = () => {
    historyRef.current = [];
    startRef.current = Date.now();
    setCursor(null);
    setAnnotations([]);
    setTick((n) => n + 1);
  };

  const addAnnotation = (label?: string, kind?: AnnotationKind) => {
    const text = (label ?? annoDraft).trim();
    if (!text) return;
    const t = cursor !== null ? (slice[cursorIdx]?.t ?? Date.now() - startRef.current) : (Date.now() - startRef.current);
    const a: Annotation = {
      id: `${t}-${Math.random().toString(36).slice(2, 7)}`,
      t,
      label: text,
      kind: kind ?? annoKind,
    };
    setAnnotations((xs) => [...xs, a].sort((x, y) => x.t - y.t));
    setAnnoDraft("");
  };

  const removeAnnotation = (id: string) =>
    setAnnotations((xs) => xs.filter((a) => a.id !== id));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const startEdit = (a: Annotation) => { setEditingId(a.id); setEditDraft(a.label); };
  const commitEdit = () => {
    const text = editDraft.trim();
    if (!editingId || !text) { setEditingId(null); return; }
    setAnnotations((xs) => xs.map((a) => (a.id === editingId ? { ...a, label: text } : a)));
    setEditingId(null);
  };

  // Auto-mark the current pipeline step as a step-annotation whenever it changes.
  // Debounced + deduped: rapid step changes only produce one entry per step index,
  // and we never add a duplicate within 800ms.
  const lastStepRef = useRef<number | null>(null);
  const lastStepAtRef = useRef<number>(0);
  useEffect(() => {
    if (typeof stepIdx !== "number" || !stepTitles || !stepTitles[stepIdx]) return;
    if (lastStepRef.current === stepIdx) return;
    const now = Date.now();
    if (now - lastStepAtRef.current < 800) {
      lastStepRef.current = stepIdx;
      // just refresh the label of any existing annotation for this step index
      setAnnotations((xs) =>
        xs.map((x) =>
          x.stepIndex === stepIdx ? { ...x, label: `${stepIdx + 1}. ${stepTitles[stepIdx]}` } : x,
        ),
      );
      return;
    }
    lastStepRef.current = stepIdx;
    lastStepAtRef.current = now;
    const t = now - startRef.current;
    setAnnotations((xs) => {
      // if a step annotation for this index already exists, keep it (update label + time)
      const existing = xs.find((x) => x.stepIndex === stepIdx);
      if (existing) {
        return xs.map((x) =>
          x.stepIndex === stepIdx ? { ...x, label: `${stepIdx + 1}. ${stepTitles[stepIdx]}` } : x,
        );
      }
      const a: Annotation = {
        id: `step-${stepIdx}-${t}`,
        t,
        label: `${stepIdx + 1}. ${stepTitles[stepIdx]}`,
        kind: "step",
        stepIndex: stepIdx,
      };
      return [...xs, a].sort((x, y) => x.t - y.t);
    });
  }, [stepIdx, stepTitles]);

  // Scrubbing the timeline drives the active step in the parent simulation.
  useEffect(() => {
    if (cursor === null || !onSelectStep) return;
    const stepAnnos = annotations.filter((a) => a.kind === "step" && typeof a.stepIndex === "number");
    if (stepAnnos.length === 0) return;
    // pick the latest step annotation whose time <= current cursor time
    const cT = slice[cursorIdx]?.t ?? 0;
    let target: Annotation | null = null;
    for (const a of stepAnnos) {
      if (a.t <= cT) target = a;
      else break;
    }
    if (target && typeof target.stepIndex === "number" && target.stepIndex !== stepIdx) {
      onSelectStep(target.stepIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, cursorIdx]);


  const jumpToAnnotation = (a: Annotation) => {
    // find nearest index in slice
    let best = 0;
    let bestDist = Infinity;
    slice.forEach((p, i) => {
      const d = Math.abs(p.t - a.t);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setCursor(best);
  };

  // ---- Import annotations (JSON / CSV), aligned to current cursor ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const parseCsv = (text: string): Annotation[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];
    const header = lines[0].toLowerCase().split(/[,;\t]/).map((s) => s.trim());
    const hasHeader = header.some((h) => ["t", "time", "label", "kind"].includes(h));
    const idxT = hasHeader ? header.findIndex((h) => h === "t" || h === "time") : 0;
    const idxLabel = hasHeader ? header.findIndex((h) => h === "label") : 1;
    const idxKind = hasHeader ? header.findIndex((h) => h === "kind") : 2;
    const rows = hasHeader ? lines.slice(1) : lines;
    const out: Annotation[] = [];
    rows.forEach((line, i) => {
      const cols = line.split(/[,;\t]/).map((s) => s.trim().replace(/^"|"$/g, ""));
      const rawT = cols[idxT] ?? String(i);
      // accept ms number or "mm:ss"
      let t: number;
      if (/^\d+:\d+$/.test(rawT)) {
        const [m, s] = rawT.split(":").map(Number);
        t = (m * 60 + s) * 1000;
      } else {
        t = Number(rawT);
      }
      if (!Number.isFinite(t)) return;
      const label = cols[idxLabel] ?? "";
      const kindRaw = (cols[idxKind] ?? "event").toLowerCase();
      const kind: AnnotationKind = kindRaw === "symptom" || kindRaw === "symptôme"
        ? "symptom"
        : kindRaw === "step" || kindRaw === "étape"
        ? "step"
        : "event";
      if (!label) return;
      out.push({ id: `imp-${t}-${Math.random().toString(36).slice(2, 6)}`, t, label, kind });
    });
    return out;
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      let parsed: Annotation[] = [];
      if (file.name.toLowerCase().endsWith(".json")) {
        const data = JSON.parse(text);
        const arr = Array.isArray(data) ? data : Array.isArray(data?.annotations) ? data.annotations : [];
        parsed = arr
          .map((r: any, i: number): Annotation | null => {
            const t = Number(r.t ?? r.time);
            if (!Number.isFinite(t) || !r.label) return null;
            const k = String(r.kind ?? "event").toLowerCase();
            const kind: AnnotationKind = k === "symptom" ? "symptom" : k === "step" ? "step" : "event";
            return { id: `imp-${t}-${i}-${Math.random().toString(36).slice(2, 5)}`, t, label: String(r.label), kind };
          })
          .filter((x: Annotation | null): x is Annotation => x !== null);
      } else {
        parsed = parseCsv(text);
      }
      if (parsed.length === 0) {
        setImportMsg("Aucune annotation valide trouvée.");
        return;
      }
      // Align: shift so the earliest imported timestamp lands on the current cursor
      const cursorT = cursorPoint?.t ?? (Date.now() - startRef.current);
      const minT = Math.min(...parsed.map((a) => a.t));
      const delta = cursorT - minT;
      const aligned = parsed.map((a) => ({ ...a, t: Math.max(0, a.t + delta) }));
      setAnnotations((xs) => [...xs, ...aligned].sort((x, y) => x.t - y.t));
      setImportMsg(`${aligned.length} annotation(s) importée(s), alignée(s) sur le curseur.`);
      setTimeout(() => setImportMsg(null), 3000);
    } catch (e) {
      setImportMsg("Erreur d'import : fichier invalide.");
      setTimeout(() => setImportMsg(null), 3000);
    }
  };

  // ---- Export history + annotations ----
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      startedAt: new Date(startRef.current).toISOString(),
      series: SERIES.map((s) => ({ key: s.key, label: s.label, unit: s.unit })),
      history: historyRef.current,
      annotations,
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      `timeline-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`,
    );
  };

  const exportPDF = () => {
    const rowsAnno = annotations.map((a) => `
      <tr>
        <td style="font-family:monospace">${fmtClock(a.t)}</td>
        <td>${KIND_META[a.kind].label}</td>
        <td>${a.label.replace(/</g, "&lt;")}</td>
      </tr>`).join("");
    const last = historyRef.current[historyRef.current.length - 1];
    const rowsSeries = SERIES.map((s) => `
      <tr>
        <td><span style="display:inline-block;width:10px;height:10px;background:${s.color};border-radius:50%"></span> ${s.label}</td>
        <td>${last ? last.v[s.key].toFixed(2) : "—"} ${s.unit}</td>
      </tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Timeline simulation</title>
      <style>
        body{font-family:-apple-system,Segoe UI,sans-serif;padding:24px;color:#111}
        h1{font-size:20px;margin:0 0 4px}
        .muted{color:#666;font-size:12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#f4f4f5}
        h2{font-size:14px;margin:16px 0 8px}
      </style></head><body>
      <h1>Rapport de simulation — Timeline</h1>
      <div class="muted">Exporté le ${new Date().toLocaleString()} · Début : ${new Date(startRef.current).toLocaleString()} · ${historyRef.current.length} points</div>
      <h2>Dernières valeurs</h2>
      <table><thead><tr><th>Série</th><th>Valeur</th></tr></thead><tbody>${rowsSeries}</tbody></table>
      <h2>Annotations (${annotations.length})</h2>
      <table><thead><tr><th>Temps</th><th>Type</th><th>Description</th></tr></thead>
      <tbody>${rowsAnno || '<tr><td colspan="3" style="text-align:center;color:#888">Aucune annotation</td></tr>'}</tbody></table>
      <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };



  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold flex items-center gap-1.5">
          <Activity className="w-3 h-3" /> Timeline · pipeline
        </p>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-slate-400 font-mono">
            {total} pts · {fmtClock(history[total - 1]?.t ?? 0)}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => fileInputRef.current?.click()} title="Importer annotations (JSON/CSV)">
            <Upload className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={exportJSON} title="Exporter JSON">
            <FileJson className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={exportPDF} title="Exporter PDF (impression)">
            <FileText className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowSettings((v) => !v)} title="Réglages">
            <Settings2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
      {importMsg && (
        <p className="text-[10px] text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded px-2 py-1">
          {importMsg}
        </p>
      )}


      {/* Chart */}
      <div className="relative rounded-lg bg-black/30 border border-white/5 p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" preserveAspectRatio="none">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          ))}
          {paths.map(({ s, pts }) => (
            <polyline key={s.key} points={pts} fill="none" stroke={s.color} strokeWidth={1.4} strokeLinejoin="round" />
          ))}
          {/* Annotation markers */}
          {annoInWindow.map(({ a, x }) => {
            const c = KIND_META[a.kind].color;
            return (
              <g key={a.id}>
                <line x1={x} x2={x} y1={6} y2={H} stroke={c} strokeWidth={1} strokeDasharray="3 2" opacity={0.7} />
                <circle cx={x} cy={6} r={3} fill={c} />
              </g>
            );
          })}
          {cursorPoint && (
            <line
              x1={cursorIdx * stepX} x2={cursorIdx * stepX}
              y1={0} y2={H}
              stroke="rgba(255,255,255,0.5)" strokeWidth={1} strokeDasharray="2 2"
            />
          )}
        </svg>
        {visibleSeries.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500">
            Sélectionne au moins une valeur ci-dessous
          </p>
        )}
      </div>

      {/* Scrubber */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="font-mono">{fmtClock(slice[0]?.t ?? 0)}</span>
          <Slider
            value={[cursor ?? slice.length - 1]}
            min={0}
            max={Math.max(0, slice.length - 1)}
            step={1}
            onValueChange={(v) => setCursor(v[0] ?? null)}
            className="flex-1"
          />
          <span className="font-mono">{fmtClock(slice[slice.length - 1]?.t ?? 0)}</span>
          {cursor !== null && (
            <button onClick={() => setCursor(null)} className="text-[9px] text-sky-400 hover:text-sky-300">live</button>
          )}
        </div>
        {cursorPoint && (
          <div className="flex flex-wrap gap-1.5">
            {visibleSeries.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                <span className="text-slate-400">{s.label}</span>
                <span className="font-mono font-semibold text-white">
                  {cursorPoint.v[s.key].toFixed(s.key === "glu" || s.key === "urine" ? 2 : 0)}
                </span>
                <span className="text-slate-500">{s.unit}</span>
              </span>
            ))}
          </div>
        )}
        {nearAnno.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {nearAnno.map((a) => {
              const { color, Icon, label } = KIND_META[a.kind];
              return (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] border"
                  style={{ borderColor: `${color}55`, background: `${color}15`, color }}
                >
                  <Icon className="w-2.5 h-2.5" />
                  <span className="font-semibold">{label}</span>
                  <span className="text-white/90">· {a.label}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setPaused((v) => !v)}>
          {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setZoom((z) => Math.min(20, z * 1.5))}>
          <ZoomIn className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setZoom((z) => Math.max(1, z / 1.5))}>
          <ZoomOut className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2" onClick={reset} title="Vider l'historique">
          <RotateCcw className="w-3 h-3" />
        </Button>
        <span className="ml-auto text-[9px] text-slate-500 font-mono">×{zoom.toFixed(1)}</span>
      </div>

      {/* Annotations */}
      <div className="space-y-2 pt-2 border-t border-white/5">
        <div className="flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1">
            <Flag className="w-3 h-3" /> Annotations
          </p>
          <span className="text-[9px] text-slate-500">
            {cursor !== null ? `@ ${fmtClock(cursorPoint?.t ?? 0)}` : "@ live"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {(Object.keys(KIND_META) as AnnotationKind[]).map((k) => {
            const { color, Icon, label } = KIND_META[k];
            const active = annoKind === k;
            return (
              <button
                key={k}
                onClick={() => setAnnoKind(k)}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] border transition-colors",
                  active ? "text-white" : "text-slate-400 hover:text-slate-200",
                )}
                style={active ? { borderColor: color, background: `${color}22` } : { borderColor: "rgba(255,255,255,0.08)" }}
              >
                <Icon className="w-3 h-3" style={{ color }} />
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <Input
            value={annoDraft}
            onChange={(e) => setAnnoDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addAnnotation(); }}
            placeholder="Décrire l'événement, le symptôme…"
            className="h-7 text-[11px] bg-black/30 border-white/10"
          />
          <Button size="sm" className="h-7 px-2" onClick={() => addAnnotation()} disabled={!annoDraft.trim()}>
            <Plus className="w-3 h-3" />
          </Button>
          {currentStepTitle && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[10px]"
              onClick={() => addAnnotation(currentStepTitle, "step")}
              title="Marquer l'étape courante"
            >
              <Stethoscope className="w-3 h-3" />
            </Button>
          )}
        </div>

        {annotations.length > 0 && (
          <ul className="max-h-28 overflow-y-auto space-y-1 pr-1">
            {annotations.map((a) => {
              const { color, Icon, label } = KIND_META[a.kind];
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-1.5 rounded bg-white/[0.03] border border-white/5 px-1.5 py-1 text-[10px]"
                >
                  <Icon className="w-3 h-3 shrink-0" style={{ color }} />
                  <button
                    onClick={() => jumpToAnnotation(a)}
                    className="font-mono text-slate-400 hover:text-white shrink-0"
                    title="Aller à ce point"
                  >
                    {fmtClock(a.t)}
                  </button>
                  <span className="text-slate-500 shrink-0">· {label}</span>
                  {editingId === a.id ? (
                    <Input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={commitEdit}
                      className="h-6 flex-1 text-[10px] bg-black/40 border-white/10 px-1.5 py-0"
                    />
                  ) : (
                    <span
                      className="flex-1 truncate text-slate-200 cursor-text"
                      onDoubleClick={() => startEdit(a)}
                      title="Double-cliquer pour modifier"
                    >
                      {a.label}
                    </span>
                  )}
                  {editingId === a.id ? (
                    <button
                      onClick={commitEdit}
                      className="text-emerald-400 hover:text-emerald-300 shrink-0"
                      title="Valider"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      onClick={() => startEdit(a)}
                      className="text-slate-500 hover:text-sky-300 shrink-0"
                      title="Modifier"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => removeAnnotation(a.id)}
                    className="text-slate-500 hover:text-rose-400 shrink-0"
                    title="Supprimer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Series toggles + interval */}
      <div className="space-y-2 pt-2 border-t border-white/5">
        <p className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">Valeurs affichées</p>
        <div className="grid grid-cols-2 gap-1">
          {SERIES.map((s) => (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-[10px] border transition-colors text-left",
                visible[s.key]
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-transparent border-white/5 text-slate-500 hover:text-slate-300",
              )}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="flex-1 truncate">{s.label}</span>
              <span className="text-slate-500">{s.unit}</span>
            </button>
          ))}
        </div>

        {showSettings && (
          <div className="space-y-1 pt-2">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-400">Fréquence de mise à jour</span>
              <span className="font-mono font-semibold text-white">
                {intervalMs < 1000 ? `${intervalMs}ms` : `${(intervalMs / 1000).toFixed(1)}s`}
              </span>
            </div>
            <Slider
              value={[intervalMs]}
              min={250} max={5000} step={250}
              onValueChange={(v) => setIntervalMs(v[0] ?? 1000)}
            />
            <p className="text-[9px] text-slate-500">
              250 ms (haute résolution) → 5 s (économie CPU). Historique max {MAX_HISTORY} points.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
