export type Rhythm = "NORMAL" | "VFIB" | "ASYSTOLE";
export type CardiacAction = "SHOCK" | "MEDS" | "CPR" | "WAIT";
export type CardiacStatus = "active" | "won" | "lost";

/** Durée réelle d'un tour de jeu, en secondes. */
export const TURN_SECONDS = 5;
export const TOTAL_TIME = 120;

export type CardiacCore = {
  patient_name: string;
  patient_age: number;
  scenario: string;
  health: number;
  rhythm: Rhythm;
  shock_count: number;
  time_remaining: number;
  status: CardiacStatus;
  logs: string[];
};

export type CardiacSession = CardiacCore & {
  id: string;
  last_tick_at: string;
  created_at: string;
  updated_at: string;
};

const PATIENTS = [
  { name: "Awa Diop", age: 58, scenario: "Infarctus antérieur — FV sur STEMI" },
  { name: "Moussa Ndiaye", age: 64, scenario: "Arrêt cardiaque per-opératoire" },
  { name: "Fatou Sarr", age: 47, scenario: "FV sur hypokaliémie sévère" },
  { name: "Ibrahima Ba", age: 71, scenario: "Arrêt sur insuffisance coronarienne" },
];

export function newPatient(): CardiacCore {
  const p = PATIENTS[Math.floor(Math.random() * PATIENTS.length)]!;
  return {
    patient_name: p.name,
    patient_age: p.age,
    scenario: p.scenario,
    health: 90,
    rhythm: "VFIB",
    shock_count: 0,
    time_remaining: TOTAL_TIME,
    status: "active",
    logs: [
      `[URGENCE] ${p.name}, ${p.age} ans — ${p.scenario}.`,
      "[ALERTE] Fibrillation ventriculaire (FV) détectée.",
      "[PROTOCOLE] Défibrillation immédiate requise (200 J).",
    ],
  };
}

function die(core: CardiacCore, reason: string): CardiacCore {
  return {
    ...core,
    health: 0,
    rhythm: "ASYSTOLE",
    status: "lost",
    logs: [...core.logs, reason],
  };
}

/** Fait avancer le temps de `elapsed` secondes réelles, tour par tour. */
export function advanceTime(core: CardiacCore, elapsed: number): CardiacCore {
  if (core.status !== "active" || elapsed <= 0) return core;
  const next: CardiacCore = { ...core, logs: [...core.logs] };
  const spent = Math.min(Math.floor(elapsed), next.time_remaining);
  next.time_remaining -= spent;

  const turns = Math.floor(spent / TURN_SECONDS);
  for (let i = 0; i < turns; i++) {
    if (next.rhythm === "VFIB") next.health = Math.max(0, next.health - 4);
    else if (next.rhythm === "NORMAL") next.health = Math.min(100, next.health + 2);
  }
  if (turns > 0 && next.rhythm === "VFIB") {
    next.logs.push(`[MONITEUR] ${turns} tour(s) écoulé(s) — perfusion en baisse, santé ${next.health}%.`);
  }

  if (next.health <= 0) return die(next, "[DÉCÈS] Asystolie irréversible. Patient décédé.");
  if (next.time_remaining <= 0) {
    return die(next, "[TEMPS ÉCOULÉ] Arrêt prolongé sans reprise — patient décédé.");
  }
  return next;
}

export function applyAction(core: CardiacCore, action: CardiacAction): CardiacCore {
  if (core.status !== "active") return core;
  const next: CardiacCore = { ...core, logs: [...core.logs] };

  if (action === "SHOCK") {
    next.shock_count += 1;
    if (next.rhythm !== "VFIB") {
      next.logs.push("[ERREUR] Choc inutile : rythme non choquable (risque de lésion myocardique).");
      next.health = Math.max(0, next.health - 8);
    } else {
      const chance = next.shock_count === 1 ? 0.55 : Math.min(0.85, 0.4 + next.shock_count * 0.12);
      if (Math.random() < chance) {
        next.rhythm = "NORMAL";
        next.health = Math.min(100, next.health + 15);
        next.status = "won";
        next.logs.push("[SUCCÈS] Choc efficace — rythme sinusal rétabli. RACS obtenu.");
      } else {
        next.health = Math.max(0, next.health - 3);
        next.logs.push("[ÉCHEC] Choc délivré, la FV persiste. Reprendre la RCP 2 min.");
      }
    }
  } else if (action === "MEDS") {
    next.health = Math.min(100, next.health + 10);
    next.logs.push("[TRAITEMENT] Adrénaline 1 mg IV/IO administrée.");
  } else if (action === "CPR") {
    next.health = Math.min(100, next.health + 6);
    next.logs.push("[RCP] Compressions 30:2, 100-120/min — perfusion maintenue.");
  } else {
    next.logs.push("[ATTENTE] Aucune action : le temps joue contre le patient.");
  }

  if (next.health <= 0) return die(next, "[DÉCÈS] Asystolie irréversible. Patient décédé.");
  return next;
}

export function statusLabel(s: CardiacStatus): string {
  return s === "active" ? "En cours" : s === "won" ? "Stabilisé" : "Décédé";
}
