import {
  Activity,
  Bone,
  Brain,
  Droplets,
  HeartPulse,
  Utensils,
  Wind,
  User,
  Eye,
  Layers,
  Dumbbell,
  Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type AnatomySystem =
  | "full"
  | "digestive"
  | "skeletal"
  | "muscular"
  | "circulatory"
  | "nervous"
  | "respiratory"
  | "urinary";

export type AnatomyView = "complete" | "transparent" | "organs" | "layers";

const SYSTEMS: { id: AnatomySystem; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "digestive", label: "Système Digestif", icon: Utensils },
  { id: "skeletal", label: "Système Squelettique", icon: Bone },
  { id: "muscular", label: "Système Musculaire", icon: Dumbbell },
  { id: "circulatory", label: "Système Circulatoire", icon: HeartPulse },
  { id: "nervous", label: "Système Nerveux", icon: Brain },
  { id: "respiratory", label: "Système Respiratoire", icon: Wind },
  { id: "urinary", label: "Système Urinaire", icon: Droplets },
];

const VIEWS: { id: AnatomyView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "complete", label: "Vue complète", icon: User },
  { id: "transparent", label: "Vue transparente", icon: Eye },
  { id: "organs", label: "Vue organes", icon: Activity },
  { id: "layers", label: "Vue par couches", icon: Layers },
];

export function SystemSidebar({
  system,
  view,
  onSystemChange,
  onViewChange,
  glbUrl,
  onGlbUrlChange,
  onLoadGlb,
  onClearGlb,
  hasGlb,
}: {
  system: AnatomySystem;
  view: AnatomyView;
  onSystemChange: (s: AnatomySystem) => void;
  onViewChange: (v: AnatomyView) => void;
  glbUrl: string;
  onGlbUrlChange: (v: string) => void;
  onLoadGlb: () => void;
  onClearGlb: () => void;
  hasGlb: boolean;
}) {
  return (
    <aside className="rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur p-4 space-y-5 self-start">
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold mb-2.5 px-1">Systèmes</p>
        <div className="space-y-1">
          {SYSTEMS.map((s) => {
            const active = system === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSystemChange(s.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all",
                  active
                    ? "bg-sky-500 text-white shadow-[0_6px_20px_-6px_oklch(0.65_0.2_240/0.7)]"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <s.icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-slate-400")} />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold mb-2.5 px-1">Vues</p>
        <div className="space-y-1">
          {VIEWS.map((v) => {
            const active = view === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onViewChange(v.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all",
                  active
                    ? "bg-sky-500 text-white shadow-[0_6px_20px_-6px_oklch(0.65_0.2_240/0.7)]"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <v.icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-slate-400")} />
                <span className="truncate">{v.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-3 border-t border-white/5">
        <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold mb-2 px-1 flex items-center gap-1">
          <Box className="w-3 h-3" /> Modèle 3D externe
        </p>
        <div className="space-y-1.5">
          <Input
            value={glbUrl}
            onChange={(e) => onGlbUrlChange(e.target.value)}
            placeholder="URL .glb"
            className="h-8 text-[11px] bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
          />
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={onLoadGlb} className="flex-1 h-7 text-xs bg-white/5 border-white/10 text-slate-100 hover:bg-white/10">
              {hasGlb ? "Recharger" : "Charger"}
            </Button>
            {hasGlb && (
              <Button size="sm" variant="ghost" onClick={onClearGlb} className="h-7 text-xs text-slate-400 hover:text-white hover:bg-white/5">
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
