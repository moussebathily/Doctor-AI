import { AlertTriangle } from "lucide-react";

export function MedicalDisclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3" />
        Ne remplace pas un avis médical. En cas d'urgence, contactez les secours.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex gap-3">
      <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-semibold text-foreground">Information médicale — usage pédagogique</p>
        <p className="text-muted-foreground mt-0.5">
          Cette plateforme ne remplace pas un avis médical. Consultez toujours un professionnel de santé. En cas d'urgence vitale, appelez immédiatement les services d'urgence.
        </p>
      </div>
    </div>
  );
}
