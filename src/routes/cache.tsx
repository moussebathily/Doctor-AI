import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  listCachedGLBs, deleteCachedGLB, refreshCachedGLB, clearGLBCache,
  type CachedEntry,
} from "@/lib/glb-cache";
import {
  isAutoRefreshEnabled, setAutoRefresh, runAutoRefresh,
} from "@/lib/glb-auto-refresh";
import { fmtBytes } from "@/lib/glb-diagnostics";
import { toast } from "sonner";
import { ArrowLeft, Database, HardDrive, RefreshCw, Trash2, FileBox, WifiOff, Wifi, Zap } from "lucide-react";

export const Route = createFileRoute("/cache")({
  head: () => ({
    meta: [
      { title: "Cache hors-ligne — Doctor AI" },
      { name: "description", content: "Gestion des modèles 3D anatomiques stockés hors-ligne." },
    ],
  }),
  component: CachePage,
});

function CachePage() {
  const [entries, setEntries] = useState<CachedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const list = await listCachedGLBs();
    setEntries(list.sort((a, b) => b.bytes - a.bytes));
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const r = await runAutoRefresh();
      if (r.refreshed.length > 0) {
        toast.success(`${r.refreshed.length} modèle(s) rafraîchi(s) automatiquement`);
      }
      await refresh();
    })();
    if (typeof navigator !== "undefined") setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const totalBytes = entries.reduce((s, e) => s + e.bytes, 0);

  const handleDelete = async (url: string) => {
    setBusy(url);
    await deleteCachedGLB(url);
    toast.success("Entrée supprimée");
    await refresh();
    setBusy(null);
  };

  const handleRefresh = async (url: string) => {
    setBusy(url);
    try {
      await refreshCachedGLB(url);
      toast.success("Modèle rafraîchi");
    } catch {
      toast.error("Échec du rafraîchissement");
    }
    await refresh();
    setBusy(null);
  };

  const handleClearAll = async () => {
    if (!confirm("Vider entièrement le cache hors-ligne ?")) return;
    await clearGLBCache();
    toast.success("Cache vidé");
    await refresh();
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/simulation">
                <ArrowLeft className="w-4 h-4 mr-1" /> Retour
              </Link>
            </Button>
            <div>
              <h1 className="font-display font-bold text-2xl md:text-3xl flex items-center gap-2">
                <Database className="w-6 h-6 text-teal" /> Cache hors-ligne
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Modèles 3D anatomiques stockés localement pour une utilisation sans réseau.
              </p>
            </div>
          </div>
          <Badge variant={online ? "secondary" : "outline"} className="gap-1.5 text-xs">
            {online ? <Wifi className="w-3 h-3 text-teal" /> : <WifiOff className="w-3 h-3 text-warning" />}
            {online ? "Connecté" : "Hors-ligne"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryCard icon={FileBox} label="Modèles en cache" value={String(entries.length)} />
          <SummaryCard icon={HardDrive} label="Espace utilisé" value={fmtBytes(totalBytes)} tone="teal" />
          <div className="rounded-2xl border border-border bg-card/60 p-4 flex items-center justify-center">
            <Button
              variant="destructive"
              size="sm"
              disabled={entries.length === 0}
              onClick={handleClearAll}
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Tout purger
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-display font-semibold text-sm">Modèles stockés</h2>
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Lecture du cache…</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucun modèle en cache. Charge un modèle 3D dans la simulation pour le rendre disponible hors-ligne.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((e) => {
                const name = decodeURIComponent(e.url.split("/").pop() ?? e.url);
                const isBusy = busy === e.url;
                const ttlDays = e.ttlMs ? Math.round(e.ttlMs / (24 * 60 * 60 * 1000)) : 0;
                const remainingMs = e.expiresAt ? e.expiresAt - Date.now() : null;
                const remainingLabel = remainingMs === null
                  ? "permanent"
                  : remainingMs <= 0
                    ? "expiré"
                    : remainingMs < 60 * 60 * 1000
                      ? `${Math.max(1, Math.round(remainingMs / 60000))} min`
                      : remainingMs < 24 * 60 * 60 * 1000
                        ? `${Math.round(remainingMs / (60 * 60 * 1000))} h`
                        : `${Math.round(remainingMs / (24 * 60 * 60 * 1000))} j`;
                const auto = isAutoRefreshEnabled(e.url);
                return (
                  <li key={e.url} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm truncate" title={e.url}>{name}</p>
                      <p className="text-[10px] text-muted-foreground truncate" title={e.url}>{e.url}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        TTL : <span className="font-mono">{ttlDays || "∞"}{ttlDays ? " j" : ""}</span>
                        {" · "}
                        Expire dans : <span className={`font-mono ${e.expired ? "text-destructive" : ""}`}>{remainingLabel}</span>
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {fmtBytes(e.bytes)}
                    </Badge>
                    {e.expired && (
                      <Badge variant="outline" className="text-[10px] text-destructive">expiré</Badge>
                    )}
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground select-none cursor-pointer" title="Re-télécharger automatiquement à l'expiration">
                      <Zap className={`w-3 h-3 ${auto ? "text-teal" : ""}`} />
                      Auto
                      <Switch
                        checked={auto}
                        onCheckedChange={(v) => { setAutoRefresh(e.url, v); refresh(); }}
                      />
                    </label>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm" variant="outline" disabled={isBusy || !online}
                        onClick={() => handleRefresh(e.url)}
                        title={online ? "Re-télécharger" : "Hors-ligne"}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        size="sm" variant="outline" disabled={isBusy}
                        onClick={() => handleDelete(e.url)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
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

function SummaryCard({
  icon: Icon, label, value, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "teal";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`font-mono font-bold text-2xl mt-1 ${tone === "teal" ? "text-teal" : ""}`}>{value}</div>
    </div>
  );
}
