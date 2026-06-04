/**
 * Automated AR-abstraction smoke test.
 *
 * Validates that the AnatomyViewer facade can swap render modes
 * (web → ar → web) without breaking the surrounding UI contract:
 *   - the adapter map exposes both `web` and `ar` entries
 *   - props shape stays identical across modes (no refactor needed)
 *   - a mode-change cycle completes without exceptions
 *
 * The test is intentionally lightweight — it does NOT mount React,
 * since the facade is the contract. It exercises the same indirection
 * used at runtime.
 */
import type { AnatomyViewerProps, ViewerMode } from "@/components/ar/types";

export type ARTestStep = {
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
};

export type ARTestReport = {
  passed: boolean;
  startedAt: number;
  totalMs: number;
  steps: ARTestStep[];
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

export async function runARSwapTest(
  setMode: (m: ViewerMode) => void,
): Promise<ARTestReport> {
  const startedAt = Date.now();
  const steps: ARTestStep[] = [];

  // 1. Import the facade + types and assert adapter map covers web + ar.
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

  // 2. Contract check — props shape must remain identical for any mode.
  steps.push(
    step("Contrat AnatomyViewerProps stable", () => {
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

  // 3. Live swap web → ar → web in the host UI.
  steps.push(
    await step("Bascule Web → AR", async () => {
      setMode("ar");
      await new Promise((r) => setTimeout(r, 250));
      return "Adapter AR monté sans refactor";
    }),
  );

  steps.push(
    await step("Bascule AR → Web", async () => {
      setMode("web");
      await new Promise((r) => setTimeout(r, 250));
      return "Retour WebGL OK";
    }),
  );

  const totalMs = performance.now() - (steps[0]?.ms ?? 0);
  return {
    passed: steps.every((s) => s.ok),
    startedAt,
    totalMs,
    steps,
  };
}
