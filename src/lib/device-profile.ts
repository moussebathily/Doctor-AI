/**
 * Lightweight device fingerprint used to group AR diagnostics
 * by device model and surface per-device historical trends.
 *
 * We deliberately avoid PII / fingerprinting trackers: only a
 * coarse model string is derived from `navigator.userAgent`
 * plus a device class (mobile / tablet / desktop) hint.
 */

export type DeviceProfile = {
  /** Stable id derived from model + class (used as group key). */
  id: string;
  /** Human-readable model label (e.g. "iPhone 15 Pro", "Pixel 8", "Desktop · Chrome"). */
  model: string;
  /** Coarse class. */
  class: "mobile" | "tablet" | "desktop";
  /** Browser engine label (Chrome / Safari / Firefox / Edge / Other). */
  browser: string;
  /** Operating-system label. */
  os: string;
  /** Hardware concurrency (CPU threads). */
  cores: number;
  /** Reported device memory in GB (Chrome only — null elsewhere). */
  memoryGb: number | null;
  /** Captured viewport in CSS px at the time of profiling. */
  viewport: { w: number; h: number };
  /** Device pixel ratio at the time of profiling. */
  dpr: number;
};

function classify(w: number, ua: string): DeviceProfile["class"] {
  if (/iPad|Tablet/i.test(ua) || (w >= 600 && w < 1100 && /Mobile|Android/i.test(ua))) return "tablet";
  if (w < 768 || /Mobile|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return "Other";
}

function detectOs(ua: string): string {
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Mac OS X (\d+[._]\d+)/.test(ua)) return "macOS";
  if (/Android (\d+)/.test(ua)) return "Android " + RegExp.$1;
  if (/iPhone OS (\d+)_/.test(ua)) return "iOS " + RegExp.$1;
  if (/iPad; CPU OS (\d+)_/.test(ua)) return "iPadOS " + RegExp.$1;
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}

function detectModel(ua: string, klass: DeviceProfile["class"], browser: string, os: string): string {
  // Apple devices expose model hints via UA tokens.
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  // Android devices include the marketing name between "; " and " Build/".
  const am = ua.match(/Android [^;]+; ([^)]+?)(?: Build\/[^)]+)?\)/);
  if (am && am[1]) return am[1].trim();
  if (klass === "tablet") return `Tablet · ${browser}`;
  if (klass === "mobile") return `Mobile · ${browser}`;
  return `${os} · ${browser}`;
}

let cached: DeviceProfile | null = null;

export function getDeviceProfile(): DeviceProfile {
  if (cached) return cached;
  if (typeof window === "undefined") {
    cached = {
      id: "ssr",
      model: "SSR",
      class: "desktop",
      browser: "Other",
      os: "Other",
      cores: 1,
      memoryGb: null,
      viewport: { w: 0, h: 0 },
      dpr: 1,
    };
    return cached;
  }
  const ua = navigator.userAgent;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const klass = classify(w, ua);
  const browser = detectBrowser(ua);
  const os = detectOs(ua);
  const model = detectModel(ua, klass, browser, os);
  cached = {
    id: `${model}__${klass}`.toLowerCase().replace(/\s+/g, "-"),
    model,
    class: klass,
    browser,
    os,
    cores: navigator.hardwareConcurrency || 1,
    memoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    viewport: { w, h },
    dpr: window.devicePixelRatio || 1,
  };
  return cached;
}
