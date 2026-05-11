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
      { title: "Anesthésie générale", description: "Induction et intubation. Vérifier signes vitaux, monitoring complet.", risks: "Réaction anesthésique (rare)", vitalCheck: "TA, FC, SpO₂, capnographie", checklist: ["Patient à jeun confirmé", "Voie veineuse périphérique posée", "Monitoring multiparamétrique branché", "Pré-oxygénation 3 min", "Curarisation vérifiée"] },
      { title: "Incision (cœlioscopie)", description: "3 trocarts : ombilical (10 mm), suspubien et fosse iliaque gauche. Insufflation CO₂.", risks: "Lésion vasculaire à l'introduction", checklist: ["Champ opératoire stérile", "Antibioprophylaxie injectée", "Pression CO₂ < 14 mmHg", "Optique 30° en place", "Vérification absence saignement aux trocarts"] },
      { title: "Repérage de l'appendice", description: "Identifier le caecum, suivre les bandelettes coliques jusqu'à la base appendiculaire.", risks: "Confusion anatomique", checklist: ["Caecum identifié", "Bandelettes coliques suivies", "Base appendiculaire visualisée", "Aspect inflammatoire évalué"] },
      { title: "Section du méso-appendice", description: "Coagulation et section du méso contenant l'artère appendiculaire.", risks: "Hémorragie", checklist: ["Hémostase artère appendiculaire", "Coagulation bipolaire vérifiée", "Pas de saignement actif"] },
      { title: "Ligature de la base", description: "Endo-loop x2 à la base, section au-dessus.", risks: "Lâchage de ligature", checklist: ["2 endo-loops posés", "Section nette entre les loops", "Moignon contrôlé"] },
      { title: "Extraction & lavage", description: "Extraction dans un sac, lavage péritonéal abondant.", risks: "Contamination pariétale", checklist: ["Pièce dans sac stérile", "Lavage 1-2 L sérum tiède", "Aspiration complète"] },
      { title: "Fermeture", description: "Exsufflation, fermeture aponévrotique du trocart de 10 mm, cutané.", risks: "Éventration", checklist: ["Compte des compresses correct", "Aponévrose fermée fil résorbable", "Peau suturée", "Pansement stérile"] },
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
      { title: "Sternotomie médiane", description: "Incision sternale verticale, ouverture du péricarde.", risks: "Saignement, lésion pleurale", vitalCheck: "TA invasive, ECG continu, ETO", checklist: ["Voies centrales posées", "Cathéter artériel radial", "Sonde ETO en place", "Héparinisation prête"] },
      { title: "Prélèvement du greffon", description: "Artère mammaire interne gauche ou veine saphène.", risks: "Spasme du greffon", checklist: ["Greffon prélevé sans torsion", "Test d'étanchéité OK", "Conservation solution héparinée"] },
      { title: "Circulation extracorporelle", description: "Canulation aorte + oreillette droite, démarrage CEC.", risks: "AVC, troubles de coagulation", checklist: ["ACT > 480s", "Canules sécurisées", "Débit CEC stable", "Température cible atteinte"] },
      { title: "Cardioplégie", description: "Arrêt cardiaque par solution cardioplégique froide.", risks: "Lésion myocardique", checklist: ["Cardioplégie antérograde", "Cœur arrêté en diastole", "Température myocardique < 15°C"] },
      { title: "Anastomose distale", description: "Suture du greffon en aval de la sténose.", risks: "Sténose anastomotique", checklist: ["Coronaire ouverte propre", "Suture surjet 7/0", "Pas de fuite au test"] },
      { title: "Anastomose proximale", description: "Suture du greffon sur l'aorte ascendante.", risks: "Dissection aortique", checklist: ["Clamp latéral aortique", "Anastomose 6/0", "Purge des bulles"] },
      { title: "Reprise & fermeture", description: "Réchauffement, sevrage CEC, hémostase, fermeture sternale par fils d'acier.", risks: "Infection sternale, médiastinite", checklist: ["Sevrage CEC progressif", "Protamine injectée", "Drains thoraciques en place", "Sternum fermé fils d'acier x6"] },
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
      { title: "Installation", description: "Décubitus dorsal, garrot pneumatique, table orthopédique.", risks: "Compression nerveuse", checklist: ["Garrot < 300 mmHg", "Points d'appui protégés", "Amplificateur testé"] },
      { title: "Voie d'abord", description: "Incision sous-rotulienne, accès au plateau tibial.", risks: "Lésion tendon rotulien", checklist: ["Repères anatomiques palpés", "Tendon rotulien écarté", "Point d'entrée centré"] },
      { title: "Réduction de la fracture", description: "Réduction sous amplificateur de brillance.", risks: "Cal vicieux si mauvaise réduction", checklist: ["Axes frontal et sagittal corrects", "Pas de rotation résiduelle", "Longueur restaurée"] },
      { title: "Alésage canal médullaire", description: "Alésage progressif du canal jusqu'au diamètre choisi.", risks: "Embolie graisseuse", checklist: ["Alésage progressif 0,5 mm", "Lavage du canal", "Surveillance hémodynamique"] },
      { title: "Mise en place du clou", description: "Insertion du clou centro-médullaire.", risks: "Refend cortical", checklist: ["Clou bien centré", "Pas de refend visible scopie", "Longueur adaptée"] },
      { title: "Verrouillage", description: "Vis de verrouillage proximales et distales.", risks: "Mauvais positionnement de vis", checklist: ["Vis proximales x2 OK", "Vis distales x2 OK", "Contrôle scopique 2 plans"] },
      { title: "Fermeture", description: "Lavage, fermeture par plans, pansement compressif.", risks: "Syndrome des loges, infection", checklist: ["Lavage abondant", "Hémostase soigneuse", "Pansement compressif", "Pouls périphériques contrôlés"] },
    ],
  },
];

export function findOperation(id: string) {
  return OPERATIONS.find((o) => o.id === id);
}
