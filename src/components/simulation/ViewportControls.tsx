import { RotateCw, ZoomIn, ZoomOut, Hand, RotateCcw } from "lucide-react";
import { emitViewport, type ViewportAction } from "@/lib/viewport-bus";

const CONTROLS: { id: ViewportAction; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "rotate-right", label: "Rotation", icon: RotateCw },
  { id: "zoom-in", label: "Zoom +", icon: ZoomIn },
  { id: "zoom-out", label: "Zoom -", icon: ZoomOut },
  { id: "pan-toggle", label: "Déplacer", icon: Hand },
  { id: "reset", label: "Réinitialiser", icon: RotateCcw },
];

export function ViewportControls({ onAction }: { onAction?: (id: ViewportAction) => void }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur p-2 flex flex-col gap-1.5 self-start">
      {CONTROLS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => {
            emitViewport(c.id);
            onAction?.(c.id);
          }}
          className="w-16 flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          title={c.label}
        >
          <c.icon className="w-4 h-4" />
          {c.label}
        </button>
      ))}
    </div>
  );
}
