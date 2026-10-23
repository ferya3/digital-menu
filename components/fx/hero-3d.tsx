"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import type { Group } from "three";

const BROWN = "#5a3825";
const BROWN2 = "#7a4a2f";
const RED = "#e11d2a";
const CREAM = "#f3e9dc";

function Bean({ position, speed }: { position: [number, number, number]; speed: number }) {
  return (
    <Float speed={speed} rotationIntensity={1.4} floatIntensity={1.6}>
      <mesh position={position} rotation={[Math.random() * 3, Math.random() * 3, 0]} scale={[0.22, 0.14, 0.14]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color={Math.random() > 0.5 ? BROWN : BROWN2} roughness={0.55} metalness={0.1} />
      </mesh>
    </Float>
  );
}

function Scene() {
  const group = useRef<Group>(null);
  useFrame((state, dt) => {
    if (!group.current) return;
    group.current.rotation.y += dt * 0.22;
    // Subtle parallax following the pointer
    const px = state.pointer.x * 0.25;
    const py = state.pointer.y * 0.2;
    group.current.rotation.x += (py - group.current.rotation.x) * 0.05;
    group.current.position.x += (px - group.current.position.x) * 0.05;
  });

  const beans: [number, number, number][] = [];
  const N = 11;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 2.1 + (i % 3) * 0.25;
    beans.push([Math.cos(a) * r, Math.sin(a) * r * 0.5, Math.sin(a * 2) * 0.6]);
  }

  const { viewport } = useThree();
  const wide = viewport.width > 7;
  // Wide screens: scene on the right, headline on the left (LTR)
  const base: [number, number, number] = wide ? [viewport.width * 0.24, 0, 0] : [0, viewport.height * 0.09, -1.5];
  const scale = wide ? 1 : 0.62;

  return (
    <group position={base} scale={scale}>
    <group ref={group}>
      {/* Center ring */}
      <Float speed={1.2} rotationIntensity={0.6} floatIntensity={1}>
        <mesh rotation={[Math.PI / 2.6, 0, 0]}>
          <torusGeometry args={[1.35, 0.17, 32, 100]} />
          <meshStandardMaterial color={RED} roughness={0.25} metalness={0.5} />
        </mesh>
      </Float>
      {/* Center drop */}
      <Float speed={2} floatIntensity={1.4}>
        <mesh>
          <sphereGeometry args={[0.55, 48, 48]} />
          <meshStandardMaterial color={CREAM} roughness={0.3} metalness={0.2} />
        </mesh>
      </Float>
      {beans.map((p, i) => (
        <Bean key={i} position={p} speed={1 + (i % 4) * 0.4} />
      ))}
      <Sparkles count={40} scale={8} size={2.5} speed={0.3} color={CREAM} opacity={0.5} />
    </group>
    </group>
  );
}

export function Hero3D({ onReady }: { onReady?: () => void }) {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 -z-10">
      {mounted && (
        <Canvas
          camera={{ position: [0, 0, 6.5], fov: 45 }}
          dpr={[1, 1.6]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          onCreated={() => requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()))}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[4, 5, 3]} intensity={1.8} color="#fff0e0" />
          <pointLight position={[-4, -2, 2]} intensity={30} color={RED} />
          <pointLight position={[3, -3, -2]} intensity={14} color="#ffcf9e" />
          <Scene />
        </Canvas>
      )}
    </div>
  );
}
