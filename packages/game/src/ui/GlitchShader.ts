import Phaser from "phaser";

/**
 * PostFX pipeline that applies a VHS/digital glitch effect.
 * Horizontal slice displacement, RGB channel separation, and scanline noise.
 * Controlled by `uIntensity` (0 = off, 1 = full glitch).
 */
export class GlitchPostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _intensity = 0;
  private _time = 0;
  private _seed = 0;

  static readonly KEY = "GlitchPostFX";

  constructor(game: Phaser.Game) {
    super({
      game,
      name: GlitchPostFX.KEY,
      fragShader: `
        precision mediump float;

        uniform sampler2D uMainSampler;
        uniform vec2 uResolution;
        uniform float uIntensity;
        uniform float uTime;
        uniform float uSeed;

        varying vec2 outTexCoord;

        // Pseudo-random hash
        float hash(float n) {
          return fract(sin(n) * 43758.5453123);
        }

        float hash2(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec2 uv = outTexCoord;
          float intensity = uIntensity;

          if (intensity < 0.001) {
            gl_FragColor = texture2D(uMainSampler, uv);
            return;
          }

          // Horizontal slice displacement
          float sliceCount = 12.0;
          float sliceY = floor(uv.y * sliceCount) / sliceCount;
          float sliceRand = hash(sliceY * 100.0 + uSeed);

          // Only displace some slices (random selection)
          float displaceAmount = 0.0;
          if (sliceRand > 0.5) {
            displaceAmount = (sliceRand - 0.5) * 2.0 * intensity * 0.06;
            // Alternate direction
            if (hash(sliceY * 200.0 + uSeed) > 0.5) displaceAmount = -displaceAmount;
          }

          vec2 displaceUV = vec2(uv.x + displaceAmount, uv.y);

          // RGB channel separation (chromatic aberration)
          float rgbShift = intensity * 0.008;
          float r = texture2D(uMainSampler, vec2(displaceUV.x + rgbShift, displaceUV.y)).r;
          float g = texture2D(uMainSampler, displaceUV).g;
          float b = texture2D(uMainSampler, vec2(displaceUV.x - rgbShift, displaceUV.y)).b;
          float a = texture2D(uMainSampler, displaceUV).a;

          vec4 color = vec4(r, g, b, a);

          // Scanline noise (subtle horizontal lines)
          float scanline = sin(uv.y * uResolution.y * 1.5 + uTime * 10.0) * 0.5 + 0.5;
          scanline = mix(1.0, scanline, intensity * 0.15);
          color.rgb *= scanline;

          // Random block corruption (small bright/dark patches)
          float blockX = floor(uv.x * 20.0);
          float blockY = floor(uv.y * 20.0);
          float blockNoise = hash2(vec2(blockX, blockY) + uSeed);
          if (blockNoise > 0.97 && intensity > 0.3) {
            color.rgb += vec3(0.3) * intensity;
          }

          gl_FragColor = color;
        }
      `,
    });

    this._intensity = 0;
    this._time = 0;
    this._seed = 0;
  }

  setIntensity(v: number): this {
    this._intensity = v;
    return this;
  }

  setSeed(v: number): this {
    this._seed = v;
    return this;
  }

  onPreRender(): void {
    this._time += 0.016; // ~60fps tick
    this.set2f("uResolution", this.renderer.width, this.renderer.height);
    this.set1f("uIntensity", this._intensity);
    this.set1f("uTime", this._time);
    this.set1f("uSeed", this._seed);
  }
}
