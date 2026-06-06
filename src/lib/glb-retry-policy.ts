/**
 * Configurable retry / exponential-backoff policy for GLB downloads.
 *
 * Exposed as a tiny pub-sub store so the loading overlay can also
 * surface the live retry count and the active policy.
 */

export type RetryPolicy = {
  maxRetries: number;     // total attempts INCLUDING the first one
  baseDelayMs: number;    // first backoff (attempt 1 -> 2)
  factor: number;         // exponential factor
  maxDelayMs: number;     // hard cap per backoff
};

export const RETRY_DEFAULTS: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 400,
  factor: 2,
  maxDelayMs: 4000,
};

const KEY = "doctorai_retry_policy_v1";

let state: RetryPolicy = load();
const listeners = new Set<() => void>();

function load(): RetryPolicy {
  if (typeof window === "undefined") return RETRY_DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return RETRY_DEFAULTS;
    return { ...RETRY_DEFAULTS, ...(JSON.parse(raw) as Partial<RetryPolicy>) };
  } catch {
    return RETRY_DEFAULTS;
  }
}

export function getRetryPolicy(): RetryPolicy {
  return state;
}

export function setRetryPolicy(patch: Partial<RetryPolicy>) {
  state = { ...state, ...patch };
  if (typeof window !== "undefined") {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ }
  }
  listeners.forEach((l) => l());
}

export function subscribeRetry(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Compute the backoff (ms) BEFORE the next attempt, given the failed one. */
export function backoffFor(attempt: number, p: RetryPolicy = state): number {
  const delay = p.baseDelayMs * Math.pow(p.factor, Math.max(0, attempt - 1));
  return Math.min(p.maxDelayMs, delay);
}
