import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Environment, useGLTF, Center, useProgress } from "@react-three/drei";
import { DRACOLoader, KTX2Loader } from "three-stdlib";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";
import type { AnatomySystem, AnatomyView } from "@/components/simulation/SystemSidebar";

type OrganKey = "appendix" | "heart" | "bone" | "brain" | "lung";

// Default demo anatomical-ish GLB (Khronos sample, CORS-enabled). Easily
// replaceable by passing a custom `glbUrl` prop or via the sidebar input.
const DEFAULT_DEMO_GLB =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb";

// ───── GLB compression decoders (Draco + Meshopt + KTX2) ─────
// Configured once and reused across loads. Drei's `useGLTF` accepts an
// `extendLoader` callback to attach decoders, enabling compressed payloads
// (10-20× smaller) — critical for mobile/tablet bandwidth.
const dracoLoader = new DRACOLoader().setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
const ktx2Loader = new KTX2Loader().setTranscoderPath("https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/");
const extendLoader = (loader: unknown) => {
  const g = loader as { setDRACOLoader?: (l: DRACOLoader) => void; setKTX2Loader?: (l: KTX2Loader) => void; setMeshoptDecoder?: (d: typeof MeshoptDecoder) => void };
  g.setDRACOLoader?.(dracoLoader);
  g.setKTX2Loader?.(ktx2Loader);
  g.setMeshoptDecoder?.(MeshoptDecoder);
};

// Cache-warm the demo model as soon as this module is imported. Subsequent
// renders read from the GLTF cache — no network hit. Any URL passed via the
// sidebar is preloaded on demand by `useGLBPreload` below.
useGLTF.preload(DEFAULT_DEMO_GLB, true, true, extendLoader as never);

/** Public hook: warm the GLTF cache for a URL before mounting the viewer. */
export function useGLBPreload(url?: string | null) {
  useEffect(() => {
    if (!url) return;
    useGLTF.preload(url, true, true, extendLoader as never);
  }, [url]);
}

// Heuristic name → system map. Works on most anatomical GLBs whose meshes
// include words like "heart", "bone", "muscle", "lung", etc.
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
  url,
  system,
  view,
  breathing = true,
  onPick,
}: {
  url: string;
  system: AnatomySystem;
  view: AnatomyView;
  breathing?: boolean;
  onPick?: (name: string) => void;
}) {
  const { scene } = useGLTF(url, true, true, extendLoader as never);
  const ref = useRef<THREE.Group>(null);

  // Apply system filter + view mode (opacity / visibility) every render of these props.
  useEffect(() => {
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      // Compose a name from this mesh + ancestors (GLB meshes often have generic names)
      let composite = mesh.name;
      let p: THREE.Object3D | null = mesh.parent;
      while (p) {
        composite += " " + p.name;
        p = p.parent;
      }
      const inSystem = meshMatchesSystem(composite, system);

      // Visibility: hide meshes not in current system unless view = complete
      mesh.visible = system === "full" || inSystem || view === "complete";

      // Opacity per view mode
      const mat = mesh.material as THREE.Material | THREE.Material[];
      const apply = (m: THREE.Material) => {
        m.transparent = true;
        if (view === "transparent") m.opacity = inSystem ? 1 : 0.18;
        else if (view === "organs") m.opacity = inSystem ? 1 : 0.0;
        else if (view === "layers") m.opacity = inSystem ? 1 : 0.35;
        else m.opacity = inSystem || system === "full" ? 1 : 0.25;
        m.needsUpdate = true;
      };
      if (Array.isArray(mat)) mat.forEach(apply);
      else apply(mat);
    });
  }, [scene, system, view]);

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
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
        onClick={(e) => {
          e.stopPropagation();
          const obj = e.object as THREE.Object3D;
          let cur: THREE.Object3D | null = obj;
          let name = obj.name;
          while (cur && !name) {
            cur = cur.parent;
            name = cur?.name ?? "";
          }
          onPick?.(name || "Partie anatomique");
        }}
      >
        <primitive object={scene} />
      </group>
    </Center>
  );
}

function Organ({
  position,
  color,
  scale = 1,
  highlighted,
  onClick,
  label,
  shape = "sphere",
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
      <meshStandardMaterial
        color={color}
        emissive={highlighted ? color : "#000"}
        emissiveIntensity={highlighted ? 0.7 : 0}
        roughness={0.45}
        metalness={0.1}
      />
      {highlighted && (
        <Html distanceFactor={6} position={[0, 0.35, 0]}>
          <div className="px-2 py-1 rounded-md bg-card border border-border text-xs font-medium shadow-lg whitespace-nowrap">
            {label}
          </div>
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

  // For the stylized fallback, decide which builtin organs to show based on `system`.
  const showFallbackOrgan = useMemo(() => {
    const map: Record<OrganKey, AnatomySystem> = {
      brain: "nervous",
      heart: "circulatory",
      lung: "respiratory",
      appendix: "digestive",
      bone: "skeletal",
    };
    return (k: OrganKey) => system === "full" || map[k] === system;
  }, [system]);

  const handlePick = (name: string) => {
    setPickedPart(name);
    onPickPart?.(name);
  };

  const activeUrl = glbUrl || DEFAULT_DEMO_GLB;
  useGLBPreload(glbUrl);

  return (
    <div className={`w-full ${height} rounded-2xl overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 border border-border relative`}>
      <Canvas
        camera={{ position: [0, 0.4, 3.2], fov: 45 }}
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        performance={{ min: 0.5 }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 5, 4]} intensity={1.2} castShadow />
        <pointLight position={[-3, 2, -2]} intensity={0.6} color="#5cbdb9" />
        <Suspense fallback={null}>
          <Environment preset="studio" />
          {activeUrl ? (
            <GLBModel url={activeUrl} system={system} view={view} onPick={handlePick} />
          ) : (
            <>
              <BodySilhouette opacity={view === "organs" ? 0.05 : view === "transparent" ? 0.12 : 0.2} />
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
      {pickedPart && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-card/90 backdrop-blur border border-border shadow-lg">
          <div className="text-xs">
            <span className="text-muted-foreground">Sélection : </span>
            <span className="font-semibold capitalize">{pickedPart}</span>
          </div>
          <button
            type="button"
            onClick={() => setPickedPart(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
