import { SpatialHash } from "@/core/SpatialHash";
import type {
  MaterialType,
  PhysicsConfig,
  PhysicsMaterialConfig,
  SplatParticleData,
} from "@/core/types";

export interface SolverInfluence {
  impulses?: Array<{
    origin: [number, number, number];
    radius: number;
    strength: number;
  }>;
  characterPosition?: [number, number, number];
}

export class SplatMatterSolver {
  private readonly config: PhysicsConfig;
  private readonly spatialHash: SpatialHash;
  private particles: SplatParticleData[] = [];

  constructor(config: PhysicsConfig, initialParticles: SplatParticleData[] = []) {
    this.config = config;
    this.spatialHash = new SpatialHash({ cellSize: 0.5 });
    if (initialParticles.length > 0) {
      this.setParticles(initialParticles);
    }
  }

  setParticles(particles: SplatParticleData[]): void {
    this.particles = particles.map((particle) => ({ ...particle }));
    this.spatialHash.clear();
    for (const particle of this.particles) {
      this.spatialHash.upsert(particle);
    }
  }

  getParticles(): SplatParticleData[] {
    return this.particles;
  }

  step(delta: number, influence?: SolverInfluence): void {
    const { gravity, iterations } = this.config;
    const dt = Math.min(delta, 0.033);

    for (const particle of this.particles) {
      particle.velocity[0] += gravity[0] * dt;
      particle.velocity[1] += gravity[1] * dt;
      particle.velocity[2] += gravity[2] * dt;
    }

    this.solveMaterials(dt, influence);
    this.integrate(dt);
  }

  private solveMaterials(dt: number, influence?: SolverInfluence): void {
    const impulses = influence?.impulses ?? [];
    const charPos = influence?.characterPosition;

    for (let iter = 0; iter < this.config.iterations; iter += 1) {
      this.spatialHash.clear();
      for (const particle of this.particles) {
        this.spatialHash.upsert(particle);
      }

      for (const particle of this.particles) {
        const materialConfig = this.config.materials[particle.material];
        switch (particle.material) {
          case "glass":
            this.solveGlass(particle, materialConfig, dt);
            break;
          case "smoke":
            this.solveSmoke(particle, materialConfig, dt, charPos);
            break;
          case "water":
            this.solveWater(particle, materialConfig, dt);
            break;
        }
      }

      for (const impulse of impulses) {
        this.applyImpulseSphere(impulse.origin, impulse.radius, impulse.strength * dt);
      }
    }
  }

  private integrate(dt: number): void {
    for (const particle of this.particles) {
      particle.position[0] += particle.velocity[0] * dt;
      particle.position[1] += particle.velocity[1] * dt;
      particle.position[2] += particle.velocity[2] * dt;

      if (particle.material === "smoke") {
        particle.opacity *= this.config.materials.smoke.fade ?? 1;
        if (particle.opacity < 0.05) {
          particle.opacity = 0.05;
        }
      }

      if (particle.position[1] < -4) {
        particle.position[1] = -4;
        particle.velocity[1] *= -0.1;
      }

      const speed =
        particle.velocity[0] ** 2 + particle.velocity[1] ** 2 + particle.velocity[2] ** 2;
      if (particle.material === "glass") {
        const shatterVelocity = this.config.materials.glass.shatterVelocity ?? 5;
        if (!particle.shattered && speed > shatterVelocity ** 2) {
          particle.shattered = true;
          const restitution = this.config.materials.glass.restitution ?? 0.2;
          particle.velocity[0] *= restitution;
          particle.velocity[1] *= restitution;
          particle.velocity[2] *= restitution;
        }
      }
    }
  }

  private solveGlass(
    particle: SplatParticleData,
    materialConfig: PhysicsMaterialConfig,
    dt: number,
  ): void {
    const cohesion = materialConfig.cohesion ?? 0.5;
    const neighbors = this.spatialHash.query(particle.position, 0.8, "glass");
    for (const neighbor of neighbors) {
      if (neighbor.id === particle.id) {
        continue;
      }
      const dx = neighbor.position[0] - particle.position[0];
      const dy = neighbor.position[1] - particle.position[1];
      const dz = neighbor.position[2] - particle.position[2];
      const distanceSq = dx * dx + dy * dy + dz * dz + 1e-6;
      const distance = Math.sqrt(distanceSq);
      const restDistance = (particle.scale + neighbor.scale) * 0.8;
      const diff = restDistance - distance;
      if (diff > 0) {
        const correction = (diff * cohesion * 0.5);
        const nx = dx / distance;
        const ny = dy / distance;
        const nz = dz / distance;
        particle.position[0] -= nx * correction;
        particle.position[1] -= ny * correction;
        particle.position[2] -= nz * correction;
        particle.velocity[0] -= nx * correction / dt;
        particle.velocity[1] -= ny * correction / dt;
        particle.velocity[2] -= nz * correction / dt;
      }
    }
  }

  private solveSmoke(
    particle: SplatParticleData,
    materialConfig: PhysicsMaterialConfig,
    dt: number,
    characterPosition?: [number, number, number],
  ): void {
    const repulsion = materialConfig.repulsion ?? 1;
    const neighbors = this.spatialHash.query(particle.position, 1.2, "smoke");
    for (const neighbor of neighbors) {
      if (neighbor.id === particle.id) {
        continue;
      }
      const dx = particle.position[0] - neighbor.position[0];
      const dy = particle.position[1] - neighbor.position[1];
      const dz = particle.position[2] - neighbor.position[2];
      const distanceSq = dx * dx + dy * dy + dz * dz + 1e-6;
      if (distanceSq > 0.01) {
        const strength = repulsion / distanceSq;
        particle.velocity[0] += (dx * strength) * dt;
        particle.velocity[1] += (dy * strength) * dt;
        particle.velocity[2] += (dz * strength) * dt;
      }
    }

    if (characterPosition) {
      const dx = particle.position[0] - characterPosition[0];
      const dy = particle.position[1] - characterPosition[1];
      const dz = particle.position[2] - characterPosition[2];
      const distanceSq = dx * dx + dy * dy + dz * dz + 1e-4;
      const force = 1.5 / distanceSq;
      particle.velocity[0] += (dx * force) * dt;
      particle.velocity[1] += (dy * force) * dt;
      particle.velocity[2] += (dz * force) * dt;
    }
  }

  private solveWater(
    particle: SplatParticleData,
    materialConfig: PhysicsMaterialConfig,
    dt: number,
  ): void {
    const poolHeight = materialConfig.poolHeight ?? 0;
    const surfaceTension = materialConfig.surfaceTension ?? 0.2;
    if (particle.position[1] < poolHeight) {
      particle.position[1] = poolHeight;
      particle.velocity[1] *= -0.2;
    }
    const neighbors = this.spatialHash.query(particle.position, 0.6, "water");
    const centroid: [number, number, number] = [0, 0, 0];
    let count = 0;
    for (const neighbor of neighbors) {
      if (neighbor.id === particle.id) {
        continue;
      }
      centroid[0] += neighbor.position[0];
      centroid[1] += neighbor.position[1];
      centroid[2] += neighbor.position[2];
      count += 1;
    }
    if (count > 0) {
      centroid[0] /= count;
      centroid[1] /= count;
      centroid[2] /= count;
      particle.velocity[0] += (centroid[0] - particle.position[0]) * surfaceTension * dt;
      particle.velocity[1] += (centroid[1] - particle.position[1]) * surfaceTension * dt;
      particle.velocity[2] += (centroid[2] - particle.position[2]) * surfaceTension * dt;
    }
  }

  applyImpulseSphere(origin: [number, number, number], radius: number, strength: number): void {
    const affected = this.spatialHash.query(origin, radius);
    for (const particle of affected) {
      const dx = particle.position[0] - origin[0];
      const dy = particle.position[1] - origin[1];
      const dz = particle.position[2] - origin[2];
      const distanceSq = dx * dx + dy * dy + dz * dz + 1e-6;
      const falloff = Math.max(0, 1 - Math.sqrt(distanceSq) / radius);
      particle.velocity[0] += (dx * strength) * falloff;
      particle.velocity[1] += (dy * strength) * falloff;
      particle.velocity[2] += (dz * strength) * falloff;
    }
  }

  shatter(material: MaterialType, origin: [number, number, number], radius: number): void {
    const particles = this.spatialHash.query(origin, radius, material);
    for (const particle of particles) {
      particle.shattered = true;
      particle.velocity[0] += (Math.random() - 0.5) * 10;
      particle.velocity[1] += (Math.random() * 8);
      particle.velocity[2] += (Math.random() - 0.5) * 10;
    }
  }

  explode(material: MaterialType, origin: [number, number, number], force: number): void {
    const particles = this.spatialHash.query(origin, 2.5, material);
    for (const particle of particles) {
      const dx = particle.position[0] - origin[0];
      const dy = particle.position[1] - origin[1];
      const dz = particle.position[2] - origin[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
      const factor = force / distance;
      particle.velocity[0] += dx * factor;
      particle.velocity[1] += dy * factor;
      particle.velocity[2] += dz * factor;
    }
  }
}
