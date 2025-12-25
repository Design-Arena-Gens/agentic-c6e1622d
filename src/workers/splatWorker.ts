/// <reference lib="webworker" />

import { SplatMatterSolver } from "@/core/SplatMatterSolver";
import type { SolverInfluence } from "@/core/SplatMatterSolver";
import type { MaterialType, PhysicsConfig, SplatParticleData } from "@/core/types";

declare const self: DedicatedWorkerGlobalScope;

let solver: SplatMatterSolver | undefined;

interface InitMessage {
  type: "init";
  config: PhysicsConfig;
  particles: SplatParticleData[];
}

interface StepMessage {
  type: "step";
  delta: number;
  influence?: SolverInfluence;
}

interface ResetMessage {
  type: "resetParticles";
  particles: SplatParticleData[];
}

interface ShatterMessage {
  type: "shatter";
  material: MaterialType;
  origin: [number, number, number];
  radius: number;
}

interface ExplodeMessage {
  type: "explode";
  material: MaterialType;
  origin: [number, number, number];
  force: number;
}

interface ImpulseMessage {
  type: "impulse";
  origin: [number, number, number];
  radius: number;
  strength: number;
}

type IncomingMessage =
  | InitMessage
  | StepMessage
  | ResetMessage
  | ShatterMessage
  | ExplodeMessage
  | ImpulseMessage;

self.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;
  switch (message.type) {
    case "init": {
      solver = new SplatMatterSolver(message.config, message.particles);
      postState();
      break;
    }
    case "step": {
      solver?.step(message.delta, message.influence);
      postState();
      break;
    }
    case "resetParticles": {
      solver?.setParticles(message.particles);
      postState();
      break;
    }
    case "shatter": {
      solver?.shatter(message.material, message.origin, message.radius);
      postState();
      if (solver) {
        const count = solver
          .getParticles()
          .filter((particle) => particle.material === message.material && particle.shattered)
          .length;
        self.postMessage({
          type: "shatter",
          material: message.material,
          count,
        });
      }
      break;
    }
    case "explode": {
      solver?.explode(message.material, message.origin, message.force);
      postState();
      break;
    }
    case "impulse": {
      solver?.applyImpulseSphere(message.origin, message.radius, message.strength);
      postState();
      break;
    }
    default:
      break;
  }
};

function postState(): void {
  if (!solver) {
    return;
  }
  self.postMessage({
    type: "state",
    particles: solver.getParticles(),
  });
}
