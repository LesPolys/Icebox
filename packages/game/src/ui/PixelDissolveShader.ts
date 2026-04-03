import Phaser from "phaser";

/**
 * PostFX pipeline that creates a "chunky beam-up" dissolve effect.
 * Blocks pixelate, shift upward, and vanish in a wave from bottom to top.
 * Controlled by `uProgress` (0 = fully visible, 1 = fully dissolved/beamed away).
 *
 * The key visual: blocks don't just fade — they physically displace upward
 * as if being teleported, giving a Star Trek transporter / data-upload feel.
 */
export class PixelDissolvePostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _progress = 0;
  private _blockSize = 12.0;
  private _direction = 1.0; // 1 = beam UP (close), -1 = beam DOWN (open/reconstruct)

  static readonly KEY = "PixelDissolvePostFX";

  constructor(game: Phaser.Game) {
    super({
      game,
      name: PixelDissolvePostFX.KEY,
      fragShader: `
        precision mediump float;

        uniform sampler2D uMainSampler;
        uniform vec2 uResolution;
        uniform float uProgress;
        uniform float uBlockSize;
        uniform float uDirection;

        varying vec2 outTexCoord;

        // Pseudo-random hash for per-block variation
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec2 uv = outTexCoord;

          // Fully visible — pass through
          if (uProgress < 0.001) {
            gl_FragColor = texture2D(uMainSampler, uv);
            return;
          }

          // Fully dissolved — transparent
          if (uProgress > 0.999) {
            gl_FragColor = vec4(0.0);
            return;
          }

          // Compute block coordinates
          vec2 pixelCoord = uv * uResolution;
          vec2 blockCoord = floor(pixelCoord / uBlockSize);
          vec2 blockUV = (blockCoord * uBlockSize + uBlockSize * 0.5) / uResolution;

          // Per-block random for stagger
          float rnd = hash(blockCoord);

          // Dissolve wave: bottom rows go first when beaming UP (uDirection=1)
          // blockY: 0=top, 1=bottom in UV space
          float blockY = blockCoord.y * uBlockSize / uResolution.y;
          // For beam-up: bottom blocks leave first (high blockY = low threshold)
          // For beam-down/reconstruct: top blocks arrive first
          float wavePos = uDirection > 0.0 ? (1.0 - blockY) : blockY;

          // Threshold: when progress passes this, the block starts beaming
          float threshold = wavePos * 0.6 + rnd * 0.3;

          // Transition band
          float band = 0.25;
          float t = smoothstep(threshold, threshold + band, uProgress);

          if (t >= 0.99) {
            // Fully beamed away
            gl_FragColor = vec4(0.0);
            return;
          }

          if (t > 0.01) {
            // ── In transition: pixelate + beam upward ──

            // Vertical displacement: block shifts UP as t increases
            // Max displacement = 30% of texture height (strong beam feel)
            float beamOffset = t * t * 0.3 * uDirection;
            vec2 displacedUV = blockUV + vec2(0.0, -beamOffset);

            // If displaced UV goes out of bounds, block is gone
            if (displacedUV.y < 0.0 || displacedUV.y > 1.0) {
              gl_FragColor = vec4(0.0);
              return;
            }

            // Sample from block center (pixelation) at displaced position
            vec4 blockColor = texture2D(uMainSampler, displacedUV);

            // Brightness flash — blocks glow as they beam
            float flash = sin(t * 3.14159) * 0.25;
            blockColor.rgb += flash;

            // Slight teal tint during beam (data-upload feel)
            float tealMix = sin(t * 3.14159) * 0.15;
            blockColor.rgb += vec3(-tealMix * 0.3, tealMix * 0.5, tealMix * 0.5);

            // Fade out as block finishes beaming
            float fadeStart = 0.4;
            float alpha = t < fadeStart ? 1.0 : 1.0 - smoothstep(fadeStart, 1.0, t);
            blockColor.a *= alpha;

            gl_FragColor = blockColor;
            return;
          }

          // Not yet reached by beam wave — pass through normally
          gl_FragColor = texture2D(uMainSampler, uv);
        }
      `,
    });
  }

  setProgress(v: number): this {
    this._progress = v;
    return this;
  }

  setBlockSize(v: number): this {
    this._blockSize = v;
    return this;
  }

  setDirection(v: number): this {
    this._direction = v;
    return this;
  }

  onPreRender(): void {
    this.set2f("uResolution", this.renderer.width, this.renderer.height);
    this.set1f("uProgress", this._progress);
    this.set1f("uBlockSize", this._blockSize);
    this.set1f("uDirection", this._direction);
  }
}
