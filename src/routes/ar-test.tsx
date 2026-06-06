import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AnatomyViewer } from "@/components/ar/AnatomyViewer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  runARSwapTest, saveARTestRun, getARTestHistory, clearARTestHistory,
  groupByDevice, exportHistoryCsv,
  type ARTestReport,
} from "@/lib/ar-test";
import {
  AR_THRESHOLD_DEFAULTS, getARThresholds, setARThresholds, evaluateReport,
  type ARThresholds,
} from "@/lib/ar-thresholds";
import { getDeviceProfile } from "@/lib/device-profile";
import type { ViewerMode } from "@/components/ar/types";
import {
  ArrowLeft, PlayCircle, CheckCircle2, XCircle, Trash2, Download,
  Activity, Gauge, AlertTriangle, FileSpreadsheet, Sliders, Smartphone,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ar-test")({
  head: () => ({
    meta: [
      { title: "Tests AR — Doctor AI" },
      { name: "description", content: "Historique et exécution des tests automatisés de bascule Web → AR → Web." },
    ],
  }),
  component: ARTestPage,
});

function ARTestPage() {
  const [mode, setMode] = useState<ViewerMode>("web");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<ARTestReport[]>([]);
  const [selected, setSelected] = useState<ARTestReport | null>(null);
  const [thresholds, setThresholdsState] = useState<ARThresholds>(AR_THRESHOLD_DEFAULTS);
  const [device, setDevice] = useState<ReturnType<typeof getDeviceProfile> | null>(null);

  useEffect(() => {
    const h = getARTestHistory();
    setHistory(h);
    setSelected(h[0] ?? null);
    setThresholdsState(getARThresholds());
    setDevice(getDeviceProfile());
  }, []);

  const runTest = async () => {
    setRunning(true);
    try {
      const r = await runARSwapTest(setMode);
      const next = saveARTestRun(r);
      setHistory(next);
      setSelected(r);
      toast.success(r.passed ? "Test AR PASS" : "Test AR FAIL");
    } finally {
      setRunning(false);
    }
  };

  const clearAll = () => {
    if (!confirm("Effacer tout l'historique des tests AR ?")) return;
    clearARTestHistory();
    setHistory([]);
    setSelected(null);
  };

  const download = (content: string, mime: string, ext: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ar-test-history-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => download(
    JSON.stringify({ exportedAt: new Date().toISOString(), thresholds, runs: history }, null, 2),
    "application/json", "json",
  );
  const exportCsv = () => download(exportHistoryCsv(history), "text/csv", "csv");

  const passRate = history.length
    ? Math.round((history.filter((r) => r.passed).length / history.length) * 100)
    : 0;

  const groups = useMemo(() => groupByDevice(history), [history]);

  const updateThreshold = (key: keyof ARThresholds, value: number) => {
    const next = setARThresholds({ [key]: value });
    setThresholdsState(next);
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/simulation"><ArrowLeft className="w-4 h-4 mr-1" /> Retour</Link>
            </Button>
            <div>
              <h1 className="font-display font-bold text-2xl md:text-3xl flex items-center gap-2">
                <Activity className="w-6 h-6 text-teal" /> Tests AR — Web ↔ AR
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Validation automatisée avec seuils explicites et tendances par appareil.
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {device && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Smartphone className="w-3 h-3" /> {device.model} · {device.class}
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1 text-xs">
              Mode : <strong className="ml-1">{mode}</strong>
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-sm">Visualisation</h2>
              <Badge variant="outline" className="text-[10px]">{mode === "ar" ? "Adapter ViroAR" : "WebGL"}</Badge>
            </div>
            <AnatomyViewer mode={mode} system="full" view="complete" height="h-[280px]" />
            <Button onClick={runTest} disabled={running} className="w-full">
              <PlayCircle className="w-4 h-4 mr-1.5" />
              {running ? "Test en cours…" : "Lancer Web → AR → Web"}
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-sm flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-teal" /> Dernier résultat
              </h2>
              {selected && (
                <VerdictBadge passed={selected.passed} />
              )}
            </div>
            {selected ? (
              <ReportDetails report={selected} thresholds={thresholds} />
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">Aucun test exécuté pour le moment.</p>
            )}
          </div>
        </div>

        <ThresholdsCard thresholds={thresholds} onChange={updateThreshold} />

        {groups.length > 0 && <DeviceTrendsCard groups={groups} />}

        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-display font-semibold text-sm">
              Historique ({history.length}) — taux PASS : <span className="text-teal">{passRate}%</span>
            </h2>
            <div className="flex gap-1.5 flex-wrap">
              <Button variant="outline" size="sm" disabled={history.length === 0} onClick={exportJson}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> JSON
              </Button>
              <Button variant="outline" size="sm" disabled={history.length === 0} onClick={exportCsv}>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" disabled={history.length === 0} onClick={clearAll}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Effacer
              </Button>
            </div>
          </div>
          {history.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Aucun test enregistré. Lance ta première bascule ci-dessus.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((r, i) => {
                const isActive = selected?.startedAt === r.startedAt;
                return (
                  <li key={r.startedAt}>
                    <button
                      type="button"
                      onClick={() => setSelected(r)}
                      className={`w-full text-left px-4 py-2.5 hover:bg-muted/40 transition flex items-center gap-3 flex-wrap ${isActive ? "bg-muted/30" : ""}`}
                    >
                      <span className="text-[10px] font-mono text-muted-foreground w-8">#{history.length - i}</span>
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-teal shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      <span className="text-sm font-medium flex-1 min-w-0 truncate">
                        {new Date(r.startedAt).toLocaleString()}
                      </span>
                      {r.device && (
                        <Badge variant="outline" className="text-[10px]">
                          {r.device.model}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {Math.round(r.totalMs)}ms
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {r.metrics.averageFps} fps
                      </Badge>
                      {r.metrics.frameDrops > 0 && (
                        <Badge variant="outline" className="text-[10px] font-mono text-warning">
                          {r.metrics.frameDrops} drops
                        </Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function VerdictBadge({ passed }: { passed: boolean }) {
  return (
    <Badge
      variant={passed ? "secondary" : "outline"}
      className={`gap-1 text-[10px] font-bold uppercase tracking-wider ${passed ? "text-teal border-teal/40" : "text-destructive border-destructive/40"}`}
    >
      {passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {passed ? "PASS" : "FAIL"}
    </Badge>
  );
}

function ReportDetails({ report, thresholds }: { report: ARTestReport; thresholds: ARThresholds }) {
  const verdict = evaluateReport(report, report.thresholds ?? thresholds);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 text-center">
        <Metric label="Durée" value={`${Math.round(report.metrics.swapDurationMs)}ms`} tone={verdict.checks[3].ok ? "good" : "bad"} />
        <Metric label="FPS moy." value={`${report.metrics.averageFps}`} tone={verdict.checks[0].ok ? "good" : "bad"} />
        <Metric label="FPS min." value={`${report.metrics.minFps}`} tone={verdict.checks[1].ok ? "good" : "bad"} />
        <Metric label="Frame drops" value={`${report.metrics.frameDrops}`} tone={verdict.checks[2].ok ? "good" : "bad"} />
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-2 space-y-1">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Seuils pass/fail</p>
        {verdict.checks.map((c) => (
          <div key={c.key} className="flex items-center gap-2 text-[11px]">
            {c.ok
              ? <CheckCircle2 className="w-3 h-3 text-teal shrink-0" />
              : <XCircle className="w-3 h-3 text-destructive shrink-0" />}
            <span className="flex-1">{c.label}</span>
            <span className="font-mono text-muted-foreground">{c.actual} <span className="opacity-60">({c.expected})</span></span>
          </div>
        ))}
      </div>
      <ul className="space-y-1 text-xs">
        {report.steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2">
            {s.ok
              ? <CheckCircle2 className="w-3.5 h-3.5 text-teal mt-0.5 shrink-0" />
              : <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />}
            <span className="flex-1">
              <span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground"> — {s.detail} ({Math.round(s.ms)}ms)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThresholdsCard({
  thresholds, onChange,
}: { thresholds: ARThresholds; onChange: (k: keyof ARThresholds, v: number) => void }) {
  const fields: Array<{ key: keyof ARThresholds; label: string; unit: string; step: number }> = [
    { key: "minAverageFps", label: "FPS moyen min.", unit: "fps", step: 1 },
    { key: "minLowestFps", label: "FPS minimum min.", unit: "fps", step: 1 },
    { key: "maxFrameDrops", label: "Frame drops max.", unit: "", step: 1 },
    { key: "maxSwapDurationMs", label: "Durée swap max.", unit: "ms", step: 100 },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sliders className="w-4 h-4 text-teal" />
        <h2 className="font-display font-semibold text-sm">Seuils PASS/FAIL configurables</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={f.key} className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {f.label}
            </Label>
            <div className="flex items-center gap-1">
              <Input
                id={f.key}
                type="number"
                min={0}
                step={f.step}
                value={thresholds[f.key]}
                onChange={(e) => onChange(f.key, Number(e.target.value) || 0)}
                className="h-8 text-sm font-mono"
              />
              {f.unit && <span className="text-[10px] text-muted-foreground">{f.unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeviceTrendsCard({ groups }: { groups: ReturnType<typeof groupByDevice> }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-display font-semibold text-sm flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-teal" /> Tendances par appareil ({groups.length})
        </h2>
      </div>
      <ul className="divide-y divide-border">
        {groups.map(({ device, runs }) => {
          const passes = runs.filter((r) => r.passed).length;
          const passRate = Math.round((passes / runs.length) * 100);
          const avgFps = Math.round(runs.reduce((s, r) => s + r.metrics.averageFps, 0) / runs.length);
          const avgDrops = Math.round(runs.reduce((s, r) => s + r.metrics.frameDrops, 0) / runs.length);
          const avgSwap = Math.round(runs.reduce((s, r) => s + r.metrics.swapDurationMs, 0) / runs.length);
          // Trend: compare first half avg fps to second half (reverse chronological).
          const half = Math.max(1, Math.floor(runs.length / 2));
          const recent = runs.slice(0, half).reduce((s, r) => s + r.metrics.averageFps, 0) / half;
          const older = runs.slice(half).length
            ? runs.slice(half).reduce((s, r) => s + r.metrics.averageFps, 0) / runs.slice(half).length
            : recent;
          const delta = Math.round(recent - older);
          return (
            <li key={device.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{device.model}</span>
                <Badge variant="outline" className="text-[10px]">{device.class}</Badge>
                <Badge variant="outline" className="text-[10px]">{device.browser} · {device.os}</Badge>
                <span className="text-[10px] text-muted-foreground ml-auto">{runs.length} run{runs.length > 1 ? "s" : ""}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <Metric label="PASS" value={`${passRate}%`} tone={passRate >= 80 ? "good" : passRate >= 50 ? "warn" : "bad"} />
                <Metric label="FPS moy." value={`${avgFps}`} />
                <Metric label="Drops moy." value={`${avgDrops}`} tone={avgDrops === 0 ? "good" : "warn"} />
                <Metric label="Tendance FPS" value={`${delta > 0 ? "+" : ""}${delta}`} tone={delta >= 0 ? "good" : "bad"} />
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                Swap moy. {avgSwap}ms · DPR {device.dpr} · {device.cores} cores · {device.memoryGb ?? "?"} GB RAM
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-teal" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg bg-muted/40 border border-border px-2 py-1.5">
      <div className={`font-mono font-bold text-base ${color}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
