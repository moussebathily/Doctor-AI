// Bridge: Simulation → Pharmacy. Stores a "prefill" intent in localStorage
// that the Pharmacy page reads on mount to auto-add matching meds to the cart.

const KEY = "doctorai_pharmacy_prefill_v1";

export type PharmacyPrefill = {
  reason: string; // e.g. "Post-op appendicectomie"
  searchTerms: string[]; // medication names / categories to add (case-insensitive substring match)
  createdAt: number;
};

export function setPharmacyPrefill(p: Omit<PharmacyPrefill, "createdAt">) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify({ ...p, createdAt: Date.now() }));
}

export function consumePharmacyPrefill(): PharmacyPrefill | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  localStorage.removeItem(KEY);
  try {
    return JSON.parse(raw) as PharmacyPrefill;
  } catch {
    return null;
  }
}

// Default treatment suggestions per operation id (used as fallback if AI is unavailable)
export const DEFAULT_TREATMENTS: Record<string, { reason: string; terms: string[] }> = {
  appendicectomie: {
    reason: "Post-opératoire appendicectomie : antalgie + antibioprophylaxie",
    terms: ["paracetamol", "doliprane", "amoxicilline", "ibuprofen"],
  },
  "pontage-coronarien": {
    reason: "Post-pontage coronarien : antiagrégant + statine + bêta-bloquant",
    terms: ["aspirine", "clopidogrel", "atorvastatine", "bisoprolol"],
  },
  "fracture-tibia": {
    reason: "Post-ostéosynthèse tibia : antalgie + anticoagulation préventive",
    terms: ["paracetamol", "tramadol", "enoxaparine", "ibuprofen"],
  },
};
