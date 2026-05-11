import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Maximize2 } from "lucide-react";
import regionsAP from "@/assets/anatomy/regions-anterior-posterior.jpg";
import maleFemale from "@/assets/anatomy/male-female-anterior.jpg";
import femaleRegions from "@/assets/anatomy/female-front-regions.webp";
import corpsFemmeFr from "@/assets/anatomy/corps-femme-fr.webp";
import posteriorFr from "@/assets/anatomy/posterior-fr.jpg";
import corpsEnfant from "@/assets/anatomy/corps-humain-enfant.png";
import musclesFr from "@/assets/anatomy/muscles-fr.gif";
import organes1 from "@/assets/anatomy/organes-1.webp";
import organes2 from "@/assets/anatomy/organes-2.webp";
import extra from "@/assets/anatomy/extra.avif";

type Plate = { src: string; title: string; category: "Régions" | "Organes" | "Muscles" | "Vocabulaire" };

const PLATES: Plate[] = [
  { src: regionsAP, title: "Régions anatomiques — vues antérieure & postérieure", category: "Régions" },
  { src: maleFemale, title: "Anatomie de surface homme & femme", category: "Régions" },
  { src: femaleRegions, title: "Régions anatomiques détaillées (femme)", category: "Régions" },
  { src: corpsFemmeFr, title: "Corps humain — vocabulaire français", category: "Vocabulaire" },
  { src: posteriorFr, title: "Anatomie de surface — vue postérieure (FR)", category: "Régions" },
  { src: corpsEnfant, title: "Le corps humain — planche pédagogique", category: "Vocabulaire" },
  { src: musclesFr, title: "Système musculaire — antérieur & postérieur", category: "Muscles" },
  { src: organes1, title: "Organes internes (planche complète)", category: "Organes" },
  { src: organes2, title: "Organes internes (vue compacte)", category: "Organes" },
  { src: extra, title: "Référence anatomique complémentaire", category: "Régions" },
];

export function AnatomyAtlas({ trigger }: { trigger?: React.ReactNode }) {
  const [zoom, setZoom] = useState<Plate | null>(null);
  const [filter, setFilter] = useState<Plate["category"] | "Tous">("Tous");
  const filtered = filter === "Tous" ? PLATES : PLATES.filter((p) => p.category === filter);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <BookOpen className="w-4 h-4 mr-1.5" /> Atlas anatomique
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal" /> Atlas anatomique de référence
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 mb-3">
          {(["Tous", "Régions", "Organes", "Muscles", "Vocabulaire"] as const).map((c) => (
            <Button
              key={c}
              size="sm"
              variant={filter === c ? "default" : "outline"}
              onClick={() => setFilter(c)}
              className="text-xs h-7"
            >
              {c}
            </Button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <button
              key={p.src}
              onClick={() => setZoom(p)}
              className="group relative rounded-xl overflow-hidden border border-border bg-card hover:border-teal hover:shadow-lg transition-all text-left"
            >
              <div className="aspect-[4/5] bg-muted overflow-hidden">
                <img src={p.src} alt={p.title} loading="lazy" className="w-full h-full object-contain bg-white" />
              </div>
              <div className="p-2.5">
                <Badge variant="secondary" className="text-[9px] mb-1">{p.category}</Badge>
                <p className="text-xs font-medium leading-tight line-clamp-2">{p.title}</p>
              </div>
              <div className="absolute top-2 right-2 w-7 h-7 rounded-md bg-background/90 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 className="w-3.5 h-3.5" />
              </div>
            </button>
          ))}
        </div>

        {zoom && (
          <Dialog open onOpenChange={() => setZoom(null)}>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-base">{zoom.title}</DialogTitle>
              </DialogHeader>
              <img src={zoom.src} alt={zoom.title} className="w-full h-auto rounded-lg bg-white" />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
