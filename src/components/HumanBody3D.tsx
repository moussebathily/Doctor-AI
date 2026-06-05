import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Environment, useGLTF, Center } from "@react-three/drei";
import { DRACOLoader, KTX2Loader } from "three-stdlib";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";
import type { AnatomySystem, AnatomyView } from "@/components/simulation/SystemSidebar";
import { fetchGLBWithCache, prefetchGLB, type FetchProgress } from "@/lib/glb-cache";
import { initDiagnostics, recordFps } from "@/lib/glb-diagnostics";
import { getLodSettings, subscribeLod } from "@/lib/lod-settings";
import { AlertCircle, RefreshCw, Wifi, WifiOff, Repeat } from "lucide-react";

type OrganKey = "appendix" | "heart" | "bone" | "brain" | "lung";

// Default demo anatomical-ish GLB (Khronos sample, CORS-enabled). Easily
// replaceable by passing a custom `glbUrl` prop or via the sidebar input.
const DEFAULT_DEMO_GLB =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb";

// ───── GLB compression decoders (Draco + Meshopt + KTX2) ─────
const dracoLoader = new DRACOLoader().setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
const ktx2Loader = new KTX2Loader().setTranscoderPath("https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/");
const extendLoader = (loader: unknown) => {
  const g = loader as {
    setDRACOLoader?: (l: DRACOLoader) => void;
    setKTX2Loader?: (l: KTX2Loader) => void;
    setMeshoptDecoder?: (d: typeof MeshoptDecoder) => void;
  };
  g.setDRACOLoader?.(dracoLoader);
  g.setKTX2Loader?.(ktx2Loader);
  g.setMeshoptDecoder?.(MeshoptDecoder);
};

// Warm the offline cache for the demo model on import.
if (typeof window !== "undefined") {
  initDiagnostics();
  prefetchGLB(DEFAULT_DEMO_GLB).catch(() => undefined);
}

/**
 * Cache-aware GLB hook with byte-accurate progress + retry.
 * Returns a stable blob URL once download + cache settle.
 */
function useCachedGLB(url: string | null | undefined) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<FetchProgress>({
    loaded: 0, total: null, stage: "idle", attempt: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      setProgress({ loaded: 0, total: null, stage: "idle", attempt: 0 });
      return;
    }
    let revoke: string | null = null;
    const ac = new AbortController();
    setError(null);
    fetchGLBWithCache(url, { onProgress: setProgress, signal: ac.signal })
      .then((r) => { revoke = r.blobUrl; setBlobUrl(r.blobUrl); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      ac.abort();
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [url, reloadKey]);

  return {
    blobUrl,
    progress,
    error,
    retry: () => setReloadKey((k) => k + 1),
  };
}

/** Real progress overlay — bytes, attempt, error, retry. */
function GLBLoaderOverlay({
  progress, error, online, onRetry,
}: {
  progress: FetchProgress;
  error: string | null;
  online: boolean;
  onRetry: () => void;
}) {
  if (progress.stage === "ready" || progress.stage === "idle") return null;
  const pct = progress.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : null;
  const label =
    progress.stage === "cache-lookup" ? "Vérification du cache offline…" :
    progress.stage === "downloading" ? `Téléchargement modèle 3D${pct !== null ? ` ${pct}%` : "…"}` :
    progress.stage === "decoding" ? "Décodage du modèle…" :
    progress.stage === "retrying" ? `Nouvelle tentative (#${progress.attempt})…` :
    progress.stage === "error" ? "Échec du téléchargement" : "Chargement…";

  return (
    <div className="absolute inset-0 flex items-end justify-center pointer-events-none">
      <div className="m-3 px-3 py-2.5 rounded-lg bg-card/90 backdrop-blur border border-border text-xs font-medium shadow-lg flex flex-col gap-1.5 min-w-[240px] max-w-[90%] pointer-events-auto">
        <div className="flex items-center gap-2">
          {error || progress.stage === "error" ? (
            <AlertCircle className="w-3.5 h-3.5 text-destructive" />
          ) : online ? (
            <Wifi className="w-3.5 h-3.5 text-teal animate-pulse" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-warning" />
          )}
          <span className="flex-1 truncate">{label}</span>
          {progress.total && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {(progress.loaded / 1024 / 1024).toFixed(2)} / {(progress.total / 1024 / 1024).toFixed(2)} MB
            </span>
          )}
        </div>
        {pct !== null && (
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-teal transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
        {(error || progress.stage === "error") && (
          <button
            type="button"
            onClick={onRetry}
            className="self-start mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-teal hover:underline"
          >
            <RefreshCw className="w-3 h-3" /> Réessayer
          </button>
        )}
      </div>
    </div>
  );
}

/** In-canvas FPS sampler — pushes to diagnostics store. */
function FpsSampler() {
  const acc = useRef({ frames: 0, last: performance.now() });
  useFrame(() => {
    acc.current.frames += 1;
    const now = performance.now();
    if (now - acc.current.last >= 1000) {
      const fps = (acc.current.frames * 1000) / (now - acc.current.last);
      recordFps(Math.round(fps), acc.current.frames);
      acc.current.frames = 0;
      acc.current.last = now;
    }
  });
  return null;
}

// Heuristic name → system map.
const SYSTEM_KEYWORDS: Record<Exclude<AnatomySystem, "full">, string[]> = {
  digestive: ["stomach", "intestine", "colon", "liver", "pancreas", "esophagus", "appendix", "bowel", "gut"],
  skeletal: ["bone", "skeleton", "skull", "spine", "rib", "vertebra", "femur", "tibia", "pelvis"],
  muscular: ["muscle", "biceps", "triceps", "quad", "pec", "delt", "abs"],
  circulatory: ["heart", "vein", "artery", "vessel", "aorta", "blood", "cardio"],
  nervous: ["brain", "nerve", "spinal", "cortex", "cerebr"],
  respiratory: ["lung", "trachea", "bronchi", "pulmo", "diaphragm"],
  urinary: ["kidney", "bladder", "ureter", "renal", "urethr"],
};

function meshMatchesSystem(name: string, system: AnatomySystem): boolean {
  if (system === "full") return true;
  const n = name.toLowerCase();
  return SYSTEM_KEYWORDS[system].some((k) => n.includes(k));
}

function GLBModel({
  url, system, view, lowQuality, breathing = true, onPick,
}: {
  url: string;
  system: AnatomySystem;
  view: AnatomyView;
  lowQuality: boolean;
  breathing?: boolean;
  onPick?: (name: string) => void;
}) {
  const { scene } = useGLTF(url, true, true, extendLoader as never);
  const ref = useRef<THREE.Group>(null);

  useEffect(() => {
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      let composite = mesh.name;
      let p: THREE.Object3D | null = mesh.parent;
      while (p) { composite += " " + p.name; p = p.parent; }
      const inSystem = meshMatchesSystem(composite, system);
      mesh.visible = system === "full" || inSystem || view === "complete";

      const mat = mesh.material as THREE.Material | THREE.Material[];
      const apply = (m: THREE.Material) => {
        m.transparent = true;
        if (view === "transparent") m.opacity = inSystem ? 1 : 0.18;
        else if (view === "organs") m.opacity = inSystem ? 1 : 0.0;
        else if (view === "layers") m.opacity = inSystem ? 1 : 0.35;
        else m.opacity = inSystem || system === "full" ? 1 : 0.25;
        // LOD: skip costly PBR sampling on first frames.
        const std = m as THREE.MeshStandardMaterial;
        if ("roughness" in std) {
          std.flatShading = lowQuality;
        }
        m.needsUpdate = true;
      };
      if (Array.isArray(mat)) mat.forEach(apply);
      else apply(mat);
    });
  }, [scene, system, view, lowQuality]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.15;
    if (breathing) {
      const s = 1 + Math.sin(performance.now() / 900) * 0.02;
      ref.current.scale.set(s, s, s);
    }
  });

  return (
    <Center>
      <group
        ref={ref}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "default"; }}
        onClick={(e) => {
          e.stopPropagation();
          const obj = e.object as THREE.Object3D;
          let cur: THREE.Object3D | null = obj;
          let name = obj.name;
          while (cur && !name) { cur = cur.parent; name = cur?.name ?? ""; }
          onPick?.(name || "Partie anatomique");
        }}
      >
        <primitive object={scene} />
      </group>
    </Center>
  );
}

function Organ({
  position, color, scale = 1, highlighted, onClick, label, shape = "sphere",
}: {
  position: [number, number, number];
  color: string;
  scale?: number;
  highlighted: boolean;
  onClick: () => void;
  label: string;
  shape?: "sphere" | "cylinder" | "box";
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (highlighted && ref.current) {
      ref.current.rotation.y += delta * 0.5;
      const s = scale * (1 + Math.sin(performance.now() / 250) * 0.06);
      ref.current.scale.set(s, s, s);
    } else if (ref.current) {
      ref.current.scale.set(scale, scale, scale);
    }
  });
  return (
    <mesh ref={ref} position={position} onClick={onClick} castShadow>
      {shape === "sphere" && <sphereGeometry args={[0.18, 32, 32]} />}
      {shape === "cylinder" && <cylinderGeometry args={[0.06, 0.06, 0.8, 16]} />}
      {shape === "box" && <boxGeometry args={[0.14, 0.14, 0.12]} />}
      <meshStandardMaterial color={color} emissive={highlighted ? color : "#000"} emissiveIntensity={highlighted ? 0.7 : 0} roughness={0.45} metalness={0.1} />
      {highlighted && (
        <Html distanceFactor={6} position={[0, 0.35, 0]}>
          <div className="px-2 py-1 rounded-md bg-card border border-border text-xs font-medium shadow-lg whitespace-nowrap">{label}</div>
        </Html>
      )}
    </mesh>
  );
}

function BodySilhouette({ opacity = 0.18 }: { opacity?: number }) {
  return (
    <group>
      <mesh position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.32, 32, 32]} />
        <meshStandardMaterial color="#eed7c5" transparent opacity={opacity} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <capsuleGeometry args={[0.55, 1.2, 8, 16]} />
        <meshStandardMaterial color="#eed7c5" transparent opacity={opacity} roughness={0.9} />
      </mesh>
      <mesh position={[-0.75, 0.45, 0]} rotation={[0, 0, 0.2]}>
        <capsuleGeometry args={[0.13, 1.0, 8, 16]} />
        <meshStandardMaterial color="#eed7c5" transparent opacity={opacity * 0.85} />
      </mesh>
      <mesh position={[0.75, 0.45, 0]} rotation={[0, 0, -0.2]}>
        <capsuleGeometry args={[0.13, 1.0, 8, 16]} />
        <meshStandardMaterial color="#eed7c5" transparent opacity={opacity * 0.85} />
      </mesh>
      <mesh position={[-0.25, -0.95, 0]}>
        <capsuleGeometry args={[0.16, 1.1, 8, 16]} />
        <meshStandardMaterial color="#eed7c5" transparent opacity={opacity * 0.85} />
      </mesh>
      <mesh position={[0.25, -0.95, 0]}>
        <capsuleGeometry args={[0.16, 1.1, 8, 16]} />
        <meshStandardMaterial color="#eed7c5" transparent opacity={opacity * 0.85} />
      </mesh>
    </group>
  );
}

export function HumanBody3D({
  highlightOrgan,
  onSelectOrgan,
  glbUrl,
  system = "full",
  view = "complete",
  onPickPart,
  height = "h-[420px] md:h-[520px]",
}: {
  highlightOrgan?: OrganKey | null;
  onSelectOrgan?: (organ: OrganKey) => void;
  glbUrl?: string | null;
  system?: AnatomySystem;
  view?: AnatomyView;
  onPickPart?: (name: string) => void;
  height?: string;
}) {
  const [hover, setHover] = useState<OrganKey | null>(null);
  const [pickedPart, setPickedPart] = useState<string | null>(null);
  const isHighlighted = (k: OrganKey) => highlightOrgan === k || hover === k;

  const showFallbackOrgan = useMemo(() => {
    const map: Record<OrganKey, AnatomySystem> = {
      brain: "nervous", heart: "circulatory", lung: "respiratory",
      appendix: "digestive", bone: "skeletal",
    };
    return (k: OrganKey) => system === "full" || map[k] === system;
  }, [system]);

  const handlePick = (name: string) => {
    setPickedPart(name);
    onPickPart?.(name);
  };

  const activeUrl = glbUrl || DEFAULT_DEMO_GLB;
  const { blobUrl, progress, error, retry } = useCachedGLB(activeUrl);

  // LOD upgrade — knobs come from the user-tunable settings store.
  const lod = useSyncExternalStore(subscribeLod, getLodSettings, getLodSettings);
  const [highQuality, setHighQuality] = useState(false);
  useEffect(() => {
    if (!lod.highQualityEnabled) { setHighQuality(false); return; }
    if (progress.stage !== "ready") return;
    const t = setTimeout(() => setHighQuality(true), Math.max(0, lod.upgradeDelayMs));
    return () => clearTimeout(t);
  }, [progress.stage, lod.upgradeDelayMs, lod.highQualityEnabled]);

  const online = typeof navigator !== "undefined" ? navigator.onLine : true;

  return (
    <div className={`w-full ${height} rounded-2xl overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 border border-border relative`}>
      <Canvas
        camera={{ position: [0, 0.4, 3.2], fov: 45 }}
        shadows={highQuality}
        dpr={highQuality ? [1, lod.highDprMax] : [1, lod.lowDprMax]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        performance={{ min: 0.5 }}
      >
        <FpsSampler />
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 5, 4]} intensity={1.2} castShadow={highQuality} />
        <pointLight position={[-3, 2, -2]} intensity={0.6} color="#5cbdb9" />
        <Suspense fallback={<BodySilhouette opacity={0.25} />}>
          {highQuality && <Environment preset="studio" />}
          {blobUrl ? (
            <GLBModel url={blobUrl} system={system} view={view} lowQuality={!highQuality} onPick={handlePick} />
          ) : (
            <BodySilhouette opacity={view === "organs" ? 0.05 : view === "transparent" ? 0.12 : 0.2} />
          )}
          {!blobUrl && (
            <>
              {showFallbackOrgan("brain") && (
                <group onPointerOver={() => setHover("brain")} onPointerOut={() => setHover(null)}>
                  <Organ position={[0, 1.42, 0.05]} color="#f3a5c0" scale={0.9} highlighted={isHighlighted("brain")} onClick={() => { onSelectOrgan?.("brain"); handlePick("Cerveau"); }} label="Cerveau" />
                </group>
              )}
              {showFallbackOrgan("heart") && (
                <group onPointerOver={() => setHover("heart")} onPointerOut={() => setHover(null)}>
                  <Organ position={[-0.12, 0.65, 0.18]} color="#e94560" scale={1.1} highlighted={isHighlighted("heart")} onClick={() => { onSelectOrgan?.("heart"); handlePick("Cœur"); }} label="Cœur" />
                </group>
              )}
              {showFallbackOrgan("lung") && (
                <group onPointerOver={() => setHover("lung")} onPointerOut={() => setHover(null)}>
                  <Organ position={[-0.32, 0.7, 0.08]} color="#8ec5d6" scale={1} highlighted={isHighlighted("lung")} onClick={() => { onSelectOrgan?.("lung"); handlePick("Poumons"); }} label="Poumons" />
                  <Organ position={[0.32, 0.7, 0.08]} color="#8ec5d6" scale={1} highlighted={isHighlighted("lung")} onClick={() => { onSelectOrgan?.("lung"); handlePick("Poumons"); }} label="Poumons" />
                </group>
              )}
              {showFallbackOrgan("appendix") && (
                <group onPointerOver={() => setHover("appendix")} onPointerOut={() => setHover(null)}>
                  <Organ position={[0.22, -0.05, 0.18]} color="#f59e0b" scale={0.6} highlighted={isHighlighted("appendix")} onClick={() => { onSelectOrgan?.("appendix"); handlePick("Appendice"); }} label="Appendice" />
                </group>
              )}
              {showFallbackOrgan("bone") && (
                <group onPointerOver={() => setHover("bone")} onPointerOut={() => setHover(null)}>
                  <Organ position={[0.25, -1.15, 0.05]} color="#f5f0e8" scale={0.9} shape="cylinder" highlighted={isHighlighted("bone")} onClick={() => { onSelectOrgan?.("bone"); handlePick("Tibia"); }} label="Tibia" />
                </group>
              )}
            </>
          )}
          <OrbitControls enablePan={false} minDistance={1.5} maxDistance={6} target={[0, 0.3, 0]} />
        </Suspense>
      </Canvas>
      <GLBLoaderOverlay progress={progress} error={error} online={online} onRetry={retry} />
      {pickedPart && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-card/90 backdrop-blur border border-border shadow-lg">
          <div className="text-xs">
            <span className="text-muted-foreground">Sélection : </span>
            <span className="font-semibold capitalize">{pickedPart}</span>
          </div>
          <button type="button" onClick={() => setPickedPart(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}
    </div>
  );
}
