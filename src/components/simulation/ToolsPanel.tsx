import { Scissors, Wrench, Syringe, Pipette } from "lucide-react";
import { cn } from "@/lib/utils";

const TOOLS = [
  { id: "bistouri", label: "Bistouri", icon: Syringe },
  { id: "pince", label: "Pince", icon: Wrench },
  { id: "ciseaux", label: "Ciseaux", icon: Scissors },
  { id: "aspirateur", label: "Aspirateur", icon: Pipette },
];

export function ToolsPanel({ activeTool, onChange }: { activeTool: string; onChange: (id: string) => void }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur p-4">
      <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold mb-3 px-1">Outils</p>
      <div className="grid grid-cols-4 gap-2">
        {TOOLS.map((t) => {
          const active = activeTool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[10px] font-medium transition-all",
                active
                  ? "bg-sky-500/15 border-sky-500/60 text-white shadow-[0_0_18px_-6px_oklch(0.65_0.2_240/0.7)]"
                  : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white hover:border-white/20",
              )}
            >
              <t.icon className="w-5 h-5" />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
