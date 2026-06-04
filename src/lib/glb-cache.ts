/**
 * GLB offline cache + progress + retry.
 *
 * Strategy:
 *  1. Lookup the URL in the `glb-cache-v1` Cache Storage bucket (offline-first).
 *     If present → return a blob URL immediately (zero network).
 *  2. Otherwise fetch with byte-accurate progress reporting, retry up to N
 *     times with exponential backoff, then store the Response into the cache
 *     for subsequent loads.
 *
 * All measurements are emitted to the diagnostics store so the diagnostics
 * panel can render real load time / asset size / cache hit ratio.
 */

import { recordGLBLoad, recordGLBError } from "./glb-diagnostics";

const CACHE_NAME = "glb-cache-v1";
const MAX_RETRIES = 3;

export type FetchProgress = {
  loaded: number;       // bytes downloaded so far
  total: number | null; // total bytes (null if server omits Content-Length)
  stage: "idle" | "cache-lookup" | "downloading" | "decoding" | "ready" | "error" | "retrying";
  attempt: number;
  error?: string;
};

export type FetchOptions = {
  onProgress?: (p: FetchProgress) => void;
  signal?: AbortSignal;
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

/** Check whether a model is already cached offline. */
export async function isCached(url: string): Promise<boolean> {
  const c = await openCache();
  if (!c) return false;
  const hit = await c.match(url);
  return !!hit;
}

/** Pre-warm the cache without returning a URL. */
export async function prefetchGLB(url: string): Promise<void> {
  const c = await openCache();
  if (!c) return;
  const hit = await c.match(url);
  if (hit) return;
  try {
    const res = await fetch(url);
    if (res.ok) await c.put(url, res.clone());
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
): Promise<Response> {
  const headers: HeadersInit = {};
  if (resumeFrom.loaded > 0) {
    headers["Range"] = `bytes=${resumeFrom.loaded}-`;
  }
  const res = await fetch(url, { signal: opts.signal, headers });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  // 206 → server honored Range; keep previously buffered chunks.
  // 200 → server ignored Range; discard and restart.
  const partial = res.status === 206 && resumeFrom.loaded > 0;
  const chunks: Uint8Array[] = partial ? resumeFrom.chunks.slice() : [];
  let loaded = partial ? resumeFrom.loaded : 0;

  let total: number | null = resumeFrom.total;
  if (partial) {
    // Content-Range: bytes start-end/total
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
      opts.onProgress?.({ loaded, total, stage: "downloading", attempt });
    }
  }

  // Persist the running buffer so a later retry can resume from here.
  resumeFrom.chunks = chunks;
  resumeFrom.loaded = loaded;
  resumeFrom.total = total;

  const blob = new Blob(chunks as BlobPart[], {
    type: res.headers.get("Content-Type") ?? "model/gltf-binary",
  });
  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": blob.type,
      "Content-Length": String(blob.size),
    },
  });
}

/**
 * Public API: returns a blob: URL that the GLTF loader can consume.
 * Honors the offline cache, reports progress, retries with exponential
 * backoff, and resumes interrupted downloads via Range requests.
 */
export async function fetchGLBWithCache(
  url: string,
  opts: FetchOptions = {},
): Promise<{ blobUrl: string; bytes: number; cacheHit: boolean; elapsedMs: number }> {
  const t0 = performance.now();
  opts.onProgress?.({ loaded: 0, total: null, stage: "cache-lookup", attempt: 0 });

  const cache = await openCache();
  let response: Response | null = null;
  let cacheHit = false;

  if (cache) {
    const hit = await cache.match(url);
    if (hit) {
      response = hit;
      cacheHit = true;
    }
  }

  if (!response) {
    const resume = { chunks: [] as Uint8Array[], loaded: 0, total: null as number | null };
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        response = await fetchWithProgress(url, opts, attempt, resume);
        if (cache) {
          try { await cache.put(url, response.clone()); } catch { /* quota */ }
        }
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

  return { blobUrl, bytes: blob.size, cacheHit, elapsedMs };
}


/** Wipe the offline GLB cache (debug button). */
export async function clearGLBCache(): Promise<void> {
  if (!cachesAvailable()) return;
  await caches.delete(CACHE_NAME);
}

export type CachedEntry = { url: string; bytes: number; contentType: string };

/** List every URL stored in the offline cache (with byte size). */
export async function listCachedGLBs(): Promise<CachedEntry[]> {
  const c = await openCache();
  if (!c) return [];
  const reqs = await c.keys();
  const out: CachedEntry[] = [];
  for (const r of reqs) {
    try {
      const res = await c.match(r);
      if (!res) continue;
      const blob = await res.clone().blob();
      out.push({ url: r.url, bytes: blob.size, contentType: blob.type });
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
export async function refreshCachedGLB(url: string): Promise<void> {
  await deleteCachedGLB(url);
  await prefetchGLB(url);
}

