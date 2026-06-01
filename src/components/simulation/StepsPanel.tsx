import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Step } from "@/lib/operations";

export function StepsPanel({ steps, currentStep }: { steps: Step[]; currentStep: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-1">Étapes de l'opération</p>
      <ol className="space-y-1">
        {steps.map((s, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <li
              key={i}
              className={cn(
                "flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all",
                active && "bg-accent text-accent-foreground shadow-[0_0_18px_-4px_oklch(0.72_0.11_200/0.45)] font-semibold",
                done && "text-foreground/90",
                !active && !done && "text-muted-foreground hover:bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                  active ? "bg-white/20 text-white" : done ? "bg-success/20 text-success" : "border border-current",
                )}
              >
                {i + 1}
              </span>
              <span className="flex-1 truncate">{s.title}</span>
              {done && <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
