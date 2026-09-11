export type Rhythm = "NORMAL" | "VFIB" | "ASYSTOLE";
export type CardiacAction = "SHOCK" | "MEDS" | "CPR" | "WAIT";

export type CardiacState = {
  patientId: string;
  health: number; // 0-100
  rhythm: Rhythm;
  shockCount: number;
  logs: string[];
  isGameOver: boolean;
  victory: boolean;
  startedAt: number;
};

export function initCardiacScenario(patientId = "patient_01"): CardiacState {
  return {
    patientId,
    health: 90,
    rhythm: "VFIB",
    shockCount: 0,
    logs: [
      "[URGENCE] Patient admis : douleur thoracique aiguë.",
      "[ALERTE] Fibrillation ventriculaire (VFIB) détectée.",
      "[PROTOCOLE] Défibrillation immédiate requise.",
    ],
    isGameOver: false,
    victory: false,
    startedAt: Date.now(),
  };
}

export function processCardiacAction(state: CardiacState, action: CardiacAction): CardiacState {
  if (state.isGameOver) return state;

  const next: CardiacState = { ...state, logs: [...state.logs] };

  // Dégradation naturelle tant que le rythme est instable
  if (next.rhythm === "VFIB") {
    next.health = Math.max(0, next.health - 5);
    next.logs.push("[MONITEUR] La saturation en O₂ chute…");
  }

  if (action === "SHOCK") {
    next.shockCount += 1;
    const chance = next.shockCount === 1 ? 0.7 : 0.4;
    if (next.rhythm !== "VFIB") {
      next.logs.push("[ERREUR] Choc inutile : le rythme n'est pas choquable.");
      next.health = Math.max(0, next.health - 8);
    } else if (Math.random() < chance) {
      next.rhythm = "NORMAL";
      next.health = Math.min(100, next.health + 15);
      next.logs.push("[SUCCÈS] Choc efficace ! Rythme sinusal rétabli.");
      next.isGameOver = true;
      next.victory = true;
    } else {
      next.logs.push("[ÉCHEC] Le choc n'a pas fonctionné. La VFIB persiste.");
    }
  } else if (action === "MEDS") {
    next.health = Math.min(100, next.health + 10);
    next.logs.push("[TRAITEMENT] Adrénaline 1 mg IV administrée.");
  } else if (action === "CPR") {
    next.health = Math.min(100, next.health + 6);
    next.logs.push("[RCP] Compressions thoraciques 30:2 — perfusion maintenue.");
  } else {
    next.logs.push("[ATTENTE] Aucune action. Le temps joue contre le patient.");
  }

  if (next.health <= 0) {
    next.rhythm = "ASYSTOLE";
    next.isGameOver = true;
    next.victory = false;
    next.logs.push("[DÉCÈS] Asystolie irréversible. Patient décédé.");
  }

  return next;
}

export function timeoutDeath(state: CardiacState): CardiacState {
  if (state.isGameOver) return state;
  return {
    ...state,
    health: 0,
    rhythm: "ASYSTOLE",
    isGameOver: true,
    victory: false,
    logs: [...state.logs, "[TEMPS ÉCOULÉ] Arrêt prolongé — asystolie. Patient décédé."],
  };
}
