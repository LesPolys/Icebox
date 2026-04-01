import Phaser from "phaser";

/**
 * PostFX pipeline that draws a pixel-perfect outline around non-transparent
 * pixels of the source texture. The outline follows the actual perimeter
 * of the rendered object rather than drawing a simple rectangle.
 */
export class OutlinePostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _color: Phaser.Display.Color;
  private _thickness: number;

  static readonly KEY = "OutlinePostFX";

  constructor(game: Phaser.Game) {
    super({
      game,
      name: OutlinePostFX.KEY,
      fragShader: `
        precision mediump float;

        uniform sampler2D uMainSampler;
        uniform vec2 uResolution;
        uniform vec4 uOutlineColor;
        uniform float uThickness;

        varying vec2 outTexCoord;

        void main() {
          vec4 col = texture2D(uMainSampler, outTexCoord);
          float a = col.a;

          // Sample neighbours at uThickness distance
          vec2 texelSize = vec2(1.0) / uResolution;
          float t = uThickness;

          float up    = texture2D(uMainSampler, outTexCoord + vec2(0.0,  t) * texelSize).a;
          float down  = texture2D(uMainSampler, outTexCoord + vec2(0.0, -t) * texelSize).a;
          float left  = texture2D(uMainSampler, outTexCoord + vec2(-t,  0.0) * texelSize).a;
          float right = texture2D(uMainSampler, outTexCoord + vec2( t,  0.0) * texelSize).a;

          // Diagonals for smoother outline
          float ul = texture2D(uMainSampler, outTexCoord + vec2(-t,  t) * texelSize).a;
          float ur = texture2D(uMainSampler, outTexCoord + vec2( t,  t) * texelSize).a;
          float dl = texture2D(uMainSampler, outTexCoord + vec2(-t, -t) * texelSize).a;
          float dr = texture2D(uMainSampler, outTexCoord + vec2( t, -t) * texelSize).a;

          float maxNeighbour = max(max(max(up, down), max(left, right)),
                                   max(max(ul, ur), max(dl, dr)));

          // Outline where pixel is transparent but neighbour is opaque
          float outline = maxNeighbour * (1.0 - a);

          vec4 outlineCol = uOutlineColor * outline;
          gl_FragColor = mix(outlineCol, col, a);
        }
      `,
    });

    this._color = new Phaser.Display.Color(204, 51, 51, 255);
    this._thickness = 2.0;
  }

  setOutlineColor(r: number, g: number, b: number, a = 255): this {
    this._color.setTo(r, g, b, a);
    return this;
  }

  setThickness(t: number): this {
    this._thickness = t;
    return this;
  }

  onPreRender(): void {
    this.set2f("uResolution", this.renderer.width, this.renderer.height);
    this.set4f(
      "uOutlineColor",
      this._color.redGL,
      this._color.greenGL,
      this._color.blueGL,
      this._color.alphaGL
    );
    this.set1f("uThickness", this._thickness);
  }
}
