import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AnatomyViewer } from "@/components/ar/AnatomyViewer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  runARSwapTest, saveARTestRun, getARTestHistory, clearARTestHistory,
  type ARTestReport,
} from "@/lib/ar-test";
import type { ViewerMode } from "@/components/ar/types";
import {
  ArrowLeft, PlayCircle, CheckCircle2, XCircle, Trash2, Download,
  Activity, Gauge, AlertTriangle,
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

  useEffect(() => {
    const h = getARTestHistory();
    setHistory(h);
    setSelected(h[0] ?? null);
  }, []);

  const runTest = async () => {
    setRunning(true);
    try {
      const r = await runARSwapTest(setMode);
      const next = saveARTestRun(r);
      setHistory(next);
      setSelected(r);
      toast.success(r.passed ? "Test AR réussi" : "Test AR échoué");
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

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), runs: history }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ar-test-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const passRate = history.length
    ? Math.round((history.filter((r) => r.passed).length / history.length) * 100)
    : 0;

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
                Validation automatisée de la bascule sans refactor + métriques de rendu (FPS, frame drops).
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1 text-xs">
            Mode actuel : <strong className="ml-1">{mode}</strong>
          </Badge>
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
                <Badge variant={selected.passed ? "secondary" : "outline"} className={`gap-1 text-[10px] ${selected.passed ? "text-teal" : "text-destructive"}`}>
                  {selected.passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {selected.passed ? "PASS" : "FAIL"}
                </Badge>
              )}
            </div>
            {selected ? (
              <ReportDetails report={selected} />
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">Aucun test exécuté pour le moment.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-display font-semibold text-sm">
              Historique ({history.length}) — taux de réussite : <span className="text-teal">{passRate}%</span>
            </h2>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" disabled={history.length === 0} onClick={exportJson}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export JSON
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

function ReportDetails({ report }: { report: ARTestReport }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 text-center">
        <Metric label="Durée" value={`${Math.round(report.metrics.swapDurationMs)}ms`} />
        <Metric label="FPS moy." value={`${report.metrics.averageFps}`} tone={report.metrics.averageFps >= 45 ? "good" : report.metrics.averageFps >= 25 ? "warn" : "bad"} />
        <Metric label="FPS min." value={`${report.metrics.minFps}`} />
        <Metric label="Frame drops" value={`${report.metrics.frameDrops}`} tone={report.metrics.frameDrops === 0 ? "good" : "warn"} />
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

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-teal" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg bg-muted/40 border border-border px-2 py-1.5">
      <div className={`font-mono font-bold text-base ${color}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
