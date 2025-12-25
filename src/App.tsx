import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import gsap from "gsap";
import type { SceneConfig, TimelineConfig } from "@/core/types";
import { SparkRendererManager } from "@/rendering/SparkRenderer";
import { SplatMatterEngine } from "@/core/SplatMatterEngine";
import type { PhysicsConfig } from "@/core/types";
import { Timeline } from "@/core/Timeline";
import { AudioManager } from "@/audio/AudioManager";
import { Experience } from "@/Experience";

interface LoaderState {
  progress: number;
  message: string;
}

const ProgressiveLoader = ({ state }: { state: LoaderState }) => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white gap-6">
    <div className="text-xl tracking-[0.4em] uppercase">Preparing Matter.01</div>
    <div className="w-72 h-2 bg-white/10 rounded-full overflow-hidden">
      <div className="loader-bar h-full" style={{ width: `${Math.floor(state.progress * 100)}%` }} />
    </div>
    <div className="text-sm text-white/60">{state.message}</div>
  </div>
);

const StartOverlay = ({ onStart }: { onStart: () => void }) => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-4">
    <div className="text-3xl font-semibold tracking-wide">Enter the Chamber</div>
    <p className="max-w-sm text-center text-white/70 text-sm">
      Sound on. Move your cursor to warp the matter field. The performance lasts 30 seconds.
    </p>
    <button
      type="button"
      className="px-6 py-3 rounded-full bg-white text-black text-sm tracking-widest uppercase"
      onClick={onStart}
    >
      Begin
    </button>
  </div>
);

export const App = () => {
  const [loaderState, setLoaderState] = useState<LoaderState>({
    progress: 0,
    message: "Initializing",
  });
  const [sceneConfig, setSceneConfig] = useState<SceneConfig | null>(null);
  const [timelineConfig, setTimelineConfig] = useState<TimelineConfig | null>(null);
  const [physicsConfig, setPhysicsConfig] = useState<PhysicsConfig | null>(null);
  const [engine, setEngine] = useState<SplatMatterEngine | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioManager, setAudioManager] = useState<AudioManager | null>(null);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const context = new AudioContext();
    setAudioContext(context);
    setAudioManager(new AudioManager(context));
    return () => {
      void context.close();
    };
  }, []);

  useEffect(() => {
    if (!audioManager) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoaderState({ progress: 0.05, message: "Fetching scene configuration" });
      const [scene, physics, timelineData] = await Promise.all([
        fetch("/config/scene.json").then((response) => response.json() as Promise<SceneConfig>),
        fetch("/config/physics.json").then((response) => response.json() as Promise<PhysicsConfig>),
        fetch("/config/timeline.json").then((response) => response.json() as Promise<TimelineConfig>),
      ]);

      if (cancelled) {
        return;
      }

      setSceneConfig(scene);
      setPhysicsConfig(physics);
      setTimelineConfig(timelineData);

      const spark = new SparkRendererManager(scene);
      setLoaderState({ progress: 0.15, message: "Downloading matter volumes" });
      const loadedParticles = await spark.load({
        onChunkLoaded: (index: number, total: number) => {
          const progress = 0.15 + (index / total) * 0.6;
          setLoaderState({
            progress,
            message: `Processed chunk ${index}/${total}`,
          });
        },
      });

      if (cancelled) {
        return;
      }

      setLoaderState({ progress: 0.8, message: "Calibrating physics kernel" });
      const engineInstance = new SplatMatterEngine();
      await engineInstance.initialize(physics, loadedParticles);
      setEngine(engineInstance);

      setLoaderState({ progress: 0.9, message: "Buffering audio layers" });
      await Promise.all(
        Object.entries(scene.audio).map(([id, url]) =>
          audioManager.load(id, url).catch((error) => {
            console.error(`Failed to load audio clip ${id}`, error);
          }),
        ),
      );

      const timelineInstance = new Timeline(timelineData);
      setTimeline(timelineInstance);

      setLoaderState({ progress: 1, message: "Ready" });
      setReady(true);
    };

    load().catch((error: unknown) => {
      console.error(error);
      setLoaderState({ progress: 1, message: "Failed to initialize experience" });
    });

    return () => {
      cancelled = true;
    };
  }, [audioManager]);

  const handleStart = () => {
    if (!audioContext || !timeline || !sceneConfig) {
      return;
    }
    void audioContext.resume().then(() => {
      timeline.start(0);
      window.requestAnimationFrame(() => {
        setStarted(true);
      });
    });
  };

  const cameraPosition = useMemo<[number, number, number]>(
    () => sceneConfig?.camera.position ?? [0, 2, 8],
    [sceneConfig],
  );
  const cameraTarget = useMemo<[number, number, number]>(
    () => sceneConfig?.camera.target ?? [0, 1, 0],
    [sceneConfig],
  );

  return (
    <div className="w-full h-full">
      {(!ready || !engine || !timeline || !sceneConfig || !physicsConfig || !audioManager) && (
        <ProgressiveLoader state={loaderState} />
      )}
      {ready && engine && timeline && sceneConfig && audioManager && (
        <>
          <Canvas
            shadows
            camera={{ position: cameraPosition, fov: 45, near: 0.1, far: 200 }}
            onCreated={({ camera }) => {
              gsap.to(camera.position, {
                duration: 1.5,
                x: cameraTarget[0] + 1,
                y: cameraTarget[1] + 2,
                z: cameraTarget[2] + 6,
                ease: "power2.out",
              });
            }}
          >
            <color attach="background" args={["#020205"]} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[4, 8, -2]} intensity={1.2} castShadow />
            <Experience
              engine={engine}
              timeline={timeline}
              audioManager={audioManager}
              sceneConfig={sceneConfig}
              started={started}
            />
          </Canvas>
          {!started && <StartOverlay onStart={handleStart} />}
        </>
      )}
    </div>
  );
};

export default App;
