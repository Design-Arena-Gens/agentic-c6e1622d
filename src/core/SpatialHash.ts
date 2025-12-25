import type { MaterialType, SplatParticleData } from "@/core/types";

export interface SpatialHashOptions {
  cellSize: number;
}

interface HashEntry {
  particle: SplatParticleData;
  cellKey: string;
}

/**
 * SpatialHash partitions particles into grid cells for efficient neighbor queries.
 */
export class SpatialHash {
  private readonly cellSize: number;
  private readonly cells = new Map<string, SplatParticleData[]>();
  private readonly lookup = new Map<string, HashEntry>();

  constructor(options: SpatialHashOptions) {
    this.cellSize = options.cellSize;
  }

  private toCellKey(position: [number, number, number]): string {
    const x = Math.floor(position[0] / this.cellSize);
    const y = Math.floor(position[1] / this.cellSize);
    const z = Math.floor(position[2] / this.cellSize);
    return `${x}:${y}:${z}`;
  }

  upsert(particle: SplatParticleData): void {
    const key = this.toCellKey(particle.position);
    const existing = this.lookup.get(particle.id);
    if (existing?.cellKey === key) {
      return;
    }

    if (existing) {
      const cell = this.cells.get(existing.cellKey);
      if (cell) {
        this.cells.set(
          existing.cellKey,
          cell.filter((entry) => entry.id !== particle.id),
        );
      }
    }

    const cellParticles = this.cells.get(key);
    if (!cellParticles) {
      this.cells.set(key, [particle]);
    } else {
      cellParticles.push(particle);
    }
    this.lookup.set(particle.id, { particle, cellKey: key });
  }

  remove(particleId: string): void {
    const existing = this.lookup.get(particleId);
    if (!existing) {
      return;
    }
    const cell = this.cells.get(existing.cellKey);
    if (cell) {
      this.cells.set(
        existing.cellKey,
        cell.filter((entry) => entry.id !== particleId),
      );
    }
    this.lookup.delete(particleId);
  }

  query(position: [number, number, number], radius: number, material?: MaterialType): SplatParticleData[] {
    const range = Math.ceil(radius / this.cellSize);
    const originKey = this.toCellKey(position).split(":").map(Number);
    const results: SplatParticleData[] = [];

    for (let x = -range; x <= range; x += 1) {
      for (let y = -range; y <= range; y += 1) {
        for (let z = -range; z <= range; z += 1) {
          const key = `${originKey[0] + x}:${originKey[1] + y}:${originKey[2] + z}`;
          const cell = this.cells.get(key);
          if (!cell) {
            continue;
          }
          for (const particle of cell) {
            if (material && particle.material !== material) {
              continue;
            }
            const dx = particle.position[0] - position[0];
            const dy = particle.position[1] - position[1];
            const dz = particle.position[2] - position[2];
            if (dx * dx + dy * dy + dz * dz <= radius * radius) {
              results.push(particle);
            }
          }
        }
      }
    }
    return results;
  }

  values(): Iterable<SplatParticleData> {
    return Array.from(this.lookup.values(), (entry) => entry.particle);
  }

  clear(): void {
    this.cells.clear();
    this.lookup.clear();
  }
}
