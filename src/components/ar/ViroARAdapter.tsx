import type { AnatomyViewerProps } from "./types";

/**
 * Native AR adapter STUB — placeholder so the UI can already select
 * `mode="ar"` without breaking. When the project is wrapped in a
 * React Native + ViroReact (ARKit/ARCore) shell, replace the body of
 * this component with a `<ViroARSceneNavigator>` that mounts a scene
 * rendering the GLB via `<Viro3DObject source={{ uri: glbUrl }} />`.
 *
 * The public props contract (`AnatomyViewerProps`) is identical to the
 * web adapter, so the surrounding sidebar / steps / IA / monitor panels
 * keep working unchanged — they only know about the abstract interface.
 *
 * Suggested wiring (pseudo-code, runs only inside a RN+Viro host):
 *
 *   import { ViroARSceneNavigator, ViroARScene, Viro3DObject, ViroAmbientLight }
 *     from "@reactvision/react-viro";
 *
 *   const Scene = ({ glbUrl, onPickPart }) => (
 *     <ViroARScene>
 *       <ViroAmbientLight color="#ffffff" />
 *       <Viro3DObject
 *         source={{ uri: glbUrl }}
 *         type="GLB"
 *         onClick={(_pos, src) => onPickPart?.(src?.name ?? "organ")}
 *       />
 *     </ViroARScene>
 *   );
 */
export function ViroARAdapter({ glbUrl, height = "h-[480px]" }: AnatomyViewerProps) {
  const url = glbUrl ?? "(modèle par défaut)";
  return (
    <div
      className={`w-full ${height} rounded-2xl border border-dashed border-teal/40 bg-slate-950 text-center flex flex-col items-center justify-center p-6 gap-2`}
    >
      <span className="text-xs uppercase tracking-widest text-teal font-semibold">Mode AR</span>
      <p className="text-sm text-foreground/80 max-w-sm">
        Le rendu AR (ARKit / ARCore via ViroReact) s'activera dans la coque mobile
        native. L'interface ne changera pas : seul l'adaptateur 3D est remplacé.
      </p>
      <code className="text-[10px] text-muted-foreground break-all">{url}</code>
    </div>
  );
}
