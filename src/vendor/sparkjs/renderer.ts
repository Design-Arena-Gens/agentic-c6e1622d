export interface SparkSceneConfig {
  splatAlpha?: number;
}

export class SparkRenderer {
  private readonly config: SparkSceneConfig;
  private readonly files: string[] = [];

  constructor(config: SparkSceneConfig = {}) {
    this.config = config;
  }

  async loadFile(url: string): Promise<void> {
    this.files.push(url);
  }

  setScene(): void {
    // noop stub for compatibility
  }

  getScene(): { files: string[]; config: SparkSceneConfig } {
    return { files: this.files, config: this.config };
  }
}
