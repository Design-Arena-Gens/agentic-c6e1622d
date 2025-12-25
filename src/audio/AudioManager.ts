import type { AudioClip } from "@/core/types";

export class AudioManager {
  private readonly context: AudioContext;
  private clips = new Map<string, AudioBuffer>();
  private currentSource?: AudioBufferSourceNode;

  constructor(context: AudioContext) {
    this.context = context;
  }

  getContext(): AudioContext {
    return this.context;
  }

  async load(id: string, url: string): Promise<AudioClip> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load audio clip ${id}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await this.context.decodeAudioData(arrayBuffer);
    this.clips.set(id, buffer);
    return { id, buffer };
  }

  has(id: string): boolean {
    return this.clips.has(id);
  }

  play(id: string, options: { loop?: boolean; volume?: number } = {}): AudioBufferSourceNode {
    const buffer = this.clips.get(id);
    if (!buffer) {
      throw new Error(`Audio clip ${id} not loaded`);
    }
    const gain = this.context.createGain();
    gain.gain.value = options.volume ?? 1;
    gain.connect(this.context.destination);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop ?? false;
    source.connect(gain);
    source.start();
    this.currentSource = source;
    return source;
  }

  stop(): void {
    this.currentSource?.stop();
    this.currentSource = undefined;
  }
}
