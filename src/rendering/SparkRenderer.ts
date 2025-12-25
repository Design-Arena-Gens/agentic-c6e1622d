import type { SceneConfig, SplatParticleData } from "@/core/types";

interface ProgressiveLoadOptions {
  onChunkLoaded?: (index: number, total: number) => void;
}

export class SparkRendererManager {
  private particles: SplatParticleData[] = [];
  private sparkInstance: unknown;

  constructor(private readonly sceneConfig: SceneConfig) {}

  async load(options: ProgressiveLoadOptions = {}): Promise<SplatParticleData[]> {
    this.particles = [];
    const total = this.sceneConfig.chunks.length;
    for (let index = 0; index < total; index += 1) {
      const chunk = this.sceneConfig.chunks[index];
      const response = await fetch(chunk.url);
      if (!response.ok) {
        throw new Error(`Failed to load chunk ${chunk.id}`);
      }
      const json = (await response.json()) as { particles: SplatParticleData[] };
      for (const particle of json.particles) {
        this.particles.push({ ...particle, material: chunk.material });
      }
      options.onChunkLoaded?.(index + 1, total);
    }
    await this.ensureSpark();
    return this.particles;
  }

  getParticles(): SplatParticleData[] {
    return this.particles;
  }

  getSpark(): unknown {
    return this.sparkInstance;
  }

  private async ensureSpark(): Promise<void> {
    if (this.sparkInstance) {
      return;
    }
    try {
      const module = await import("@sparkjs/renderer");
      const { SparkRenderer } = module as { SparkRenderer: new () => unknown };
      this.sparkInstance = new SparkRenderer();
    } catch (error) {
      console.warn("Spark renderer not available, continuing without native renderer", error);
      this.sparkInstance = null;
    }
  }
}
