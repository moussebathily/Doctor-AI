import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Maximize2, X, Stethoscope } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
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

type Hotspot = {
  x: number; // %
  y: number; // %
  label: string;
  description: string;
  operationId?: string; // links to OPERATIONS.id
  organ?: string;
};

type Plate = {
  src: string;
  title: string;
  category: "Régions" | "Organes" | "Muscles" | "Vocabulaire";
  hotspots?: Hotspot[];
};

const PLATES: Plate[] = [
  {
    src: organes1,
    title: "Organes internes (planche complète)",
    category: "Organes",
    hotspots: [
      { x: 67, y: 12, label: "Cerveau", description: "Centre nerveux. Contrôle pensée, mouvement, sensations. ~1,4 kg.", organ: "brain" },
      { x: 22, y: 19, label: "Poumons", description: "Échanges O₂/CO₂. ~12 respirations/min au repos.", organ: "lung" },
      { x: 67, y: 27, label: "Cœur", description: "Pompe ~5 L/min. 4 cavités. Pontage en cas de coronaires obstruées.", operationId: "pontage-coronarien", organ: "heart" },
      { x: 14, y: 33, label: "Foie", description: "Détoxification, synthèse de bile, ~1,5 kg." },
      { x: 67, y: 41, label: "Estomac", description: "Digestion mécanique et chimique des aliments." },
      { x: 22, y: 45, label: "Reins", description: "Filtrage du sang, ~180 L/jour. Production d'urine." },
      { x: 22, y: 59, label: "Pancréas", description: "Insuline + enzymes digestives." },
      { x: 22, y: 76, label: "Intestin", description: "~7 m. Absorption des nutriments. Appendice = ablation possible.", operationId: "appendicectomie", organ: "appendix" },
    ],
  },
  {
    src: regionsAP,
    title: "Régions anatomiques — vues antérieure & postérieure",
    category: "Régions",
    hotspots: [
      { x: 22, y: 8, label: "Tête (céphalique)", description: "Crâne, face, organes des sens." },
      { x: 22, y: 17, label: "Cou (cervical)", description: "Vertèbres cervicales C1–C7, trachée, œsophage." },
      { x: 22, y: 33, label: "Thorax", description: "Cage thoracique, cœur, poumons." },
      { x: 22, y: 47, label: "Abdomen", description: "Estomac, foie, intestins." },
      { x: 30, y: 70, label: "Tibia", description: "Os long de la jambe — ostéosynthèse possible si fracture.", operationId: "fracture-tibia", organ: "bone" },
    ],
  },
  {
    src: maleFemale,
    title: "Anatomie de surface homme & femme",
    category: "Régions",
    hotspots: [
      { x: 50, y: 8, label: "Tête", description: "Centre de commande sensorielle et cognitive." },
      { x: 23, y: 22, label: "Épaule", description: "Articulation gléno-humérale — la plus mobile du corps." },
      { x: 50, y: 35, label: "Poitrine", description: "Cage thoracique protégeant cœur et poumons." },
      { x: 50, y: 48, label: "Abdomen", description: "Contient les organes digestifs." },
      { x: 50, y: 63, label: "Pelvis", description: "Os iliaques, organes uro-génitaux." },
    ],
  },
  { src: femaleRegions, title: "Régions anatomiques détaillées (femme)", category: "Régions" },
  { src: corpsFemmeFr, title: "Corps humain — vocabulaire français", category: "Vocabulaire" },
  { src: posteriorFr, title: "Anatomie de surface — vue postérieure (FR)", category: "Régions" },
  { src: corpsEnfant, title: "Le corps humain — planche pédagogique", category: "Vocabulaire" },
  {
    src: musclesFr,
    title: "Système musculaire — antérieur & postérieur",
    category: "Muscles",
    hotspots: [
      { x: 30, y: 25, label: "Deltoïde", description: "Muscle de l'épaule, abducteur du bras." },
      { x: 26, y: 36, label: "Grand pectoral", description: "Muscle de la poitrine, adducteur du bras." },
      { x: 30, y: 50, label: "Grand droit (abdominal)", description: "Fléchisseur du tronc — les fameuses tablettes." },
      { x: 30, y: 72, label: "Quadriceps", description: "Extenseur du genou, principal muscle de la cuisse." },
    ],
  },
  { src: organes2, title: "Organes internes (vue compacte)", category: "Organes" },
  { src: extra, title: "Référence anatomique complémentaire", category: "Régions" },
];

export function AnatomyAtlas({ trigger }: { trigger?: React.ReactNode }) {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState<Plate | null>(null);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [filter, setFilter] = useState<Plate["category"] | "Tous">("Tous");
  const filtered = filter === "Tous" ? PLATES : PLATES.filter((p) => p.category === filter);

  const goToOperation = (opId: string) => {
    setZoom(null);
    setActiveHotspot(null);
    navigate({ to: "/simulation", search: () => ({ op: opId }) as never });
  };

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
            <Button key={c} size="sm" variant={filter === c ? "default" : "outline"} onClick={() => setFilter(c)} className="text-xs h-7">
              {c}
            </Button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <button
              key={p.src}
              onClick={() => { setZoom(p); setActiveHotspot(null); }}
              className="group relative rounded-xl overflow-hidden border border-border bg-card hover:border-teal hover:shadow-lg transition-all text-left"
            >
              <div className="aspect-[4/5] bg-white overflow-hidden">
                <img src={p.src} alt={p.title} loading="lazy" className="w-full h-full object-contain" />
              </div>
              <div className="p-2.5">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <Badge variant="secondary" className="text-[9px]">{p.category}</Badge>
                  {p.hotspots && <Badge className="text-[9px] bg-teal text-teal-foreground">{p.hotspots.length} zones</Badge>}
                </div>
                <p className="text-xs font-medium leading-tight line-clamp-2">{p.title}</p>
              </div>
              <div className="absolute top-2 right-2 w-7 h-7 rounded-md bg-background/90 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 className="w-3.5 h-3.5" />
              </div>
            </button>
          ))}
        </div>

        {zoom && (
          <Dialog open onOpenChange={() => { setZoom(null); setActiveHotspot(null); }}>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-base flex items-center gap-2">
                  {zoom.title}
                  {zoom.hotspots && <Badge variant="outline" className="text-[10px]">Cliquez sur les pastilles</Badge>}
                </DialogTitle>
              </DialogHeader>
              <div className="relative inline-block w-full">
                <img src={zoom.src} alt={zoom.title} className="w-full h-auto rounded-lg bg-white" />
                {zoom.hotspots?.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveHotspot(h)}
                    style={{ left: `${h.x}%`, top: `${h.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group"
                    aria-label={h.label}
                  >
                    <span className="relative flex items-center justify-center">
                      <span className="absolute inline-flex h-6 w-6 rounded-full bg-teal/40 animate-ping" />
                      <span className="relative inline-flex h-4 w-4 rounded-full bg-teal border-2 border-white shadow-lg group-hover:scale-125 transition-transform" />
                    </span>
                  </button>
                ))}
              </div>

              {activeHotspot && (
                <div className="mt-3 p-4 rounded-xl border border-teal/40 bg-teal/5 relative">
                  <button onClick={() => setActiveHotspot(null)} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                  <h4 className="font-display font-bold text-base mb-1">{activeHotspot.label}</h4>
                  <p className="text-sm text-foreground/85 leading-relaxed">{activeHotspot.description}</p>
                  {activeHotspot.operationId && (
                    <Button size="sm" className="mt-3" onClick={() => goToOperation(activeHotspot.operationId!)}>
                      <Stethoscope className="w-4 h-4 mr-1.5" /> Lancer la simulation associée
                    </Button>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
