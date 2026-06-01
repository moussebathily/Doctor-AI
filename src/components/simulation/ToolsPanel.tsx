import { Scissors, Wrench, Camera, Scan, Syringe, Pipette } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TOOLS = [
  { id: "bistouri", label: "Bistouri", icon: Syringe },
  { id: "pince", label: "Pince", icon: Wrench },
  { id: "ciseaux", label: "Ciseaux", icon: Scissors },
  { id: "camera", label: "Caméra", icon: Camera },
  { id: "aspirateur", label: "Aspirateur", icon: Pipette },
  { id: "ecarteur", label: "Écarteur", icon: Scan },
];

export function ToolsPanel({ activeTool, onChange }: { activeTool: string; onChange: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-1">Outils 3D</p>
      <div className="grid grid-cols-3 gap-1.5">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-medium transition-all",
              activeTool === t.id
                ? "bg-accent/15 border-accent text-foreground shadow-[0_0_18px_-6px_oklch(0.72_0.11_200/0.6)]"
                : "border-border bg-card/40 text-muted-foreground hover:text-foreground hover:border-border/60",
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>
      <Button size="sm" className="w-full mt-2 h-7 text-[11px] bg-accent hover:bg-accent/90">
        Changer d'outil
      </Button>
    </div>
  );
}
