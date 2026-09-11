import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Html, Lightformer, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { ClientOnly } from "@/components/ClientOnly";
import type { CardiacState } from "@/lib/cardiac-game";

/** Cœur procédural : deux ventricules + oreillettes + aorte. */
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
      {/* Matériau partagé */}
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
      {/* Aorte */}
      <mesh castShadow position={[0.05, 1.25, 0]} rotation={[0, 0, -0.25]}>
        <cylinderGeometry args={[0.16, 0.22, 0.7, 24]} />
        <meshStandardMaterial color="#b8536a" roughness={0.6} />
      </mesh>
      {/* Veines caves */}
      <mesh castShadow position={[-0.75, 0.95, 0.1]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.1, 0.13, 0.55, 20]} />
        <meshStandardMaterial color="#4a5b8c" roughness={0.6} />
      </mesh>

      <Html position={[0, 1.95, 0]} center distanceFactor={8}>
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

export function HeartSimulation({
  state,
  onShock,
  flash,
}: {
  state: CardiacState;
  onShock: () => void;
  flash: boolean;
}) {
  const hr = state.rhythm === "VFIB" ? "---" : state.rhythm === "ASYSTOLE" ? "0" : "82";

  return (
    <div className="relative w-full h-[420px] rounded-2xl overflow-hidden border border-white/10 bg-[radial-gradient(ellipse_at_50%_35%,oklch(0.22_0.04_265)_0%,oklch(0.12_0.03_265)_55%,oklch(0.08_0.02_265)_100%)]">
      {flash && <div className="absolute inset-0 z-20 bg-white/70 animate-ping pointer-events-none" />}

      <ClientOnly
        fallback={<div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Chargement de la scène 3D…</div>}
      >
        <Canvas shadows dpr={[1, 2]}>
          <PerspectiveCamera makeDefault position={[0, 0.3, 5]} fov={45} />
          <ambientLight intensity={0.35} />
          <spotLight position={[6, 8, 6]} angle={0.35} penumbra={1} intensity={2.2} castShadow />
          <pointLight position={[-6, -3, -4]} intensity={1.2} color="#ff2244" />
          <Environment>
            <Lightformer intensity={2} position={[0, 5, 2]} scale={[8, 8, 1]} />
            <Lightformer intensity={1} color="#88aaff" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[14, 1, 1]} />
          </Environment>

          <HeartMesh rhythm={state.rhythm} onShock={onShock} />
          <ContactShadows position={[0, -1.7, 0]} opacity={0.45} scale={12} blur={2.6} far={5} />

          <OrbitControls
            enablePan={false}
            minDistance={3}
            maxDistance={8}
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
  );
}
