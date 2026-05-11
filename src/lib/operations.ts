// Library of guided 3D operations
export type Step = {
  title: string;
  description: string;
  risks?: string;
  checklist?: string[];
  vitalCheck?: string;
};

export type Operation = {
  id: string;
  name: string;
  organ: "appendix" | "heart" | "bone" | "brain" | "lung";
  organLabel: string;
  duration: string;
  difficulty: "Débutant" | "Intermédiaire" | "Avancé";
  description: string;
  steps: Step[];
};

export const OPERATIONS: Operation[] = [
  {
    id: "appendicectomie",
    name: "Appendicectomie",
    organ: "appendix",
    organLabel: "Appendice (fosse iliaque droite)",
    duration: "30-60 min",
    difficulty: "Intermédiaire",
    description: "Ablation chirurgicale de l'appendice en cas d'appendicite aiguë.",
    steps: [
      { title: "Anesthésie générale", description: "Induction et intubation. Vérifier signes vitaux, monitoring complet.", risks: "Réaction anesthésique (rare)" },
      { title: "Incision (cœlioscopie)", description: "3 trocarts : ombilical (10 mm), suspubien et fosse iliaque gauche. Insufflation CO₂.", risks: "Lésion vasculaire à l'introduction" },
      { title: "Repérage de l'appendice", description: "Identifier le caecum, suivre les bandelettes coliques jusqu'à la base appendiculaire.", risks: "Confusion anatomique" },
      { title: "Section du méso-appendice", description: "Coagulation et section du méso contenant l'artère appendiculaire.", risks: "Hémorragie" },
      { title: "Ligature de la base", description: "Endo-loop x2 à la base, section au-dessus.", risks: "Lâchage de ligature" },
      { title: "Extraction & lavage", description: "Extraction dans un sac, lavage péritonéal abondant.", risks: "Contamination pariétale" },
      { title: "Fermeture", description: "Exsufflation, fermeture aponévrotique du trocart de 10 mm, cutané.", risks: "Éventration" },
    ],
  },
  {
    id: "pontage-coronarien",
    name: "Pontage coronarien",
    organ: "heart",
    organLabel: "Cœur",
    duration: "3-6 h",
    difficulty: "Avancé",
    description: "Création d'un pontage pour contourner une artère coronaire obstruée.",
    steps: [
      { title: "Sternotomie médiane", description: "Incision sternale verticale, ouverture du péricarde.", risks: "Saignement, lésion pleurale" },
      { title: "Prélèvement du greffon", description: "Artère mammaire interne gauche ou veine saphène.", risks: "Spasme du greffon" },
      { title: "Circulation extracorporelle", description: "Canulation aorte + oreillette droite, démarrage CEC.", risks: "AVC, troubles de coagulation" },
      { title: "Cardioplégie", description: "Arrêt cardiaque par solution cardioplégique froide.", risks: "Lésion myocardique" },
      { title: "Anastomose distale", description: "Suture du greffon en aval de la sténose.", risks: "Sténose anastomotique" },
      { title: "Anastomose proximale", description: "Suture du greffon sur l'aorte ascendante.", risks: "Dissection aortique" },
      { title: "Reprise & fermeture", description: "Réchauffement, sevrage CEC, hémostase, fermeture sternale par fils d'acier.", risks: "Infection sternale, médiastinite" },
    ],
  },
  {
    id: "fracture-tibia",
    name: "Ostéosynthèse fracture tibia",
    organ: "bone",
    organLabel: "Tibia",
    duration: "1-2 h",
    difficulty: "Intermédiaire",
    description: "Réduction et fixation d'une fracture du tibia par enclouage centro-médullaire.",
    steps: [
      { title: "Installation", description: "Décubitus dorsal, garrot pneumatique, table orthopédique.", risks: "Compression nerveuse" },
      { title: "Voie d'abord", description: "Incision sous-rotulienne, accès au plateau tibial.", risks: "Lésion tendon rotulien" },
      { title: "Réduction de la fracture", description: "Réduction sous amplificateur de brillance.", risks: "Cal vicieux si mauvaise réduction" },
      { title: "Alésage canal médullaire", description: "Alésage progressif du canal jusqu'au diamètre choisi.", risks: "Embolie graisseuse" },
      { title: "Mise en place du clou", description: "Insertion du clou centro-médullaire.", risks: "Refend cortical" },
      { title: "Verrouillage", description: "Vis de verrouillage proximales et distales.", risks: "Mauvais positionnement de vis" },
      { title: "Fermeture", description: "Lavage, fermeture par plans, pansement compressif.", risks: "Syndrome des loges, infection" },
    ],
  },
];

export function findOperation(id: string) {
  return OPERATIONS.find((o) => o.id === id);
}
