import Phaser from "phaser";
import { BAROK_GLYPHS } from "./barok-glyphs";

/** Per-character kern adjustments for narrow glyphs that need tighter advance. */
const KERN_OVERRIDES: Record<string, number> = {
  "I": 0.7,
};

/**
 * Body bounds [top, bottom] in the 100-unit glyph grid.
 * Many Barok glyphs have thin decorative flourish spikes that extend beyond the
 * main letterform, inflating the bounding box used during extraction. This data
 * defines where the actual visual mass sits so the renderer can normalize sizes.
 */
const BODY_BOUNDS: Record<string, [number, number]> = {
  // Flourished — narrow decorative spike at top, body starts at wide horizontal bar
  "A": [13.5, 97.8], "B": [13.5, 97.8], "C": [13.5, 97.8],
  "E": [13.5, 97.8], "F": [13.5, 97.8], "G": [13.5, 97.8],
  "J": [14.4, 97.8], "P": [14.4, 97.8], "R": [14.4, 97.8],
  "T": [13.5, 97.8],
  // Full-body — no flourish, visual mass fills the grid
  "D": [2.5, 97.5], "H": [2.5, 97.5], "I": [2.5, 97.5],
  "K": [2.5, 97.5], "L": [2.5, 97.5], "M": [2.5, 97.5],
  "N": [2.5, 97.5], "O": [2.5, 97.5], "Q": [2.2, 97.8],
  "U": [2.5, 97.5], "V": [2.5, 97.5], "W": [2.5, 97.5],
  "X": [2.5, 97.5], "Y": [2.5, 97.5],
  // Double flourish — decorative strokes at both top and bottom
  "S": [12.1, 88], "Z": [12, 87],
};

/** Reference body range — flourished letters define the target alignment. */
const REF_BODY_TOP = 13.5;
const REF_BODY_BOTTOM = 97.8;
const REF_BODY_HEIGHT = REF_BODY_BOTTOM - REF_BODY_TOP;

/** Compute per-glyph scale and Y offset to align body bounds to the reference. */
function getGlyphAdj(char: string): { scale: number; yOffset: number } {
  const bounds = BODY_BOUNDS[char];
  if (!bounds) return { scale: 1, yOffset: 0 };
  const [bt, bb] = bounds;
  const bodyH = bb - bt;
  const s = REF_BODY_HEIGHT / bodyH;
  const yOff = REF_BODY_TOP - bt * s;
  return { scale: s, yOffset: yOff };
}

/**
 * Render text using the extracted Barok Display Typeface SVG glyphs.
 * Uses native Canvas2D Path2D with evenodd fill for proper glyph cutouts.
 *
 * Returns a Container with a single Image child positioned at (x, y).
 */
export function renderBarokText(
  scene: Phaser.Scene,
  text: string,
  color: number,
  sizePx: number,
  x: number,
  y: number,
  alpha = 1,
  kern = 1.0
): Phaser.GameObjects.Container {
  const upper = text.toUpperCase();
  const totalW = measureBarokText(text, sizePx, kern);
  const totalH = sizePx * 1.15; // glyphs fit within ~115% of size (extra room for body-normalized scaling)
  const container = scene.add.container(x, y);

  if (totalW <= 0) return container;

  // Render to an offscreen canvas using Path2D + evenodd
  const dpr = 2; // render at 2x for crispness
  const canvasW = Math.ceil(totalW * dpr) + 4;
  const canvasH = Math.ceil(totalH * dpr) + 4;
  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // Convert numeric color to CSS
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;

  const scale = sizePx / 100;
  let cursorX = 0;

  for (const char of upper) {
    if (char === " ") { cursorX += sizePx * 0.35; continue; }
    const glyph = BAROK_GLYPHS[char];
    if (!glyph) continue;

    const [advanceWidth, pathData] = glyph;

    if (pathData.length > 0) {
      const adj = getGlyphAdj(char);
      const effScale = scale * adj.scale;
      const yOff = adj.yOffset * scale;
      const transformed = transformSvgPath(pathData, cursorX, yOff, effScale);
      const path = new Path2D(transformed);
      ctx.fill(path, "evenodd");
    }

    const charKern = KERN_OVERRIDES[char] ?? 1.0;
    const adjScale = (getGlyphAdj(char)).scale;
    cursorX += advanceWidth * scale * adjScale * kern * charKern;
  }

  // Create a Phaser texture from the canvas
  const texKey = `barok_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  scene.textures.addCanvas(texKey, canvas);
  const img = scene.add.image(totalW / 2, totalH / 2, texKey);
  img.setDisplaySize(totalW, totalH);
  container.add(img);

  return container;
}

/** Measure the total width of a Barok text string (in pixels). */
export function measureBarokText(text: string, sizePx: number, kern = 1.0): number {
  const upper = text.toUpperCase();
  const scale = sizePx / 100;
  let width = 0;

  for (const char of upper) {
    if (char === " ") { width += sizePx * 0.35; continue; }
    const glyph = BAROK_GLYPHS[char];
    if (!glyph) continue;
    const charKern = KERN_OVERRIDES[char] ?? 1.0;
    const adjScale = (getGlyphAdj(char)).scale;
    width += glyph[0] * scale * adjScale * kern * charKern;
  }

  return width;
}

/**
 * Mutable Barok text — a Container that can update its displayed text.
 * Each call to `setText` destroys the old canvas texture and renders a new one.
 */
export class BarokLabel extends Phaser.GameObjects.Container {
  private _color: number;
  private sizePx: number;
  private _fillAlpha: number;
  private currentText = "";
  private img: Phaser.GameObjects.Image | null = null;
  private texKey: string | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    color: number,
    sizePx: number,
    fillAlpha = 1
  ) {
    super(scene, x, y);
    this._color = color;
    this.sizePx = sizePx;
    this._fillAlpha = fillAlpha;
    scene.add.existing(this);
    this.setText(text);
  }

  setText(text: string): void {
    if (text === this.currentText && this.img) return;
    this.currentText = text;

    // Clean up previous
    if (this.img) {
      this.img.destroy();
      this.img = null;
    }
    if (this.texKey && this.scene.textures.exists(this.texKey)) {
      this.scene.textures.remove(this.texKey);
    }

    const totalW = measureBarokText(text, this.sizePx);
    const totalH = this.sizePx * 1.15;
    if (totalW <= 0) return;

    const upper = text.toUpperCase();
    const dpr = 2;
    const canvasW = Math.ceil(totalW * dpr) + 4;
    const canvasH = Math.ceil(totalH * dpr) + 4;
    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const r = (this._color >> 16) & 0xff;
    const g = (this._color >> 8) & 0xff;
    const b = this._color & 0xff;
    ctx.fillStyle = `rgba(${r},${g},${b},${this._fillAlpha})`;

    const scale = this.sizePx / 100;
    const kern = 1.0;
    let cursorX = 0;

    for (const char of upper) {
      if (char === " ") { cursorX += this.sizePx * 0.35; continue; }
      const glyph = BAROK_GLYPHS[char];
      if (!glyph) continue;
      const [advanceWidth, pathData] = glyph;
      if (pathData.length > 0) {
        const adj = getGlyphAdj(char);
        const effScale = scale * adj.scale;
        const yOff = adj.yOffset * scale;
        const transformed = transformSvgPath(pathData, cursorX, yOff, effScale);
        const path = new Path2D(transformed);
        ctx.fill(path, "evenodd");
      }
      const charKern = KERN_OVERRIDES[char] ?? 1.0;
      const adjScale = (getGlyphAdj(char)).scale;
      cursorX += advanceWidth * scale * adjScale * kern * charKern;
    }

    this.texKey = `barok_l_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.scene.textures.addCanvas(this.texKey, canvas);
    this.img = this.scene.add.image(totalW / 2, totalH / 2, this.texKey);
    this.img.setDisplaySize(totalW, totalH);
    this.add(this.img);
  }
}

/**
 * Transform an SVG path string: apply scale and offset to all coordinate pairs.
 * Returns a valid SVG path string that Path2D can consume directly.
 */
function transformSvgPath(
  pathData: string,
  offsetX: number,
  offsetY: number,
  scale: number
): string {
  const tokens = pathData.trim().split(/\s+/);
  const out: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case "M":
      case "L": {
        const tx = parseFloat(tokens[i++]) * scale + offsetX;
        const ty = parseFloat(tokens[i++]) * scale + offsetY;
        out.push(`${cmd}${tx} ${ty}`);
        break;
      }
      case "Q": {
        const cx = parseFloat(tokens[i++]) * scale + offsetX;
        const cy = parseFloat(tokens[i++]) * scale + offsetY;
        const ex = parseFloat(tokens[i++]) * scale + offsetX;
        const ey = parseFloat(tokens[i++]) * scale + offsetY;
        out.push(`Q${cx} ${cy} ${ex} ${ey}`);
        break;
      }
      case "Z":
        out.push("Z");
        break;
      default:
        // Skip unknown tokens
        break;
    }
  }

  return out.join(" ");
}
