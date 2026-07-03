import { cn } from "@/lib/utils";
import type { Step } from "@/lib/operations";

export function StepsPanel({
  steps,
  currentStep,
  onSelect,
}: {
  steps: Step[];
  currentStep: number;
  onSelect?: (i: number) => void;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur p-4">
      <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold mb-3 px-1">Étapes de l'opération</p>
      <ol className="space-y-1">
        {steps.map((s, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          const clickable = i <= currentStep && !!onSelect;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onSelect?.(i)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-left transition-all",
                  active && "bg-sky-500 text-white font-semibold shadow-[0_6px_20px_-6px_oklch(0.65_0.2_240/0.7)]",
                  done && !active && "text-slate-300 hover:bg-white/5 cursor-pointer",
                  !active && !done && "text-slate-400 cursor-not-allowed opacity-70",
                )}

            >
              <span
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                  active
                    ? "bg-white/20 text-white"
                    : done
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-white/5 text-slate-400 border border-white/10",
                )}
              >
                {i + 1}
              </span>
              <span className="flex-1 truncate">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
