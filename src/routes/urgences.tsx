import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, Plus, RefreshCw, Trash2, Timer, Activity } from "lucide-react";
import { statusLabel, TURN_SECONDS, type CardiacSession } from "@/lib/cardiac-game";
import {
  aiManageCardiacSession,
  aiTriageReport,
  createCardiacSession,
  deleteCardiacSession,
  listCardiacSessions,
} from "@/lib/cardiac.functions";

export const Route = createFileRoute("/urgences")({
  head: () => ({
    meta: [
      { title: "Salle de gestion des urgences — Doctor AI" },
      {
        name: "description",
        content:
          "Tableau de bord des patients en arrêt cardiaque : état vital, temps restant, triage et actions pilotées par l'IA.",
      },
      { property: "og:title", content: "Salle de gestion des urgences — Doctor AI" },
      {
        property: "og:description",
        content: "Suivez tous vos patients simulés, leur état et leur temps restant, avec un triage IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmergencyRoomPage,
});

function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return m || "Connectez-vous pour gérer vos patients.";
}

function statusClass(s: CardiacSession["status"]) {
  return s === "active"
    ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
    : s === "won"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
      : "bg-destructive/15 text-destructive border-destructive/40";
}

function EmergencyRoomPage() {
  const list = useServerFn(listCardiacSessions);
  const create = useServerFn(createCardiacSession);
  const remove = useServerFn(deleteCardiacSession);
  const aiPlay = useServerFn(aiManageCardiacSession);
  const triage = useServerFn(aiTriageReport);

  const [sessions, setSessions] = useState<CardiacSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await list();
      if (!Array.isArray(rows)) throw new Error("Connectez-vous pour gérer vos patients.");
      setSessions(rows);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), TURN_SECONDS * 1000);
    return () => clearInterval(id);
  }, [refresh]);

  // Décompte visuel entre deux synchronisations serveur.
  useEffect(() => {
    const id = setInterval(() => {
      setSessions((rows) =>
        rows.map((s) => (s.status === "active" ? { ...s, time_remaining: Math.max(0, s.time_remaining - 1) } : s)),
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleAI = async (id: string) => {
    setBusyId(id);
    try {
      const res = await aiPlay({ data: { id } });
      setSessions((rows) => rows.map((s) => (s.id === id ? res.session : s)));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyId(null);
    }
  };

  const active = sessions.filter((s) => s.status === "active").length;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Salle de gestion des urgences</h1>
            <p className="text-sm text-muted-foreground">
              {active} patient(s) en cours — état vital et temps restant mis à jour en temps réel.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw className="w-4 h-4 mr-1.5" /> Actualiser
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                setBusyId("new");
                try {
                  await create();
                  await refresh();
                } finally {
                  setBusyId(null);
                }
              }}
              disabled={busyId === "new"}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Admettre un patient
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={reporting || active === 0}
              onClick={async () => {
                setReporting(true);
                try {
                  const res = await triage();
                  setReport(res.report);
                } catch (e) {
                  setError(errMsg(e));
                } finally {
                  setReporting(false);
                }
              }}
            >
              {reporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Bot className="w-4 h-4 mr-1.5" />}
              Triage IA
            </Button>
          </div>
        </header>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {report && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
              <Bot className="w-4 h-4" /> Régulation IA
            </h2>
            <p className="text-sm whitespace-pre-wrap">{report}</p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">Patient</th>
                <th className="text-left p-3">Scénario</th>
                <th className="text-left p-3">Rythme</th>
                <th className="text-left p-3">État vital</th>
                <th className="text-left p-3">Temps restant</th>
                <th className="text-left p-3">Chocs</th>
                <th className="text-left p-3">Statut</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Chargement…
                  </td>
                </tr>
              )}
              {!loading && sessions.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    Aucun patient. Cliquez sur « Admettre un patient ».
                  </td>
                </tr>
              )}
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3 font-medium">
                    {s.patient_name}
                    <span className="block text-xs text-muted-foreground">{s.patient_age} ans</span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground max-w-[220px]">{s.scenario}</td>
                  <td className="p-3">
                    <span
                      className={`font-mono text-xs ${
                        s.rhythm === "VFIB" ? "text-destructive" : s.rhythm === "NORMAL" ? "text-emerald-400" : "text-muted-foreground"
                      }`}
                    >
                      {s.rhythm}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${s.health > 50 ? "bg-emerald-500" : s.health > 20 ? "bg-amber-500" : "bg-destructive"}`}
                          style={{ width: `${s.health}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums">{s.health}%</span>
                    </div>
                  </td>
                  <td className="p-3 font-mono tabular-nums">
                    <span className={s.status === "active" && s.time_remaining < 20 ? "text-destructive" : ""}>
                      <Timer className="w-3.5 h-3.5 inline mr-1" />
                      {s.status === "active" ? `${s.time_remaining}s` : "—"}
                    </span>
                  </td>
                  <td className="p-3 tabular-nums">{s.shock_count}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full border text-xs ${statusClass(s.status)}`}>
                      {statusLabel(s.status)}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={s.status !== "active" || busyId === s.id}
                        onClick={() => void handleAI(s.id)}
                      >
                        {busyId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                        <span className="ml-1.5 hidden sm:inline">IA</span>
                      </Button>
                      <Link to="/urgence-cardiaque">
                        <Button size="sm" variant="outline">
                          <Activity className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          setBusyId(s.id);
                          try {
                            await remove({ data: { id: s.id } });
                            await refresh();
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <MedicalDisclaimer />
      </div>
    </AppShell>
  );
}
