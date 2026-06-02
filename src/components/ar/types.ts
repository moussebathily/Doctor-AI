import type { AnatomySystem, AnatomyView } from "@/components/simulation/SystemSidebar";

/**
 * Render mode for the anatomy viewer.
 * - `web`   : WebGL (Three.js / react-three-fiber) — current default
 * - `ar`    : Native AR (ViroReact + ARKit/ARCore) — wired later, no UI changes needed
 * - `webxr` : Browser WebXR session — optional future path
 */
export type ViewerMode = "web" | "ar" | "webxr";

/** Public, stable contract every viewer adapter must implement.
 *  UI panels (sidebar, steps, IA, monitor) talk ONLY to this interface, so
 *  swapping the WebGL adapter for a native ViroReact adapter requires zero
 *  UI refactor — just register a new adapter under `adapters[mode]`. */
export interface AnatomyViewerProps {
  /** Optional override URL for the GLB model. Falls back to demo model. */
  glbUrl?: string | null;
  /** Active anatomical system (drives mesh visibility/opacity). */
  system?: AnatomySystem;
  /** View mode (complete | transparent | organs | layers). */
  view?: AnatomyView;
  /** Highlight a logical organ key (used by the stylized fallback). */
  highlightOrgan?: "appendix" | "heart" | "bone" | "brain" | "lung" | null;
  /** Fired when the user taps/clicks any mesh — name comes from the GLB. */
  onPickPart?: (name: string) => void;
  /** Fired when an organ is selected (fallback stylized mode). */
  onSelectOrgan?: (organ: "appendix" | "heart" | "bone" | "brain" | "lung") => void;
  /** Tailwind height utility for the viewer container. */
  height?: string;
  /** Adapter selector — defaults to `"web"`. */
  mode?: ViewerMode;
}

/** Adapter component signature. Every adapter is a plain React component. */
export type ViewerAdapter = React.ComponentType<AnatomyViewerProps>;
