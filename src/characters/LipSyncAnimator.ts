import type { BillboardCharacter, VisemeId } from "@/characters/BillboardCharacter";

const VISemeSequence: VisemeId[] = ["Rest", "M", "A", "E", "I", "O", "U", "F", "L"];

export class LipSyncAnimator {
  private readonly analyser: AnalyserNode;
  private readonly dataArray: Uint8Array;
  private readonly character: BillboardCharacter;
  private lastViseme: VisemeId = "Rest";

  constructor(audioContext: AudioContext, source: AudioNode, character: BillboardCharacter) {
    this.character = character;
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    source.connect(this.analyser);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  update(): void {
    this.analyser.getByteFrequencyData(this.dataArray as unknown as Uint8Array<ArrayBuffer>);
    let total = 0;
    for (let i = 0; i < this.dataArray.length; i += 1) {
      total += this.dataArray[i];
    }
    const average = total / this.dataArray.length;
    const visemeIndex = Math.min(VISemeSequence.length - 1, Math.floor((average / 255) * VISemeSequence.length));
    const viseme = VISemeSequence[visemeIndex];
    if (viseme !== this.lastViseme) {
      this.character.setViseme(viseme);
      this.lastViseme = viseme;
    }
  }
}
