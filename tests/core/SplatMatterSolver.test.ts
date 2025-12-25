import { describe, expect, it } from "vitest";
import { SplatMatterSolver } from "@/core/SplatMatterSolver";
import type { PhysicsConfig, SplatParticleData } from "@/core/types";

const physicsConfig: PhysicsConfig = {
  gravity: [0, -9.81, 0],
  timeStep: 0.016,
  iterations: 2,
  materials: {
    glass: {
      density: 2.5,
      cohesion: 0.9,
      shatterVelocity: 5,
      restitution: 0.2,
    },
    smoke: {
      density: 0.2,
      repulsion: 1.5,
      fade: 0.99,
    },
    water: {
      density: 1,
      surfaceTension: 0.3,
      poolHeight: 0,
    },
  },
};

const createParticle = (overrides: Partial<SplatParticleData>): SplatParticleData => ({
  id: "p",
  position: [0, 1, 0],
  velocity: [0, 0, 0],
  scale: 0.1,
  opacity: 1,
  material: "glass",
  color: [1, 1, 1],
  shattered: false,
  ...overrides,
});

describe("SplatMatterSolver", () => {
  it("keeps water particles above pool height", () => {
    const particles = [
      createParticle({
        id: "water",
        material: "water",
        position: [0, -0.5, 0],
      }),
    ];
    const solver = new SplatMatterSolver(physicsConfig, particles);
    solver.step(0.016);
    const [water] = solver.getParticles();
    expect(water.position[1]).toBeGreaterThanOrEqual(0);
  });

  it("marks glass particle as shattered when velocity surpasses threshold", () => {
    const particles = [
      createParticle({
        id: "glass",
        material: "glass",
        velocity: [10, 0, 0],
      }),
    ];
    const solver = new SplatMatterSolver(physicsConfig, particles);
    solver.step(0.016);
    const [glass] = solver.getParticles();
    expect(glass.shattered).toBe(true);
  });

  it("repels smoke particles from character position", () => {
    const particles = [
      createParticle({
        id: "smoke",
        material: "smoke",
        position: [0, 1, 0],
        velocity: [0, 0, 0],
      }),
    ];
    const solver = new SplatMatterSolver(physicsConfig, particles);
    solver.step(0.016, { characterPosition: [0, 1, 0.1] });
    const [smoke] = solver.getParticles();
    expect(smoke.velocity[2]).toBeLessThan(0);
  });
});
