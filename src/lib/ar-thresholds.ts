/**
 * Explicit pass/fail thresholds for the AR Web → AR → Web smoke test.
 *
 * A run passes when EVERY threshold below holds. Steps must all be `ok`,
 * but a run can still fail purely on rendering metrics (e.g. average FPS
 * too low or excessive frame drops). Persisted in localStorage so the
 * user can adjust them per device class.
 */
import type { ARTestReport } from "./ar-test";

export type ARThresholds = {
  minAverageFps: number;
  minLowestFps: number;
  maxFrameDrops: number;
  maxSwapDurationMs: number;
};

export const AR_THRESHOLD_DEFAULTS: ARThresholds = {
  minAverageFps: 30,
  minLowestFps: 20,
  maxFrameDrops: 3,
  maxSwapDurationMs: 4000,
};

const KEY = "doctorai_ar_thresholds_v1";

export function getARThresholds(): ARThresholds {
  if (typeof window === "undefined") return AR_THRESHOLD_DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return AR_THRESHOLD_DEFAULTS;
    return { ...AR_THRESHOLD_DEFAULTS, ...(JSON.parse(raw) as Partial<ARThresholds>) };
  } catch {
    return AR_THRESHOLD_DEFAULTS;
  }
}

export function setARThresholds(patch: Partial<ARThresholds>) {
  const next = { ...getARThresholds(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* quota */ }
  return next;
}

export type ThresholdCheck = {
  key: keyof ARThresholds;
  label: string;
  ok: boolean;
  actual: number;
  expected: string;
};

export type ARVerdict = {
  passed: boolean;
  stepsOk: boolean;
  metricsOk: boolean;
  checks: ThresholdCheck[];
};

export function evaluateReport(report: ARTestReport, thresholds = getARThresholds()): ARVerdict {
  const m = report.metrics;
  const checks: ThresholdCheck[] = [
    {
      key: "minAverageFps",
      label: "FPS moyen",
      ok: m.averageFps >= thresholds.minAverageFps,
      actual: m.averageFps,
      expected: `≥ ${thresholds.minAverageFps}`,
    },
    {
      key: "minLowestFps",
      label: "FPS minimum",
      ok: m.minFps === 0 ? true : m.minFps >= thresholds.minLowestFps,
      actual: m.minFps,
      expected: `≥ ${thresholds.minLowestFps}`,
    },
    {
      key: "maxFrameDrops",
      label: "Frame drops",
      ok: m.frameDrops <= thresholds.maxFrameDrops,
      actual: m.frameDrops,
      expected: `≤ ${thresholds.maxFrameDrops}`,
    },
    {
      key: "maxSwapDurationMs",
      label: "Durée swap",
      ok: m.swapDurationMs <= thresholds.maxSwapDurationMs,
      actual: Math.round(m.swapDurationMs),
      expected: `≤ ${thresholds.maxSwapDurationMs}ms`,
    },
  ];
  const stepsOk = report.steps.every((s) => s.ok);
  const metricsOk = checks.every((c) => c.ok);
  return { passed: stepsOk && metricsOk, stepsOk, metricsOk, checks };
}
