/**
 * GLB offline cache + progress + retry + per-model TTL.
 *
 * Strategy:
 *  1. Lookup the URL in the `glb-cache-v1` Cache Storage bucket (offline-first).
 *     If present and not expired → return a blob URL immediately (zero network).
 *  2. Otherwise fetch with byte-accurate progress reporting, retry up to N
 *     times with exponential backoff (resuming via Range requests when possible),
 *     then store the Response into the cache for subsequent loads.
 *
 * Each cached Response carries two custom headers used to enforce per-model TTL:
 *   - `x-glb-cached-at` : epoch ms when the entry was written
 *   - `x-glb-ttl-ms`    : lifetime in ms (0 / absent = never expire)
 *
 * All measurements are emitted to the diagnostics store so the diagnostics
 * panel can render real load time / asset size / cache hit ratio.
 */

import { recordGLBLoad, recordGLBError } from "./glb-diagnostics";
import { backoffFor, getRetryPolicy } from "./glb-retry-policy";

const CACHE_NAME = "glb-cache-v1";

/** Default lifetime for cached GLBs (7 days). Override per call via `ttlMs`. */
export const DEFAULT_GLB_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type FetchProgress = {
  loaded: number;       // bytes downloaded so far
  total: number | null; // total bytes (null if server omits Content-Length)
  stage: "idle" | "cache-lookup" | "downloading" | "decoding" | "ready" | "error" | "retrying";
  attempt: number;
  /** True when the current download is resuming from a previously buffered offset via HTTP Range. */
  resumed?: boolean;
  error?: string;
};

export type FetchOptions = {
  onProgress?: (p: FetchProgress) => void;
  signal?: AbortSignal;
  /** Override the TTL for this URL. 0 = never expire. */
  ttlMs?: number;
};

const cachesAvailable = () =>
  typeof window !== "undefined" && "caches" in window && "Cache" in window;

async function openCache(): Promise<Cache | null> {
  if (!cachesAvailable()) return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

function readCacheMeta(res: Response): { cachedAt: number | null; ttlMs: number } {
  const ca = res.headers.get("x-glb-cached-at");
  const ttl = res.headers.get("x-glb-ttl-ms");
  return {
    cachedAt: ca ? parseInt(ca, 10) : null,
    ttlMs: ttl ? parseInt(ttl, 10) : 0,
  };
}

function isExpired(res: Response): boolean {
  const { cachedAt, ttlMs } = readCacheMeta(res);
  if (!cachedAt || !ttlMs) return false;
  return Date.now() - cachedAt > ttlMs;
}

/** Wrap a network Response with the TTL/timestamp headers we use for cache freshness. */
async function tagWithMeta(res: Response, ttlMs: number): Promise<Response> {
  const blob = await res.clone().blob();
  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "model/gltf-binary",
      "Content-Length": String(blob.size),
      "x-glb-cached-at": String(Date.now()),
      "x-glb-ttl-ms": String(ttlMs),
    },
  });
}

/** Check whether a model is already cached offline (regardless of TTL). */
export async function isCached(url: string): Promise<boolean> {
  const c = await openCache();
  if (!c) return false;
  const hit = await c.match(url);
  return !!hit;
}

/** Pre-warm the cache without returning a URL. Honors TTL. */
export async function prefetchGLB(url: string, ttlMs = DEFAULT_GLB_TTL_MS): Promise<void> {
  const c = await openCache();
  if (!c) return;
  const hit = await c.match(url);
  if (hit && !isExpired(hit)) return;
  try {
    const res = await fetch(url);
    if (res.ok) await c.put(url, await tagWithMeta(res, ttlMs));
  } catch {
    /* swallow — caller can retry later */
  }
}

/**
 * Stream-fetch a URL with byte progress + optional Range resume.
 *
 * `resumeFrom` carries any bytes already buffered from a previous failed
 * attempt. If the server replies 206 Partial Content we keep them; if it
 * replies 200 (range ignored) we restart cleanly from zero.
 */
async function fetchWithProgress(
  url: string,
  opts: FetchOptions,
  attempt: number,
  resumeFrom: { chunks: Uint8Array[]; loaded: number; total: number | null },
): Promise<{ response: Response; resumed: boolean }> {
  const headers: HeadersInit = {};
  const wantsRange = resumeFrom.loaded > 0;
  if (wantsRange) {
    headers["Range"] = `bytes=${resumeFrom.loaded}-`;
  }
  const res = await fetch(url, { signal: opts.signal, headers });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  // 206 → server honored Range; keep previously buffered chunks.
  // 200 → server ignored Range; discard and restart.
  const partial = res.status === 206 && wantsRange;
  const chunks: Uint8Array[] = partial ? resumeFrom.chunks.slice() : [];
  let loaded = partial ? resumeFrom.loaded : 0;

  let total: number | null = resumeFrom.total;
  if (partial) {
    const cr = res.headers.get("Content-Range");
    const m = cr && /\/(\d+)$/.exec(cr);
    if (m) total = parseInt(m[1], 10);
  } else {
    const cl = res.headers.get("Content-Length");
    total = cl ? parseInt(cl, 10) : null;
  }

  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      opts.onProgress?.({ loaded, total, stage: "downloading", attempt, resumed: partial });
    }
  }

  resumeFrom.chunks = chunks;
  resumeFrom.loaded = loaded;
  resumeFrom.total = total;

  const blob = new Blob(chunks as BlobPart[], {
    type: res.headers.get("Content-Type") ?? "model/gltf-binary",
  });
  const response = new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": blob.type,
      "Content-Length": String(blob.size),
    },
  });
  return { response, resumed: partial };
}

/**
 * Public API: returns a blob: URL that the GLTF loader can consume.
 * Honors the offline cache, reports progress, retries with exponential
 * backoff, and resumes interrupted downloads via Range requests.
 */
export async function fetchGLBWithCache(
  url: string,
  opts: FetchOptions = {},
): Promise<{ blobUrl: string; bytes: number; cacheHit: boolean; elapsedMs: number; expired: boolean }> {
  const t0 = performance.now();
  const ttlMs = opts.ttlMs ?? DEFAULT_GLB_TTL_MS;
  opts.onProgress?.({ loaded: 0, total: null, stage: "cache-lookup", attempt: 0 });

  const cache = await openCache();
  let response: Response | null = null;
  let cacheHit = false;
  let expired = false;

  if (cache) {
    const hit = await cache.match(url);
    if (hit) {
      if (isExpired(hit)) {
        expired = true;
        await cache.delete(url);
      } else {
        response = hit;
        cacheHit = true;
      }
    }
  }

  if (!response) {
    const resume = { chunks: [] as Uint8Array[], loaded: 0, total: null as number | null };
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { response: fresh } = await fetchWithProgress(url, opts, attempt, resume);
        if (cache) {
          try { await cache.put(url, await tagWithMeta(fresh.clone(), ttlMs)); } catch { /* quota */ }
        }
        response = fresh;
        break;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        recordGLBError({ url, message: msg, attempt });
        if (attempt < MAX_RETRIES) {
          const backoff = 400 * 2 ** (attempt - 1);
          opts.onProgress?.({
            loaded: resume.loaded,
            total: resume.total,
            stage: "retrying",
            attempt,
            resumed: resume.loaded > 0,
            error: msg,
          });
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }
    if (!response) {
      const msg = lastErr instanceof Error ? lastErr.message : "network error";
      opts.onProgress?.({ loaded: resume.loaded, total: resume.total, stage: "error", attempt: MAX_RETRIES, error: msg });
      throw new Error(`GLB download failed after ${MAX_RETRIES} attempts: ${msg}`);
    }
  }

  opts.onProgress?.({ loaded: 0, total: null, stage: "decoding", attempt: 0 });
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const elapsedMs = performance.now() - t0;

  opts.onProgress?.({ loaded: blob.size, total: blob.size, stage: "ready", attempt: 0 });
  recordGLBLoad({ url, bytes: blob.size, elapsedMs, cacheHit });

  return { blobUrl, bytes: blob.size, cacheHit, elapsedMs, expired };
}


/** Wipe the offline GLB cache (debug button). */
export async function clearGLBCache(): Promise<void> {
  if (!cachesAvailable()) return;
  await caches.delete(CACHE_NAME);
}

export type CachedEntry = {
  url: string;
  bytes: number;
  contentType: string;
  cachedAt: number | null;
  ttlMs: number;
  expiresAt: number | null;
  expired: boolean;
};

/** List every URL stored in the offline cache (with byte size + TTL info). */
export async function listCachedGLBs(): Promise<CachedEntry[]> {
  const c = await openCache();
  if (!c) return [];
  const reqs = await c.keys();
  const out: CachedEntry[] = [];
  for (const r of reqs) {
    try {
      const res = await c.match(r);
      if (!res) continue;
      const { cachedAt, ttlMs } = readCacheMeta(res);
      const blob = await res.clone().blob();
      const expiresAt = cachedAt && ttlMs ? cachedAt + ttlMs : null;
      out.push({
        url: r.url,
        bytes: blob.size,
        contentType: blob.type,
        cachedAt,
        ttlMs,
        expiresAt,
        expired: expiresAt ? Date.now() > expiresAt : false,
      });
    } catch { /* skip */ }
  }
  return out;
}

/** Drop a single entry from the cache. */
export async function deleteCachedGLB(url: string): Promise<boolean> {
  const c = await openCache();
  if (!c) return false;
  return c.delete(url);
}

/** Force-refresh a cached URL (delete then refetch). */
export async function refreshCachedGLB(url: string, ttlMs = DEFAULT_GLB_TTL_MS): Promise<void> {
  await deleteCachedGLB(url);
  await prefetchGLB(url, ttlMs);
}
