export type MaterialType = "glass" | "smoke" | "water";

export interface PhysicsMaterialConfig {
  density: number;
  cohesion?: number;
  shatterVelocity?: number;
  restitution?: number;
  repulsion?: number;
  fade?: number;
  surfaceTension?: number;
  poolHeight?: number;
}

export interface PhysicsConfig {
  gravity: [number, number, number];
  timeStep: number;
  iterations: number;
  materials: Record<MaterialType, PhysicsMaterialConfig>;
}

export interface SplatParticleData {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  scale: number;
  opacity: number;
  material: MaterialType;
  color: [number, number, number];
  shattered?: boolean;
}

export interface SplatChunk {
  id: string;
  url: string;
  material: MaterialType;
}

export interface SceneConfig {
  name: string;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  chunks: SplatChunk[];
  audio: Record<string, string>;
}

export interface TimelineEvent {
  time: number;
  action:
    | "camera.moveTo"
    | "camera.lookAt"
    | "camera.focusTo"
    | "character.walkTo"
    | "character.speak"
    | "splats.shatter"
    | "splats.explode"
    | "audio.play";
  target?: string;
  params: Record<string, unknown>;
}

export interface TimelineConfig {
  duration: number;
  events: TimelineEvent[];
}

export interface AudioClip {
  id: string;
  buffer: AudioBuffer;
}

export interface TimelineActionHandlers {
  "camera.moveTo": (params: Record<string, unknown>) => void;
  "camera.lookAt": (params: Record<string, unknown>) => void;
  "camera.focusTo": (params: Record<string, unknown>) => void;
  "character.walkTo": (params: Record<string, unknown>) => void;
  "character.speak": (params: Record<string, unknown>) => void;
  "splats.shatter": (params: Record<string, unknown>) => void;
  "splats.explode": (params: Record<string, unknown>) => void;
  "audio.play": (params: Record<string, unknown>) => void;
}
