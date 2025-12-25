import type { BillboardCharacter } from "@/characters/BillboardCharacter";
import { Vector3 } from "three";

interface WalkPath {
  points: Vector3[];
  duration: number;
  elapsed: number;
}

export class WalkController {
  private readonly character: BillboardCharacter;
  private currentPath?: WalkPath;
  private bobTime = 0;

  constructor(character: BillboardCharacter) {
    this.character = character;
  }

  setPath(points: Array<[number, number, number]>, duration: number): void {
    const vectors = points.map((point) => new Vector3(...point));
    this.currentPath = {
      points: vectors,
      duration,
      elapsed: 0,
    };
  }

  update(delta: number): void {
    if (!this.currentPath) {
      return;
    }
    const { duration, points } = this.currentPath;
    this.currentPath.elapsed = Math.min(this.currentPath.elapsed + delta, duration);
    const t = this.currentPath.elapsed / duration;
    const segmentLength = points.length - 1;
    if (segmentLength <= 0) {
      return;
    }
    const scaledT = t * segmentLength;
    const index = Math.min(Math.floor(scaledT), segmentLength - 1);
    const localT = scaledT - index;
    const start = points[index];
    const end = points[index + 1];
    const position = start.clone().lerp(end, localT);
    this.bobTime += delta * 4;
    position.y += Math.sin(this.bobTime) * 0.05;
    this.character.position.copy(position);
    if (this.currentPath.elapsed >= duration) {
      this.currentPath = undefined;
    }
  }

  getPosition(): Vector3 {
    return this.character.position;
  }
}
