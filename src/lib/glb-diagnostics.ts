/**
 * Lightweight diagnostics store for the anatomy viewer.
 *
 * Tracks per-load metrics (size, time, cache hit) and a rolling FPS sample
 * so the diagnostics panel can render real numbers — not estimates.
 *
 * Pure pub-sub on top of useSyncExternalStore. No deps.
 */

export type GLBLoadSample = {
  url: string;
  bytes: number;
  elapsedMs: number;
  cacheHit: boolean;
  at: number; // epoch ms
};

export type DeviceClass = "mobile" | "tablet" | "desktop";

export type Diagnostics = {
  loads: GLBLoadSample[];
  fps: number;
  frames: number;
  deviceClass: DeviceClass;
  dpr: number;
  viewport: { w: number; h: number };
  hardwareConcurrency: number;
  deviceMemoryGb: number | null;
  online: boolean;
};

const listeners = new Set<() => void>();
let state: Diagnostics = {
  loads: [],
  fps: 0,
  frames: 0,
  deviceClass: "desktop",
  dpr: 1,
  viewport: { w: 0, h: 0 },
  hardwareConcurrency: 1,
  deviceMemoryGb: null,
  online: true,
};

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getDiagnostics(): Diagnostics {
  return state;
}

export function recordGLBLoad(s: Omit<GLBLoadSample, "at">) {
  state.loads = [{ ...s, at: Date.now() }, ...state.loads].slice(0, 20);
  emit();
}

export function recordFps(fps: number, frames: number) {
  state.fps = fps;
  state.frames = frames;
  emit();
}

function classify(w: number): DeviceClass {
  if (w < 768) return "mobile";
  if (w < 1280) return "tablet";
  return "desktop";
}

/** Call once on the client to populate device info. */
export function initDiagnostics() {
  if (typeof window === "undefined") return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  state = {
    ...state,
    deviceClass: classify(w),
    dpr: window.devicePixelRatio || 1,
    viewport: { w, h },
    hardwareConcurrency: navigator.hardwareConcurrency || 1,
    // deviceMemory is a non-standard but widely supported hint (GB).
    deviceMemoryGb:
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    online: navigator.onLine,
  };
  window.addEventListener("online", () => { state.online = true; emit(); });
  window.addEventListener("offline", () => { state.online = false; emit(); });
  window.addEventListener("resize", () => {
    state.viewport = { w: window.innerWidth, h: window.innerHeight };
    state.deviceClass = classify(window.innerWidth);
    emit();
  });
  emit();
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
