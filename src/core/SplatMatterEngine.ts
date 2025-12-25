import type { SolverInfluence } from "@/core/SplatMatterSolver";
import { SplatMatterSolver } from "@/core/SplatMatterSolver";
import type { MaterialType, PhysicsConfig, SplatParticleData } from "@/core/types";

type EngineEventMap = {
  update: CustomEvent<SplatParticleData[]>;
  shatter: CustomEvent<{ material: MaterialType; count: number }>;
};

type WorkerCommand =
  | { type: "init"; config: PhysicsConfig; particles: SplatParticleData[] }
  | { type: "step"; delta: number; influence?: SolverInfluence }
  | { type: "resetParticles"; particles: SplatParticleData[] }
  | { type: "shatter"; material: MaterialType; origin: [number, number, number]; radius: number }
  | { type: "explode"; material: MaterialType; origin: [number, number, number]; force: number }
  | { type: "impulse"; origin: [number, number, number]; radius: number; strength: number };

type WorkerResponse =
  | { type: "state"; particles: SplatParticleData[] }
  | { type: "shatter"; material: MaterialType; count: number };

const hasWorkerSupport = typeof Worker !== "undefined";

export class SplatMatterEngine extends EventTarget {
  private worker?: Worker;
  private solver?: SplatMatterSolver;
  private config?: PhysicsConfig;
  private particles: SplatParticleData[] = [];
  private ready = false;

  async initialize(config: PhysicsConfig, particles: SplatParticleData[]): Promise<void> {
    this.config = config;
    this.particles = particles;
    if (hasWorkerSupport) {
      const worker = new Worker(new URL("@/workers/splatWorker.ts", import.meta.url), {
        type: "module",
      });
      worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      });
      worker.postMessage({ type: "init", config, particles } satisfies WorkerCommand);
      this.worker = worker;
      this.ready = true;
      return;
    }
    this.solver = new SplatMatterSolver(config, particles);
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  getParticles(): SplatParticleData[] {
    if (this.solver) {
      return this.solver.getParticles();
    }
    return this.particles;
  }

  step(delta: number, influence?: SolverInfluence): void {
    if (!this.ready) {
      return;
    }
    if (this.worker) {
      this.worker.postMessage({ type: "step", delta, influence } satisfies WorkerCommand);
      return;
    }
    if (!this.solver) {
      throw new Error("Solver not initialized");
    }
    this.solver.step(delta, influence);
    this.particles = this.solver.getParticles().map((particle) => ({ ...particle }));
    this.dispatchEvent(new CustomEvent("update", { detail: this.particles }));
  }

  resetParticles(particles: SplatParticleData[]): void {
    if (!this.ready) {
      return;
    }
    this.particles = particles;
    if (this.worker) {
      this.worker.postMessage({ type: "resetParticles", particles } satisfies WorkerCommand);
    } else {
      this.solver?.setParticles(particles);
      this.dispatchEvent(new CustomEvent("update", { detail: particles }));
    }
  }

  shatter(material: MaterialType, origin: [number, number, number], radius: number): void {
    if (!this.ready || !this.config) {
      return;
    }
    if (this.worker) {
      this.worker.postMessage({ type: "shatter", material, origin, radius } satisfies WorkerCommand);
    } else if (this.solver) {
      this.solver.shatter(material, origin, radius);
      const particles = this.solver.getParticles();
      this.dispatchEvent(new CustomEvent("update", { detail: particles }));
      const count = particles.filter((particle) => particle.shattered).length;
      this.dispatchEvent(new CustomEvent("shatter", { detail: { material, count } }));
    }
  }

  explode(material: MaterialType, origin: [number, number, number], force: number): void {
    if (!this.ready) {
      return;
    }
    if (this.worker) {
      this.worker.postMessage({ type: "explode", material, origin, force } satisfies WorkerCommand);
    } else if (this.solver) {
      this.solver.explode(material, origin, force);
      const particles = this.solver.getParticles();
      this.dispatchEvent(new CustomEvent("update", { detail: particles }));
    }
  }

  applyImpulse(
    origin: [number, number, number],
    radius: number,
    strength: number,
  ): void {
    if (!this.ready) {
      return;
    }
    if (this.worker) {
      this.worker.postMessage({ type: "impulse", origin, radius, strength } satisfies WorkerCommand);
    } else if (this.solver) {
      this.solver.applyImpulseSphere(origin, radius, strength);
      this.dispatchEvent(new CustomEvent("update", { detail: this.solver.getParticles() }));
    }
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.solver = undefined;
    this.ready = false;
  }

  private handleWorkerMessage(message: WorkerResponse): void {
    if (message.type === "state") {
      this.particles = message.particles;
      this.dispatchEvent(new CustomEvent("update", { detail: this.particles }));
      return;
    }
    if (message.type === "shatter") {
      this.dispatchEvent(new CustomEvent("shatter", { detail: message }));
    }
  }
}

export type { SolverInfluence } from "@/core/SplatMatterSolver";
