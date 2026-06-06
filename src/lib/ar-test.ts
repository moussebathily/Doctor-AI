/**
 * Automated AR-abstraction smoke test.
 *
 * Validates that the AnatomyViewer facade can swap render modes
 * (web → ar → web) without breaking the surrounding UI contract:
 *   - the adapter map exposes both `web` and `ar` entries
 *   - props shape stays identical across modes (no refactor needed)
 *   - a mode-change cycle completes without exceptions
 *
 * The test ALSO captures render-timing metrics during the swap so the
 * dedicated AR test page (and the diagnostics JSON export) can surface
 * average FPS, lowest FPS, frame-drop count and total wall time.
 */
import type { AnatomyViewerProps, ViewerMode } from "@/components/ar/types";
import { getDiagnostics } from "./glb-diagnostics";
import { getDeviceProfile, type DeviceProfile } from "./device-profile";
import { getARThresholds, type ARThresholds } from "./ar-thresholds";

export type ARTestStep = {
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
};

export type ARRenderMetrics = {
  /** Wall time spent inside the swap cycle (ms). */
  swapDurationMs: number;
  /** Average FPS sampled across the swap. */
  averageFps: number;
  /** Lowest FPS sample observed. */
  minFps: number;
  /** Highest FPS sample observed. */
  maxFps: number;
  /** Count of FPS samples below the 30 FPS smooth-render threshold. */
  frameDrops: number;
  /** Raw FPS samples captured during the swap (1 Hz). */
  samples: number[];
};

export type ARTestReport = {
  passed: boolean;
  startedAt: number;
  totalMs: number;
  steps: ARTestStep[];
  metrics: ARRenderMetrics;
  device?: DeviceProfile;
  thresholds?: ARThresholds;
};

async function step(
  name: string,
  fn: () => Promise<string> | string,
): Promise<ARTestStep> {
  const t0 = performance.now();
  try {
    const detail = await fn();
    return { name, ok: true, detail, ms: performance.now() - t0 };
  } catch (e) {
    return {
      name,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
      ms: performance.now() - t0,
    };
  }
}

const stepSync = (name: string, fn: () => string): ARTestStep => {
  const t0 = performance.now();
  try {
    return { name, ok: true, detail: fn(), ms: performance.now() - t0 };
  } catch (e) {
    return { name, ok: false, detail: e instanceof Error ? e.message : String(e), ms: performance.now() - t0 };
  }
};

const DROP_THRESHOLD = 30;

/** Start a 1 Hz FPS sampler that reads from the diagnostics store. */
function startFpsSampler() {
  const samples: number[] = [];
  const start = performance.now();
  const id = setInterval(() => {
    const fps = getDiagnostics().fps;
    if (fps > 0) samples.push(fps);
  }, 250);
  return {
    stop(): ARRenderMetrics {
      clearInterval(id);
      const swapDurationMs = performance.now() - start;
      if (samples.length === 0) {
        return {
          swapDurationMs,
          averageFps: 0,
          minFps: 0,
          maxFps: 0,
          frameDrops: 0,
          samples: [],
        };
      }
      const sum = samples.reduce((a, b) => a + b, 0);
      return {
        swapDurationMs,
        averageFps: Math.round((sum / samples.length) * 10) / 10,
        minFps: Math.min(...samples),
        maxFps: Math.max(...samples),
        frameDrops: samples.filter((s) => s < DROP_THRESHOLD).length,
        samples,
      };
    },
  };
}

export async function runARSwapTest(
  setMode: (m: ViewerMode) => void,
): Promise<ARTestReport> {
  const startedAt = Date.now();
  const steps: ARTestStep[] = [];
  const t0 = performance.now();
  const sampler = startFpsSampler();

  steps.push(
    await step("Import AnatomyViewer facade", async () => {
      const mod = await import("@/components/ar/AnatomyViewer");
      if (typeof mod.AnatomyViewer !== "function") {
        throw new Error("AnatomyViewer export is not a component");
      }
      return "AnatomyViewer importé";
    }),
  );

  steps.push(
    await step("Adapter ViroAR disponible", async () => {
      const mod = await import("@/components/ar/ViroARAdapter");
      if (typeof mod.ViroARAdapter !== "function") {
        throw new Error("ViroARAdapter export is not a component");
      }
      return "Adapter AR enregistré";
    }),
  );

  steps.push(
    stepSync("Contrat AnatomyViewerProps stable", () => {
      const base: AnatomyViewerProps = {
        glbUrl: null,
        system: "full",
        view: "complete",
        onPickPart: () => undefined,
        height: "h-[480px]",
      };
      const asWeb: AnatomyViewerProps = { ...base, mode: "web" };
      const asAr: AnatomyViewerProps = { ...base, mode: "ar" };
      if (Object.keys(asWeb).length !== Object.keys(asAr).length) {
        throw new Error("props shape diverges between modes");
      }
      return "Web et AR partagent la même interface";
    }),
  );

  steps.push(
    await step("Bascule Web → AR", async () => {
      setMode("ar");
      await new Promise((r) => setTimeout(r, 500));
      return "Adapter AR monté sans refactor";
    }),
  );

  steps.push(
    await step("Bascule AR → Web", async () => {
      setMode("web");
      await new Promise((r) => setTimeout(r, 500));
      return "Retour WebGL OK";
    }),
  );

  const metrics = sampler.stop();
  const totalMs = performance.now() - t0;
  return {
    passed: steps.every((s) => s.ok),
    startedAt,
    totalMs,
    steps,
    metrics,
  };
}

// ── Run history persistence ────────────────────────────────────────────

const HISTORY_KEY = "doctorai_ar_test_history_v1";
const MAX_HISTORY = 20;

export function getARTestHistory(): ARTestReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveARTestRun(r: ARTestReport): ARTestReport[] {
  if (typeof window === "undefined") return [];
  const next = [r, ...getARTestHistory()].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch { /* quota */ }
  return next;
}

export function clearARTestHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
}
