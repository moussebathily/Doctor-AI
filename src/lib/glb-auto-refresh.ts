/**
 * Per-model auto-refresh registry.
 *
 * The cache page exposes a toggle per cached GLB. When enabled, any
 * entry whose TTL has elapsed is silently re-downloaded in the
 * background on the next `runAutoRefresh()` pass (called when the
 * cache page mounts and on a coarse interval).
 */
import { listCachedGLBs, refreshCachedGLB } from "./glb-cache";

const KEY = "doctorai_auto_refresh_models_v1";

type Registry = Record<string, boolean>;

function load(): Registry {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Registry) : {};
  } catch {
    return {};
  }
}

let registry: Registry = load();
const listeners = new Set<() => void>();

export function isAutoRefreshEnabled(url: string): boolean {
  return registry[url] ?? true; // opt-out: default ON for cached models
}

export function setAutoRefresh(url: string, enabled: boolean) {
  registry = { ...registry, [url]: enabled };
  if (typeof window !== "undefined") {
    try { localStorage.setItem(KEY, JSON.stringify(registry)); } catch { /* quota */ }
  }
  listeners.forEach((l) => l());
}

export function subscribeAutoRefresh(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

let running = false;

/** Re-fetch every expired entry whose URL is opted-in. */
export async function runAutoRefresh(): Promise<{ refreshed: string[] }> {
  if (running) return { refreshed: [] };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { refreshed: [] };
  running = true;
  const refreshed: string[] = [];
  try {
    const entries = await listCachedGLBs();
    for (const e of entries) {
      if (!e.expired) continue;
      if (!isAutoRefreshEnabled(e.url)) continue;
      try {
        await refreshCachedGLB(e.url);
        refreshed.push(e.url);
      } catch { /* ignore — try again next sweep */ }
    }
  } finally {
    running = false;
  }
  return { refreshed };
}
