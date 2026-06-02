import { lazy, Suspense } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import type { AnatomyViewerProps, ViewerAdapter, ViewerMode } from "./types";
import { ViroARAdapter } from "./ViroARAdapter";

// Lazy-load the WebGL adapter so the Three.js bundle stays out of the
// initial JS chunk (matters on mobile). The AR stub is tiny → eager.
const WebViewerAdapter = lazy(() =>
  import("./WebViewerAdapter").then((m) => ({ default: m.WebViewerAdapter })),
);

const adapters: Record<ViewerMode, ViewerAdapter> = {
  web: WebViewerAdapter as unknown as ViewerAdapter,
  ar: ViroARAdapter,
  webxr: WebViewerAdapter as unknown as ViewerAdapter, // wired later
};

/**
 * Facade component. UI panels import THIS, not the underlying engine.
 * Swap `mode` at runtime to switch between web rendering and native AR
 * without any change to the surrounding layout, steps, IA, or monitor.
 */
export function AnatomyViewer(props: AnatomyViewerProps) {
  const Adapter = adapters[props.mode ?? "web"] ?? WebViewerAdapter;
  return (
    <ClientOnly fallback={<div className={`w-full ${props.height ?? "h-[480px]"} rounded-2xl bg-muted animate-pulse`} />}>
      <Suspense fallback={<div className={`w-full ${props.height ?? "h-[480px]"} rounded-2xl bg-muted animate-pulse`} />}>
        <Adapter {...props} />
      </Suspense>
    </ClientOnly>
  );
}

export type { AnatomyViewerProps, ViewerMode } from "./types";
