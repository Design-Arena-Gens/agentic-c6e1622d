import { useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, ChromaticAberration, ToneMapping, LUT, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { Suspense } from "react";
import { ACESFilmicToneMapping, Vector2 } from "three";
import { LUT3dlLoader } from "three-stdlib";
import { useLoader } from "@react-three/fiber";

const LUTLoader = () => {
  const lut = useLoader(LUT3dlLoader, "/luts/cinematic.cube");
  return lut.texture;
};

const PostProcessorInner = () => {
  const { gl } = useThree();
  gl.toneMapping = ACESFilmicToneMapping;
  gl.toneMappingExposure = 1;

  const lutTexture = LUTLoader();

  return (
    <EffectComposer>
      <Bloom intensity={1.5} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur radius={0.4} />
      <ToneMapping />
      <LUT lut={lutTexture} />
      <ChromaticAberration
        offset={new Vector2(0.003, 0.003)}
        blendFunction={BlendFunction.NORMAL}
        radialModulation={false}
        modulationOffset={0}
      />
      <Vignette eskil={false} offset={0.5} darkness={0.4} />
    </EffectComposer>
  );
};

export const PostProcessor = () => (
  <Suspense fallback={null}>
    <PostProcessorInner />
  </Suspense>
);
