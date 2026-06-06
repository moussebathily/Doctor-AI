import { useSyncExternalStore, useEffect, useState } from "react";
import {
  subscribe, getDiagnostics, fmtBytes, fmtMs,
} from "@/lib/glb-diagnostics";
import { clearGLBCache, isCached } from "@/lib/glb-cache";
import { getLodSettings, setLodSettings, subscribeLod, resetLodSettings, LOD_DEFAULTS } from "@/lib/lod-settings";
import { getRetryPolicy, setRetryPolicy, subscribeRetry, RETRY_DEFAULTS } from "@/lib/glb-retry-policy";
import { runARSwapTest, saveARTestRun, type ARTestReport } from "@/lib/ar-test";
import type { ViewerMode } from "@/components/ar/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Activity, Cpu, Database, Gauge, HardDrive, Smartphone, Tablet, Monitor, Wifi, WifiOff, Trash2, CheckCircle2, Download, PlayCircle, Sliders, AlertTriangle, RefreshCw, XCircle, FolderOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function DiagnosticsPanel({
  activeGlbUrl,
  onSetViewerMode,
}: {
  activeGlbUrl?: string | null;
  onSetViewerMode?: (m: ViewerMode) => void;
}) {
  const d = useSyncExternalStore(subscribe, getDiagnostics, getDiagnostics);
  const lod = useSyncExternalStore(subscribeLod, getLodSettings, getLodSettings);
  const retry = useSyncExternalStore(subscribeRetry, getRetryPolicy, getRetryPolicy);
  const [cached, setCached] = useState<boolean | null>(null);
  const [arReport, setArReport] = useState<ARTestReport | null>(null);
  const [arRunning, setArRunning] = useState(false);

  useEffect(() => {
    if (!activeGlbUrl) { setCached(null); return; }
    isCached(activeGlbUrl).then(setCached);
  }, [activeGlbUrl, d.loads.length]);

  const totalBytes = d.loads.reduce((s, l) => s + l.bytes, 0);
  const lastLoad = d.loads[0];
  const cacheHits = d.loads.filter((l) => l.cacheHit).length;
  const hitRate = d.loads.length ? Math.round((cacheHits / d.loads.length) * 100) : 0;

  const DeviceIcon = d.deviceClass === "mobile" ? Smartphone : d.deviceClass === "tablet" ? Tablet : Monitor;

  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      device: {
        class: d.deviceClass,
        viewport: d.viewport,
        dpr: d.dpr,
        hardwareConcurrency: d.hardwareConcurrency,
        deviceMemoryGb: d.deviceMemoryGb,
        online: d.online,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "n/a",
      },
      lod,
      runtime: { fps: d.fps, frames: d.frames },
      session: {
        totalBytesDownloaded: totalBytes,
        cacheHitRate: hitRate,
        loads: d.loads,
        errors: d.errors,
      },
      arTest: arReport,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doctorai-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runArTest = async () => {
    if (!onSetViewerMode) return;
    setArRunning(true);
    try {
      const report = await runARSwapTest(onSetViewerMode);
      setArReport(report);
      saveARTestRun(report);
    } finally {
      setArRunning(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
          <Activity className="w-3 h-3" /> Diagnostics
        </p>
        <Badge variant={d.online ? "secondary" : "outline"} className="text-[9px] gap-1">
          {d.online ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
          {d.online ? "En ligne" : "Offline"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Stat icon={DeviceIcon} label="Appareil" value={`${d.deviceClass} · ${d.viewport.w}×${d.viewport.h}`} />
        <Stat icon={Cpu} label="Cœurs / RAM" value={`${d.hardwareConcurrency}c · ${d.deviceMemoryGb ? d.deviceMemoryGb + " GB" : "—"}`} />
        <Stat icon={Gauge} label="FPS" value={`${d.fps}`} tone={d.fps >= 45 ? "good" : d.fps >= 25 ? "warn" : "bad"} />
        <Stat icon={Monitor} label="DPR" value={String(d.dpr)} />
        <Stat icon={HardDrive} label="Téléchargé (session)" value={fmtBytes(totalBytes)} />
        <Stat icon={Database} label="Cache offline" value={cached === null ? "—" : cached ? "✓ disponible" : "vide"} tone={cached ? "good" : undefined} />
      </div>

      {lastLoad && (
        <div className="rounded-lg bg-muted/40 border border-border p-2 text-[11px] space-y-1">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Dernier chargement GLB</p>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono truncate flex-1" title={lastLoad.url}>{lastLoad.url.split("/").pop()}</span>
            {lastLoad.cacheHit && (
              <Badge variant="secondary" className="text-[9px] gap-0.5">
                <CheckCircle2 className="w-2.5 h-2.5" /> cache
              </Badge>
            )}
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Taille : <strong className="text-foreground">{fmtBytes(lastLoad.bytes)}</strong></span>
            <span>Temps : <strong className="text-foreground">{fmtMs(lastLoad.elapsedMs)}</strong></span>
          </div>
          <div className="text-muted-foreground">Taux cache : <strong className="text-foreground">{hitRate}%</strong> ({cacheHits}/{d.loads.length})</div>
        </div>
      )}

      {/* ── LOD settings ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1">
            <Sliders className="w-2.5 h-2.5" /> Paliers LOD ({d.deviceClass})
          </p>
          <button
            type="button"
            onClick={resetLodSettings}
            className="text-[9px] text-muted-foreground hover:text-foreground"
            title="Réinitialiser"
          >
            reset
          </button>
        </div>

        <LodSlider
          label="Délai upgrade HQ"
          value={lod.upgradeDelayMs}
          min={0}
          max={3000}
          step={100}
          unit="ms"
          onChange={(v) => setLodSettings({ upgradeDelayMs: v })}
        />
        <LodSlider
          label="DPR max (basse qualité)"
          value={Math.round(lod.lowDprMax * 100) / 100}
          min={0.5}
          max={2}
          step={0.25}
          unit="x"
          onChange={(v) => setLodSettings({ lowDprMax: v })}
        />
        <LodSlider
          label="DPR max (haute qualité)"
          value={Math.round(lod.highDprMax * 100) / 100}
          min={1}
          max={3}
          step={0.25}
          unit="x"
          onChange={(v) => setLodSettings({ highDprMax: v })}
        />

        <label className="flex items-center justify-between gap-2 text-[11px] cursor-pointer">
          <span>Activer la phase HQ</span>
          <input
            type="checkbox"
            checked={lod.highQualityEnabled}
            onChange={(e) => setLodSettings({ highQualityEnabled: e.target.checked })}
            className="accent-teal"
          />
        </label>

        <p className="text-[9px] text-muted-foreground">
          Suggéré : mobile {LOD_DEFAULTS.upgradeDelayMs}ms / DPR ≤ 1.5 · tablette 500ms / DPR ≤ 2.
        </p>
      </div>

      {/* ── AR auto-test ──────────────────────────────────────────── */}
      {onSetViewerMode && (
        <div className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Test AR auto</p>
            {arReport && (
              <Badge
                variant={arReport.passed ? "secondary" : "outline"}
                className={`text-[9px] gap-0.5 ${arReport.passed ? "text-teal" : "text-destructive"}`}
              >
                {arReport.passed ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                {arReport.passed ? "PASS" : "FAIL"}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-[11px]"
            disabled={arRunning}
            onClick={runArTest}
          >
            <PlayCircle className="w-3 h-3 mr-1.5" />
            {arRunning ? "Test en cours…" : "Lancer bascule Web → AR → Web"}
          </Button>
          {arReport && (
            <>
              <div className="grid grid-cols-4 gap-1 text-[9px] text-center">
                <MiniMetric label="durée" value={`${Math.round(arReport.metrics.swapDurationMs)}ms`} />
                <MiniMetric label="FPS moy" value={`${arReport.metrics.averageFps}`} tone={arReport.metrics.averageFps >= 45 ? "good" : arReport.metrics.averageFps >= 25 ? "warn" : "bad"} />
                <MiniMetric label="FPS min" value={`${arReport.metrics.minFps}`} />
                <MiniMetric label="drops" value={`${arReport.metrics.frameDrops}`} tone={arReport.metrics.frameDrops === 0 ? "good" : "warn"} />
              </div>
              <ul className="space-y-0.5 text-[10px]">
                {arReport.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    {s.ok
                      ? <CheckCircle2 className="w-2.5 h-2.5 text-teal mt-0.5 shrink-0" />
                      : <XCircle className="w-2.5 h-2.5 text-destructive mt-0.5 shrink-0" />}
                    <span className="flex-1">
                      <span className="font-medium">{s.name}</span>{" "}
                      <span className="text-muted-foreground">— {s.detail} ({Math.round(s.ms)}ms)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Button asChild variant="ghost" size="sm" className="w-full h-6 text-[10px]">
            <Link to="/ar-test">
              <PlayCircle className="w-3 h-3 mr-1.5" /> Historique complet des tests AR
            </Link>
          </Button>
        </div>
      )}

      {/* ── Errors log ────────────────────────────────────────────── */}
      {d.errors.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2 space-y-1 text-[10px]">
          <p className="text-[9px] uppercase tracking-widest text-destructive font-semibold flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" /> Erreurs téléchargement ({d.errors.length})
          </p>
          {d.errors.slice(0, 3).map((e, i) => (
            <div key={i} className="font-mono truncate" title={`${e.url} — ${e.message}`}>
              #{e.attempt} {e.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <Button
          variant="outline" size="sm" className="h-7 text-[11px]"
          onClick={async () => { await clearGLBCache(); setCached(false); }}
        >
          <Trash2 className="w-3 h-3 mr-1.5" /> Cache
        </Button>
        <Button
          variant="outline" size="sm" className="h-7 text-[11px]"
          onClick={exportReport}
        >
          <Download className="w-3 h-3 mr-1.5" /> Export JSON
        </Button>
      </div>

      <Button asChild variant="ghost" size="sm" className="w-full h-7 text-[11px]">
        <Link to="/cache">
          <FolderOpen className="w-3 h-3 mr-1.5" /> Gérer le cache hors-ligne
        </Link>
      </Button>
    </div>
  );
}

function Stat({
  icon: Icon, label, value, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  const color = tone === "good" ? "text-teal" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg bg-muted/30 border border-border px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
        <Icon className="w-2.5 h-2.5" /> {label}
      </div>
      <div className={`font-mono text-[11px] font-semibold ${color} truncate`}>{value}</div>
    </div>
  );
}

function LodSlider({
  label, value, min, max, step, unit, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">{value}{unit}</span>
      </div>
      <Slider
        value={[value]}
        min={min} max={max} step={step}
        onValueChange={(v) => onChange(v[0] ?? value)}
      />
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-teal" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-md bg-background/50 border border-border px-1 py-1">
      <div className={`font-mono font-semibold text-[10px] ${color}`}>{value}</div>
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

// Silence unused-import warning when RefreshCw is reserved for future cache row UI.
void RefreshCw;
