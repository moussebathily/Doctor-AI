import { Suspense, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Environment } from "@react-three/drei";
import * as THREE from "three";

type OrganKey = "appendix" | "heart" | "bone" | "brain" | "lung";

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

function BodySilhouette() {
  // Stylized translucent torso + head + limbs
  return (
    <group>
      {/* Head */}
      <mesh position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.32, 32, 32]} />
        <meshStandardMaterial color="#eed7c5" transparent opacity={0.18} roughness={0.9} />
      </mesh>
      {/* Torso */}
      <mesh position={[0, 0.4, 0]}>
        <capsuleGeometry args={[0.55, 1.2, 8, 16]} />
        <meshStandardMaterial color="#eed7c5" transparent opacity={0.18} roughness={0.9} />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.75, 0.45, 0]} rotation={[0, 0, 0.2]}>
        <capsuleGeometry args={[0.13, 1.0, 8, 16]} />
        <meshStandardMaterial color="#eed7c5" transparent opacity={0.15} />
      </mesh>
      <mesh position={[0.75, 0.45, 0]} rotation={[0, 0, -0.2]}>
        <capsuleGeometry args={[0.13, 1.0, 8, 16]} />
        <meshStandardMaterial color="#eed7c5" transparent opacity={0.15} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.25, -0.95, 0]}>
        <capsuleGeometry args={[0.16, 1.1, 8, 16]} />
        <meshStandardMaterial color="#eed7c5" transparent opacity={0.15} />
      </mesh>
      <mesh position={[0.25, -0.95, 0]}>
        <capsuleGeometry args={[0.16, 1.1, 8, 16]} />
        <meshStandardMaterial color="#eed7c5" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

export function HumanBody3D({
  highlightOrgan,
  onSelectOrgan,
}: {
  highlightOrgan?: OrganKey | null;
  onSelectOrgan?: (organ: OrganKey) => void;
}) {
  const [hover, setHover] = useState<OrganKey | null>(null);
  const isHighlighted = (k: OrganKey) => highlightOrgan === k || hover === k;

  return (
    <div className="w-full h-[420px] md:h-[520px] rounded-2xl overflow-hidden bg-gradient-to-b from-slate-900 to-slate-700 border border-border">
      <Canvas camera={{ position: [0, 0.4, 3.2], fov: 45 }} shadows>
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 4]} intensity={1.1} castShadow />
        <pointLight position={[-3, 2, -2]} intensity={0.5} color="#5cbdb9" />
        <Suspense fallback={null}>
          <Environment preset="studio" />
          <BodySilhouette />
          {/* Brain */}
          <group onPointerOver={() => setHover("brain")} onPointerOut={() => setHover(null)}>
            <Organ position={[0, 1.42, 0.05]} color="#f3a5c0" scale={0.9} highlighted={isHighlighted("brain")} onClick={() => onSelectOrgan?.("brain")} label="Cerveau" />
          </group>
          {/* Heart */}
          <group onPointerOver={() => setHover("heart")} onPointerOut={() => setHover(null)}>
            <Organ position={[-0.12, 0.65, 0.18]} color="#e94560" scale={1.1} highlighted={isHighlighted("heart")} onClick={() => onSelectOrgan?.("heart")} label="Cœur" />
          </group>
          {/* Lungs */}
          <group onPointerOver={() => setHover("lung")} onPointerOut={() => setHover(null)}>
            <Organ position={[-0.32, 0.7, 0.08]} color="#8ec5d6" scale={1} highlighted={isHighlighted("lung")} onClick={() => onSelectOrgan?.("lung")} label="Poumons" />
            <Organ position={[0.32, 0.7, 0.08]} color="#8ec5d6" scale={1} highlighted={isHighlighted("lung")} onClick={() => onSelectOrgan?.("lung")} label="Poumons" />
          </group>
          {/* Appendix - lower right abdomen */}
          <group onPointerOver={() => setHover("appendix")} onPointerOut={() => setHover(null)}>
            <Organ position={[0.22, -0.05, 0.18]} color="#f59e0b" scale={0.6} highlighted={isHighlighted("appendix")} onClick={() => onSelectOrgan?.("appendix")} label="Appendice" />
          </group>
          {/* Bone (tibia leg) */}
          <group onPointerOver={() => setHover("bone")} onPointerOut={() => setHover(null)}>
            <Organ position={[0.25, -1.15, 0.05]} color="#f5f0e8" scale={0.9} shape="cylinder" highlighted={isHighlighted("bone")} onClick={() => onSelectOrgan?.("bone")} label="Tibia" />
          </group>
          <OrbitControls enablePan={false} minDistance={2} maxDistance={6} target={[0, 0.3, 0]} />
        </Suspense>
      </Canvas>
    </div>
  );
}
