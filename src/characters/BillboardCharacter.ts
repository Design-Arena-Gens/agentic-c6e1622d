import { CanvasTexture, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Texture, Vector3 } from "three";

export type VisemeId = "A" | "E" | "I" | "O" | "U" | "M" | "L" | "F" | "Rest";

const VISEME_ORDER: VisemeId[] = ["A", "E", "I", "O", "U", "M", "L", "F", "Rest"];
const VISEME_LOOKUP = new Map<VisemeId, number>(VISEME_ORDER.map((viseme, index) => [viseme, index]));

const vertexShader = /* glsl */ `
  uniform sampler2D depthMap;
  uniform float depthScale;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 depthSample = texture2D(depthMap, uv);
    float displacement = depthSample.r * depthScale;
    vec3 displacedPosition = position + normal * displacement;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float opacity;
  uniform float visemeIndex;
  varying vec2 vUv;

  vec2 resolveAtlasUv(vec2 uv, float index) {
    float column = mod(index, 3.0);
    float row = floor(index / 3.0);
    vec2 tileUv = uv / 3.0;
    tileUv.x += column / 3.0;
    tileUv.y += row / 3.0;
    return tileUv;
  }

  void main() {
    vec2 atlasUv = resolveAtlasUv(vUv, visemeIndex);
    vec4 color = texture2D(map, atlasUv);
    if (color.a < 0.05) {
      discard;
    }
    gl_FragColor = vec4(color.rgb, color.a * opacity);
  }
`;

const faceCameraVector = new Vector3();

const createVisemeTexture = (): Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas 2D context");
  }

  ctx.fillStyle = "#00000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const visemeStyle = [
    { mouth: () => ctx.ellipse(0, 0, 0.22, 0.28, 0, 0, Math.PI * 2) },
    { mouth: () => ctx.rect(-0.2, -0.06, 0.4, 0.12) },
    { mouth: () => ctx.rect(-0.18, -0.04, 0.36, 0.08) },
    { mouth: () => ctx.ellipse(0, 0, 0.18, 0.24, 0, 0, Math.PI * 2) },
    { mouth: () => ctx.ellipse(0, 0, 0.15, 0.26, 0, 0, Math.PI * 2) },
    { mouth: () => ctx.rect(-0.16, -0.02, 0.32, 0.04) },
    { mouth: () => ctx.rect(-0.12, -0.08, 0.24, 0.08) },
    { mouth: () => ctx.rect(-0.14, -0.02, 0.28, 0.1) },
    { mouth: () => ctx.rect(-0.12, -0.02, 0.24, 0.04) },
  ];

  const drawViseme = (index: number) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = column * (canvas.width / 3);
    const y = row * (canvas.height / 3);
    ctx.save();
    ctx.translate(x + canvas.width / 6, y + canvas.height / 6);
    ctx.scale(canvas.width / 6, canvas.height / 6);

    ctx.fillStyle = "#1b2a39";
    ctx.beginPath();
    ctx.ellipse(0, 0.3, 0.5, 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f8f4ff";
    ctx.beginPath();
    ctx.ellipse(0, -0.35, 0.24, 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#c0d3ff";
    ctx.beginPath();
    ctx.ellipse(0.12, -0.36, 0.08, 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(-0.3, -0.1);
    ctx.quadraticCurveTo(0, -0.16, 0.3, -0.1);
    ctx.stroke();

    ctx.fillStyle = "#f4588a";
    ctx.beginPath();
    visemeStyle[index].mouth();
    ctx.fill();
    ctx.restore();
  };

  for (let i = 0; i < 9; i += 1) {
    drawViseme(i);
  }

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

const createDepthTexture = (): Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create depth map canvas");
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(1, "#202020");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return new CanvasTexture(canvas);
};

export class BillboardCharacter extends Mesh<PlaneGeometry, ShaderMaterial> {
  private currentViseme: VisemeId = "Rest";
  private readonly mouthTexture: Texture;
  private readonly depthTexture: Texture;

  constructor() {
    const geometry = new PlaneGeometry(1.4, 3.1, 64, 64);
    const mouthTexture = createVisemeTexture();
    const depthTexture = createDepthTexture();
    const material = new ShaderMaterial({
      uniforms: {
        map: { value: mouthTexture },
        depthMap: { value: depthTexture },
        depthScale: { value: 0.45 },
        opacity: { value: 1 },
        visemeIndex: { value: VISEME_LOOKUP.get("Rest") ?? 8 },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      vertexShader,
      fragmentShader,
    });
    super(geometry, material);
    this.mouthTexture = mouthTexture;
    this.depthTexture = depthTexture;
    this.frustumCulled = false;
    this.onBeforeRender = (_, __, camera) => {
      faceCameraVector.set(camera.position.x, this.position.y, camera.position.z);
      this.lookAt(faceCameraVector);
      this.rotation.x = 0;
      this.rotation.z = 0;
    };
  }

  setViseme(viseme: VisemeId): void {
    const index = VISEME_LOOKUP.get(viseme);
    if (index === undefined) {
      return;
    }
    this.currentViseme = viseme;
    this.material.uniforms.visemeIndex.value = index;
  }

  getViseme(): VisemeId {
    return this.currentViseme;
  }

  setOpacity(opacity: number): void {
    this.material.uniforms.opacity.value = opacity;
  }

  setDepthMap(texture: Texture): void {
    this.material.uniforms.depthMap.value = texture;
  }
}
