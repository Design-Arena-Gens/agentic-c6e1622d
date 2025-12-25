import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import type { SceneConfig } from "@/core/types";
import type { SplatMatterEngine } from "@/core/SplatMatterEngine";
import { Timeline } from "@/core/Timeline";
import { SparkSplatCloud, type PointerImpulse } from "@/rendering/SparkSplatCloud";
import { PostProcessor } from "@/rendering/PostProcessor";
import { BillboardCharacter } from "@/characters/BillboardCharacter";
import { WalkController } from "@/characters/WalkController";
import { LipSyncAnimator } from "@/characters/LipSyncAnimator";
import { AudioManager } from "@/audio/AudioManager";
import { DepthEstimator } from "@/depth/DepthEstimator";
import { CanvasTexture, Plane, Raycaster, Vector2, Vector3 } from "three";

interface ExperienceProps {
  engine: SplatMatterEngine;
  timeline: Timeline;
  sceneConfig: SceneConfig;
  audioManager: AudioManager;
  started: boolean;
}

const pointer = new Vector2();
const raycaster = new Raycaster();
const groundPlane = new Plane(new Vector3(0, 1, 0), 0);

export const Experience = ({ engine, timeline, sceneConfig, audioManager, started }: ExperienceProps) => {
  const { camera, gl } = useThree();
  const pointerImpulseQueue = useRef<PointerImpulse[]>([]);
  const lookAtTarget = useRef<Vector3>(new Vector3(...sceneConfig.camera.target));

  const character = useMemo(() => new BillboardCharacter(), []);
  const walkController = useMemo(() => new WalkController(character), [character]);
  const depthEstimator = useMemo(() => new DepthEstimator(), []);
  const lipSyncRef = useRef<LipSyncAnimator | null>(null);

  useEffect(() => {
    let mounted = true;
    depthEstimator
      .generateDepthTexture()
      .then((texture: CanvasTexture) => {
        if (mounted) {
          character.setDepthMap(texture);
        }
      })
      .catch((error: unknown) => console.error("Depth estimation failed", error));
    return () => {
      mounted = false;
    };
  }, [character, depthEstimator]);

  useEffect(() => {
    const handlers = {
      "camera.moveTo": (params: Record<string, unknown>) => {
        const position = params.position as [number, number, number];
        const duration = (params.duration as number | undefined) ?? 1.5;
        const easing = (params.easing as string | undefined) ?? "power2.out";
        if (position) {
          gsap.to(camera.position, {
            duration,
            ease: easing,
            x: position[0],
            y: position[1],
            z: position[2],
          });
        }
      },
      "camera.lookAt": (params: Record<string, unknown>) => {
        const target = params.target as [number, number, number];
        const duration = (params.duration as number | undefined) ?? 1.2;
        const easing = (params.easing as string | undefined) ?? "power2.out";
        if (target) {
          const nextTarget = new Vector3(...target);
          gsap.to(lookAtTarget.current, {
            duration,
            ease: easing,
            x: nextTarget.x,
            y: nextTarget.y,
            z: nextTarget.z,
          });
        }
      },
      "camera.focusTo": (params: Record<string, unknown>) => {
        const aperture = (params.aperture as number | undefined) ?? 1;
        const duration = (params.duration as number | undefined) ?? 1;
        gsap.to(camera, {
          duration,
          focus: aperture,
        });
      },
      "character.walkTo": (params: Record<string, unknown>) => {
        const path = params.path as Array<[number, number, number]>;
        const duration = (params.duration as number | undefined) ?? 4;
        if (path) {
          walkController.setPath(path, duration);
        }
      },
      "character.speak": (params: Record<string, unknown>) => {
        const clip = params.clip as string;
        if (!clip) {
          return;
        }
        const volume = (params.volume as number | undefined) ?? 1;
        audioManager.stop();
        const source = audioManager.play(clip, { volume });
        lipSyncRef.current = new LipSyncAnimator(audioManager.getContext(), source, character);
      },
      "splats.shatter": (params: Record<string, unknown>) => {
        const material = params.material as "glass" | "smoke" | "water";
        const origin = params.origin as [number, number, number];
        const radius = (params.radius as number | undefined) ?? 1;
        if (material && origin) {
          engine.shatter(material, origin, radius);
        }
      },
      "splats.explode": (params: Record<string, unknown>) => {
        const material = params.material as "glass" | "smoke" | "water";
        const origin = params.origin as [number, number, number];
        const force = (params.force as number | undefined) ?? 5;
        if (material && origin) {
          engine.explode(material, origin, force);
        }
      },
      "audio.play": (params: Record<string, unknown>) => {
        const clip = params.clip as string;
        if (!clip) {
          return;
        }
        const volume = (params.volume as number | undefined) ?? 1;
        const loop = Boolean(params.loop);
        audioManager.stop();
        audioManager.play(clip, { loop, volume });
      },
    };
    timeline.updateHandlers(handlers);
  }, [audioManager, camera, character, engine, timeline, walkController]);

  useEffect(() => {
    const element = gl.domElement;
    const handlePointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / element.clientWidth) * 2 - 1;
      pointer.y = -(event.clientY / element.clientHeight) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersection = new Vector3();
      raycaster.ray.intersectPlane(groundPlane, intersection);
      pointerImpulseQueue.current.push({
        origin: [intersection.x, intersection.y, intersection.z],
        radius: 1.2,
        strength: 1.2,
      });
    };
    element.addEventListener("pointermove", handlePointerMove);
    return () => {
      element.removeEventListener("pointermove", handlePointerMove);
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    if (started) {
      timeline.tick();
    }
    camera.lookAt(lookAtTarget.current);
    walkController.update(delta);
    lipSyncRef.current?.update();
  });

  return (
    <>
      <primitive object={character} position={[0, 0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#05060a" />
      </mesh>
      <SparkSplatCloud
        engine={engine}
        pointerImpulseQueue={pointerImpulseQueue.current}
        characterPosition={[character.position.x, character.position.y, character.position.z]}
      />
      <PostProcessor />
    </>
  );
};
