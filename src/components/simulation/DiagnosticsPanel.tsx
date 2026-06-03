import { useSyncExternalStore, useEffect, useState } from "react";
import {
  subscribe, getDiagnostics, fmtBytes, fmtMs,
} from "@/lib/glb-diagnostics";
import { clearGLBCache, isCached } from "@/lib/glb-cache";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Cpu, Database, Gauge, HardDrive, Smartphone, Tablet, Monitor, Wifi, WifiOff, Trash2, CheckCircle2 } from "lucide-react";

/**
 * Diagnostics panel — real metrics, no estimates.
 *  • Per-load: bytes, elapsed, cache-hit
 *  • Live: FPS sample, online status
 *  • Device class (mobile / tablet / desktop) with cache size + clear button
 */
export function DiagnosticsPanel({ activeGlbUrl }: { activeGlbUrl?: string | null }) {
  const d = useSyncExternalStore(subscribe, getDiagnostics, getDiagnostics);
  const [cached, setCached] = useState<boolean | null>(null);

  useEffect(() => {
    if (!activeGlbUrl) { setCached(null); return; }
    isCached(activeGlbUrl).then(setCached);
  }, [activeGlbUrl, d.loads.length]);

  const totalBytes = d.loads.reduce((s, l) => s + l.bytes, 0);
  const lastLoad = d.loads[0];
  const cacheHits = d.loads.filter((l) => l.cacheHit).length;
  const hitRate = d.loads.length ? Math.round((cacheHits / d.loads.length) * 100) : 0;

  const DeviceIcon = d.deviceClass === "mobile" ? Smartphone : d.deviceClass === "tablet" ? Tablet : Monitor;

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

      <Button
        variant="outline" size="sm" className="w-full h-7 text-[11px]"
        onClick={async () => { await clearGLBCache(); setCached(false); }}
      >
        <Trash2 className="w-3 h-3 mr-1.5" /> Vider le cache offline
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
