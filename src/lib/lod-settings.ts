/**
 * LOD (level-of-detail) progressive loading settings.
 *
 * The viewer first renders a low-quality variant (flat shading, no envmap,
 * capped DPR) then upgrades to high quality after `upgradeDelayMs`.
 * These knobs let the user fine-tune the trade-off per device class.
 *
 * Persisted in localStorage; exposed as a pub-sub store so any component
 * (settings UI in diagnostics, HumanBody3D viewer) stays in sync.
 */

export type LodSettings = {
  upgradeDelayMs: number; // delay before upgrading low→high
  lowDprMax: number;      // DPR cap during low-quality phase
  highDprMax: number;     // DPR cap during high-quality phase
  highQualityEnabled: boolean; // disable to permanently stay low (very weak devices)
};

const DEFAULTS: LodSettings = {
  upgradeDelayMs: 700,
  lowDprMax: 1,
  highDprMax: 1.75,
  highQualityEnabled: true,
};

const KEY = "doctorai_lod_settings_v1";

function load(): LodSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<LodSettings>) };
  } catch {
    return DEFAULTS;
  }
}

let state: LodSettings = load();
const listeners = new Set<() => void>();

export function getLodSettings(): LodSettings {
  return state;
}

export function setLodSettings(patch: Partial<LodSettings>) {
  state = { ...state, ...patch };
  if (typeof window !== "undefined") {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ }
  }
  listeners.forEach((l) => l());
}

export function resetLodSettings() {
  setLodSettings(DEFAULTS);
}

export function subscribeLod(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const LOD_DEFAULTS = DEFAULTS;
