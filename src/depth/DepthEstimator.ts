import { CanvasTexture } from "three";
import * as ort from "onnxruntime-web";

ort.env.wasm.wasmPaths = "/wasm";

type OrtInferenceSession = ort.InferenceSession;
type OrtTensor = ort.Tensor;

export class DepthEstimator {
  private sessionPromise?: Promise<OrtInferenceSession>;

  private async getSession(): Promise<OrtInferenceSession> {
    if (!this.sessionPromise) {
      const modelUrl = new URL("../models/depth-identity.onnx", import.meta.url);
      this.sessionPromise = ort.InferenceSession.create(modelUrl.href, {
        executionProviders: ["wasm"],
      });
    }
    return this.sessionPromise;
  }

  async generateDepthTexture(size = 32): Promise<CanvasTexture> {
    const session = await this.getSession();
    const input = this.createWaveInput(size);
    const feeds: Record<string, OrtTensor> = {
      input,
    };
    const results = await session.run(feeds);
    const output = results.output as OrtTensor;
    const texture = this.tensorToTexture(output, size);
    return texture;
  }

  private createWaveInput(size: number): OrtTensor {
    const data = new Float32Array(size * size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const u = x / size;
        const v = y / size;
        data[y * size + x] = (Math.sin(u * Math.PI * 2) + Math.cos(v * Math.PI * 2)) * 0.5 + 0.5;
      }
    }
    return new ort.Tensor("float32", data, [1, 1, size, size]);
  }

  private tensorToTexture(tensor: OrtTensor, size: number): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to create 2D context for depth texture");
    }
    const imageData = ctx.createImageData(size, size);
    const data = tensor.data as Float32Array;
    for (let i = 0; i < data.length; i += 1) {
      const value = Math.min(1, Math.max(0, data[i]));
      imageData.data[i * 4] = value * 255;
      imageData.data[i * 4 + 1] = value * 255;
      imageData.data[i * 4 + 2] = value * 255;
      imageData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return new CanvasTexture(canvas);
  }
}
