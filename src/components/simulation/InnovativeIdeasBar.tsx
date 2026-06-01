import { Brain, Glasses, Siren, Users, BarChart3 } from "lucide-react";

const IDEAS = [
  { icon: Brain, title: "IA Coach", desc: "L'IA analyse vos gestes et vous donne des conseils en temps réel." },
  { icon: Glasses, title: "Réalité Augmentée", desc: "Projetez le modèle 3D sur un patient réel pour vous entraîner." },
  { icon: Siren, title: "Scénarios d'urgence", desc: "Pratiquez des cas critiques avec chrono et imprévus." },
  { icon: Users, title: "Mode Multijoueur", desc: "Collaborez avec d'autres médecins en temps réel." },
  { icon: BarChart3, title: "Rapports détaillés", desc: "Obtenez des rapports de performance et progressez." },
];

export function InnovativeIdeasBar() {
  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-1">Idées innovantes</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {IDEAS.map((i) => (
          <div
            key={i.title}
            className="group rounded-xl border border-border bg-gradient-to-br from-slate-900/40 to-slate-800/20 p-2.5 hover:border-accent/60 hover:shadow-[0_0_18px_-6px_oklch(0.72_0.11_200/0.6)] transition-all"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center text-accent">
                <i.icon className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs font-display font-bold leading-tight">{i.title}</p>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">{i.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
