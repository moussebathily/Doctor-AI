import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Html,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";
import { ClientOnly } from "@/components/ClientOnly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2, Upload, X } from "lucide-react";
import { fetchGLBWithCache, type FetchProgress } from "@/lib/glb-cache";
import type { CardiacSession } from "@/lib/cardiac-game";

const HEART_KEY = "cardiac-heart-glb-url";
const DEFIB_KEY = "cardiac-defib-glb-url";

/** Cœur procédural : deux ventricules + oreillettes + aorte (repli si aucun modèle chargé). */
function HeartMesh({ rhythm, onShock }: { rhythm: string; onShock: () => void }) {
  const group = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);
    let scale = 1;
    let target = "#a11024";

    if (rhythm === "VFIB") {
      scale = 1 + Math.sin(t * 18) * 0.03 + (Math.random() - 0.5) * 0.05;
      g.position.set((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, 0);
      target = "#6b0d1a";
    } else if (rhythm === "NORMAL") {
      const beat = Math.sin(t * 2.5 * Math.PI);
      scale = 1 + (beat > 0 ? beat * 0.08 : 0);
      g.position.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.exp(-8 * dt));
      g.rotation.y += 0.15 * dt;
      target = "#c4283c";
    } else {
      scale = 0.94;
      g.position.set(0, 0, 0);
      target = "#5b5b62";
    }

    g.scale.lerp(new THREE.Vector3(scale, scale, scale), 1 - Math.exp(-10 * dt));
    if (matRef.current) matRef.current.color.lerp(new THREE.Color(target), 1 - Math.exp(-6 * dt));
  });

  const emissive = rhythm === "VFIB" ? "#4a0008" : "#1a0004";

  return (
    <group
      ref={group}
      onClick={onShock}
      onPointerOver={() => {
        setHovered(true);
        document.body.style.cursor = rhythm === "VFIB" ? "crosshair" : "default";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh castShadow receiveShadow position={[-0.3, -0.1, 0]} scale={[1, 1.25, 1]}>
        <sphereGeometry args={[0.75, 48, 48]} />
        <meshStandardMaterial
          ref={matRef}
          roughness={0.35}
          metalness={0.05}
          emissive={emissive}
          emissiveIntensity={hovered ? 0.8 : rhythm === "VFIB" ? 0.5 : 0.15}
        />
      </mesh>
      <mesh castShadow position={[0.42, -0.05, 0.05]} scale={[0.9, 1.1, 0.9]}>
        <sphereGeometry args={[0.62, 40, 40]} />
        <meshStandardMaterial color="#8e1226" roughness={0.4} metalness={0.05} />
      </mesh>
      <mesh castShadow position={[-0.25, 0.85, -0.05]}>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial color="#7a1020" roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0.45, 0.8, -0.05]}>
        <sphereGeometry args={[0.36, 32, 32]} />
        <meshStandardMaterial color="#6d1a2c" roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0.05, 1.25, 0]} rotation={[0, 0, -0.25]}>
        <cylinderGeometry args={[0.16, 0.22, 0.7, 24]} />
        <meshStandardMaterial color="#b8536a" roughness={0.6} />
      </mesh>
      <mesh castShadow position={[-0.75, 0.95, 0.1]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.1, 0.13, 0.55, 20]} />
        <meshStandardMaterial color="#4a5b8c" roughness={0.6} />
      </mesh>

      <Html position={[0, 1.75, 0]} center distanceFactor={8}>
        <div
          className={`px-3 py-1 rounded-md text-[11px] font-bold backdrop-blur-md border whitespace-nowrap ${
            rhythm === "VFIB"
              ? "bg-red-950/80 text-red-100 border-red-500 animate-pulse"
              : rhythm === "NORMAL"
                ? "bg-emerald-950/80 text-emerald-100 border-emerald-500"
                : "bg-slate-800/80 text-slate-300 border-slate-600"
          }`}
        >
          {rhythm === "VFIB" ? "⚠ FIBRILLATION" : rhythm === "NORMAL" ? "✓ RYTHME SINUSAL" : "✕ ASYSTOLIE"}
        </div>
      </Html>
    </group>
  );
}

/** Modèle GLB réel (cœur ou défibrillateur) animé selon le rythme. */
function GLBHeart({ url, rhythm, onShock }: { url: string; rhythm: string; onShock: () => void }) {
  const { scene } = useGLTF(url);
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    // Recentre et normalise l'échelle du modèle importé.
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = 2.6 / maxDim;
    scene.scale.setScalar(s);
    scene.position.set(-center.x * s, -center.y * s, -center.z * s);
  }, [scene]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);
    let scale = 1;
    if (rhythm === "VFIB") {
      scale = 1 + Math.sin(t * 18) * 0.025 + (Math.random() - 0.5) * 0.03;
      g.position.set((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, 0);
    } else if (rhythm === "NORMAL") {
      const beat = Math.sin(t * 2.5 * Math.PI);
      scale = 1 + (beat > 0 ? beat * 0.06 : 0);
      g.position.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.exp(-8 * dt));
    } else {
      scale = 0.96;
    }
    g.scale.lerp(new THREE.Vector3(scale, scale, scale), 1 - Math.exp(-10 * dt));
  });

  return (
    <group ref={group} onClick={onShock}>
      <primitive object={scene} />
    </group>
  );
}

/** Défibrillateur : modèle GLB si fourni, sinon appareil procédural avec palettes. */
function DefibModel({ url, charged }: { url: string | null; charged: boolean }) {
  if (url) return <GLBDefib url={url} />;
  return (
    <group position={[2.3, -1.1, -0.4]} rotation={[0, -0.5, 0]} scale={0.72}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.9, 0.9]} />
        <meshStandardMaterial color="#f2b705" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.15, 0.46]}>
        <boxGeometry args={[0.8, 0.45, 0.05]} />
        <meshStandardMaterial
          color="#04120c"
          emissive={charged ? "#22c55e" : "#0f766e"}
          emissiveIntensity={charged ? 1.6 : 0.5}
        />
      </mesh>
      <mesh position={[-0.75, 0.62, 0.15]} rotation={[0, 0, 0.4]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.12, 24]} />
        <meshStandardMaterial color="#1f2937" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0.78, 0.62, 0.15]} rotation={[0, 0, -0.4]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.12, 24]} />
        <meshStandardMaterial color="#1f2937" roughness={0.4} metalness={0.6} />
      </mesh>
      <Html position={[0, -0.75, 0]} center distanceFactor={9}>
        <div className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/60 text-[10px] text-amber-200 whitespace-nowrap">
          Défibrillateur 200 J
        </div>
      </Html>
    </group>
  );
}

function GLBDefib({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = 1.6 / maxDim;
    scene.scale.setScalar(s);
    scene.position.set(-center.x * s, -center.y * s, -center.z * s);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = true;
    });
  }, [scene]);
  return (
    <group position={[2.4, -1.1, -0.4]} rotation={[0, -0.5, 0]}>
      <primitive object={scene} />
    </group>
  );
}

function useModelLoader(storageKey: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    if (saved) setSource(saved);
  }, [storageKey]);

  const load = async (remote: string) => {
    const clean = remote.trim();
    if (!clean) return;
    setError(null);
    setProgress({ loaded: 0, total: null, stage: "cache-lookup", attempt: 1 });
    try {
      const res = await fetchGLBWithCache(clean, { onProgress: setProgress });
      setUrl(res.blobUrl);
      localStorage.setItem(storageKey, clean);
      setProgress(null);
    } catch (e) {
      setError((e as Error).message || "Échec du chargement du modèle.");
      setProgress(null);
    }
  };

  const loadFile = (file: File) => {
    setError(null);
    setUrl(URL.createObjectURL(file));
  };

  const clear = () => {
    setUrl(null);
    localStorage.removeItem(storageKey);
  };

  return { url, source, setSource, progress, error, load, loadFile, clear };
}

export function HeartSimulation({
  state,
  onShock,
  flash,
}: {
  state: Pick<CardiacSession, "rhythm" | "health">;
  onShock: () => void;
  flash: boolean;
}) {
  const heart = useModelLoader(HEART_KEY);
  const defib = useModelLoader(DEFIB_KEY);
  const hr = state.rhythm === "VFIB" ? "---" : state.rhythm === "ASYSTOLE" ? "0" : "82";
  const busy = heart.progress !== null || defib.progress !== null;

  const pct = (p: FetchProgress | null) =>
    p && p.total ? ` ${Math.round((p.loaded / p.total) * 100)}%` : "";

  return (
    <div className="space-y-3">
      <div className="relative w-full h-[420px] rounded-2xl overflow-hidden border border-white/10 bg-[radial-gradient(ellipse_at_50%_35%,oklch(0.22_0.04_265)_0%,oklch(0.12_0.03_265)_55%,oklch(0.08_0.02_265)_100%)]">
        {flash && <div className="absolute inset-0 z-20 bg-white/70 animate-ping pointer-events-none" />}

        <ClientOnly
          fallback={
            <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
              Chargement de la scène 3D…
            </div>
          }
        >
          <Canvas shadows dpr={[1, 2]}>
            <PerspectiveCamera makeDefault position={[0.4, 0.55, 6]} fov={45} />
            <ambientLight intensity={0.35} />
            <spotLight position={[6, 8, 6]} angle={0.35} penumbra={1} intensity={2.2} castShadow />
            <pointLight position={[-6, -3, -4]} intensity={1.2} color="#ff2244" />
            <Environment>
              <Lightformer intensity={2} position={[0, 5, 2]} scale={[8, 8, 1]} />
              <Lightformer
                intensity={1}
                color="#88aaff"
                position={[-5, 1, -1]}
                rotation-y={Math.PI / 2}
                scale={[14, 1, 1]}
              />
            </Environment>

            <Suspense fallback={null}>
              {heart.url ? (
                <GLBHeart url={heart.url} rhythm={state.rhythm} onShock={onShock} />
              ) : (
                <HeartMesh rhythm={state.rhythm} onShock={onShock} />
              )}
              <DefibModel url={defib.url} charged={state.rhythm === "VFIB"} />
            </Suspense>

            <ContactShadows position={[0, -1.7, 0]} opacity={0.45} scale={14} blur={2.6} far={5} />
            <OrbitControls
              enablePan={false}
              minDistance={3}
              maxDistance={9}
              autoRotate={state.rhythm === "NORMAL"}
              autoRotateSpeed={0.6}
            />
          </Canvas>
        </ClientOnly>

        <div className="absolute top-4 left-4 pointer-events-none">
          <div className="bg-black/60 backdrop-blur px-3 py-2 rounded-lg border-l-4 border-emerald-500 font-mono">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Fréquence cardiaque</p>
            <p className="text-xl font-bold text-emerald-300">
              {hr} <span className="text-xs">bpm</span>
            </p>
            <p className="text-[11px] text-sky-300">SpO₂ {state.health}%</p>
            <p className={`text-[11px] ${state.rhythm === "VFIB" ? "text-red-400 animate-pulse" : "text-slate-300"}`}>
              Rythme : {state.rhythm}
            </p>
          </div>
        </div>

        <div className="absolute bottom-3 right-3 pointer-events-none">
          <div className="text-[11px] text-white/60 bg-black/50 px-2 py-1 rounded">
            Cliquez sur le cœur pour défibriller ⚡
          </div>
        </div>
      </div>

      {/* Chargement des modèles 3D réels */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
        <p className="text-xs font-semibold">Modèles 3D réels (.glb)</p>
        {(
          [
            { label: "Cœur", m: heart },
            { label: "Défibrillateur", m: defib },
          ] as const
        ).map(({ label, m }) => (
          <div key={label} className="flex flex-wrap items-center gap-2">
            <span className="text-xs w-28 text-muted-foreground">{label}</span>
            <Input
              value={m.source}
              onChange={(e) => m.setSource(e.target.value)}
              placeholder="https://…/modele.glb"
              className="h-8 text-xs flex-1 min-w-[180px]"
            />
            <Button size="sm" className="h-8" disabled={busy || !m.source.trim()} onClick={() => void m.load(m.source)}>
              {m.progress ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span className="ml-1.5">Charger{pct(m.progress)}</span>
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                accept=".glb,.gltf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) m.loadFile(f);
                }}
              />
              <span className="inline-flex items-center h-8 px-2.5 rounded-md border border-border text-xs cursor-pointer hover:bg-muted">
                <Upload className="w-3.5 h-3.5 mr-1" /> Fichier
              </span>
            </label>
            {m.url && (
              <Button size="sm" variant="ghost" className="h-8" onClick={m.clear}>
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
            {m.error && <span className="text-[11px] text-destructive w-full">{m.error}</span>}
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">
          Sans modèle chargé, une version procédurale est affichée. Collez l'adresse d'un fichier .glb public ou
          importez le vôtre.
        </p>
      </div>
    </div>
  );
}
