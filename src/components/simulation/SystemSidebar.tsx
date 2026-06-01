import { Activity, Bone, Brain, Drumstick, Droplets, HeartPulse, Stethoscope, Wind, User, Eye, Layers, Box } from "lucide-react";
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
  { id: "full", label: "Vue complète", icon: User },
  { id: "digestive", label: "Système Digestif", icon: Stethoscope },
  { id: "skeletal", label: "Système Squelettique", icon: Bone },
  { id: "muscular", label: "Système Musculaire", icon: Drumstick },
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
    <aside className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3 space-y-4 self-start">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-1">Systèmes</p>
        <div className="space-y-1">
          {SYSTEMS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSystemChange(s.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all",
                system === s.id
                  ? "bg-accent text-accent-foreground shadow-[0_0_18px_-4px_oklch(0.72_0.11_200/0.45)]"
                  : "text-foreground/80 hover:bg-muted/50",
              )}
            >
              <s.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-1">Vues</p>
        <div className="space-y-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onViewChange(v.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all",
                view === v.id ? "bg-teal/15 text-foreground ring-1 ring-teal/40" : "text-foreground/80 hover:bg-muted/50",
              )}
            >
              <v.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-1 flex items-center gap-1">
          <Box className="w-3 h-3" /> Modèle 3D
        </p>
        <div className="space-y-1.5">
          <Input
            value={glbUrl}
            onChange={(e) => onGlbUrlChange(e.target.value)}
            placeholder="URL .glb (Sketchfab/Meshy)"
            className="h-8 text-[11px]"
          />
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={onLoadGlb} className="flex-1 h-7 text-xs">
              {hasGlb ? "Recharger" : "Charger"}
            </Button>
            {hasGlb && (
              <Button size="sm" variant="ghost" onClick={onClearGlb} className="h-7 text-xs">
                Stylisé
              </Button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
