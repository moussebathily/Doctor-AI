import { HumanBody3D } from "@/components/HumanBody3D";
import type { AnatomyViewerProps } from "./types";

/**
 * Web/WebGL adapter — wraps the existing Three.js HumanBody3D component.
 * Streaming GLB load (Draco + Meshopt + KTX2), DPR-capped Canvas, and an
 * SSR-safe progress overlay are all handled inside HumanBody3D.
 */
export function WebViewerAdapter(props: AnatomyViewerProps) {
  const { mode: _ignored, ...rest } = props;
  return <HumanBody3D {...rest} />;
}
