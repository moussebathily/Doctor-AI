import { useEffect, useState, useSyncExternalStore } from "react";
import { Activity, Gauge, Wrench, Zap } from "lucide-react";
import { subscribe as subscribeDiag, getDiagnostics } from "@/lib/glb-diagnostics";

/**
 * Live telemetry ribbon rendered on top of the 3D viewport.
 * - Pulsing HR synced to a realistic 72 bpm baseline
 * - Current step / tool
 * - Live FPS from the diagnostics store
 * - Sync halo pulse
 */
export function RealtimeOverlay({
  stepIndex,
  stepTitle,
  totalSteps,
  activeTool,
  hr = 72,
}: {
  stepIndex: number;
  stepTitle: string;
  totalSteps: number;
  activeTool: string;
  hr?: number;
}) {
  const diag = useSyncExternalStore(subscribeDiag, getDiagnostics, getDiagnostics);
  const fps = diag.fps;
  const [beat, setBeat] = useState(false);
  useEffect(() => {
    const interval = 60000 / Math.max(30, hr);
    const t = setInterval(() => {
      setBeat(true);
      setTimeout(() => setBeat(false), 120);
    }, interval);
    return () => clearInterval(t);
  }, [hr]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3">
      <div className="mx-auto max-w-[720px] rounded-xl border border-white/10 bg-[oklch(0.14_0.035_252/0.72)] backdrop-blur-md px-3 py-2 flex items-center gap-3 text-[11px] text-slate-200 shadow-[0_10px_30px_-12px_oklch(0.05_0.02_260/0.8)]">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-70 ${beat ? "animate-ping" : ""}`} />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          <span className="font-mono font-semibold text-rose-300">{hr}</span>
          <span className="text-[9px] uppercase tracking-widest text-slate-500">bpm</span>
        </span>

        <span className="h-3 w-px bg-white/10" />

        <span className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-sky-400" />
          <span className="font-mono text-sky-200">{stepIndex + 1}/{totalSteps}</span>
          <span className="truncate max-w-[180px] text-slate-300">{stepTitle}</span>
        </span>

        <span className="h-3 w-px bg-white/10" />

        <span className="flex items-center gap-1.5">
          <Wrench className="w-3 h-3 text-emerald-400" />
          <span className="capitalize text-emerald-200">{activeTool}</span>
        </span>

        <span className="ml-auto flex items-center gap-1.5">
          <Gauge className="w-3 h-3 text-amber-400" />
          <span className="font-mono text-amber-200">{fps}</span>
          <span className="text-[9px] uppercase tracking-widest text-slate-500">fps</span>
        </span>

        <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-emerald-300">
          <Zap className="w-3 h-3" /> live
        </span>
      </div>
    </div>
  );
}
