import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { SplatMatterEngine } from "@/core/SplatMatterEngine";
import type { SolverInfluence } from "@/core/SplatMatterSolver";
import type { SplatParticleData } from "@/core/types";
import { Color, InstancedBufferAttribute, InstancedMesh, Object3D } from "three";

export interface PointerImpulse {
  origin: [number, number, number];
  radius: number;
  strength: number;
}

interface SparkSplatCloudProps {
  engine: SplatMatterEngine;
  characterPosition?: [number, number, number];
  pointerImpulseQueue: PointerImpulse[];
}

const scratchObject = new Object3D();
const color = new Color();

export const SparkSplatCloud = ({ engine, characterPosition, pointerImpulseQueue }: SparkSplatCloudProps) => {
  const meshRef = useRef<InstancedMesh>(null);
  const [particles, setParticles] = useState<SplatParticleData[]>(() => engine.getParticles());

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<SplatParticleData[]>).detail;
      setParticles(detail);
    };
    engine.addEventListener("update", handleUpdate);
    return () => {
      engine.removeEventListener("update", handleUpdate);
    };
  }, [engine]);

  useFrame((_, delta) => {
    const influence: SolverInfluence = {
      impulses: pointerImpulseQueue.splice(0, pointerImpulseQueue.length),
      characterPosition,
    };
    engine.step(delta, influence);
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const currentParticles = engine.getParticles();
    if (currentParticles.length !== particles.length) {
      setParticles([...currentParticles]);
      return;
    }

    mesh.count = currentParticles.length;
    if (!mesh.instanceColor || mesh.instanceColor.count !== currentParticles.length) {
      mesh.instanceColor = new InstancedBufferAttribute(
        new Float32Array(currentParticles.length * 3),
        3,
      );
    }

    currentParticles.forEach((particle, index) => {
      scratchObject.position.set(particle.position[0], particle.position[1], particle.position[2]);
      scratchObject.scale.setScalar(particle.scale * (particle.shattered ? 0.8 : 1));
      scratchObject.updateMatrix();
      mesh.setMatrixAt(index, scratchObject.matrix);
      color.setRGB(particle.color[0], particle.color[1], particle.color[2]);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, particles.length]}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial vertexColors transparent opacity={0.95} />
    </instancedMesh>
  );
};
