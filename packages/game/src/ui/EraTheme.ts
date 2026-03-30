import Phaser from "phaser";
import type { EraState } from "@icebox/shared";
import { s } from "./layout";

/**
 * Environmental theming per Era.
 * Controls the visual atmosphere of the play area:
 *   Zenith:     bright, clean tones, subtle shimmer particles
 *   Unraveling: desaturated, flickering ambient lights
 *   Struggle:   dark warm tones (emergency lighting), grit particles
 *   Ascension:  bold high-contrast, industrial spark particles
 */

interface EraThemeConfig {
  /** Background tint color (applied to camera or main bg) */
  bgTint: number;
  /** Ambient particle color */
  particleColor: number;
  /** Particle alpha range */
  particleAlpha: { min: number; max: number };
  /** Particle speed range */
  particleSpeed: { min: number; max: number };
  /** Particle count (alive at once) */
  particleCount: number;
  /** Camera fade color for transitions */
  fadeColor: number;
  /** Ambient flicker (Unraveling only) */
  flicker: boolean;
}

const ERA_THEMES: Record<EraState, EraThemeConfig> = {
  Zenith: {
    bgTint: 0x1a2a1a,
    particleColor: 0x55cc88,
    particleAlpha: { min: 0.05, max: 0.2 },
    particleSpeed: { min: 5, max: 15 },
    particleCount: 12,
    fadeColor: 0x55cc88,
    flicker: false,
  },
  Unraveling: {
    bgTint: 0x2a2218,
    particleColor: 0xaa8855,
    particleAlpha: { min: 0.03, max: 0.12 },
    particleSpeed: { min: 3, max: 10 },
    particleCount: 6,
    fadeColor: 0xaa8855,
    flicker: true,
  },
  Struggle: {
    bgTint: 0x2a1510,
    particleColor: 0xcc6644,
    particleAlpha: { min: 0.04, max: 0.15 },
    particleSpeed: { min: 8, max: 25 },
    particleCount: 8,
    fadeColor: 0xcc4444,
    flicker: false,
  },
  Ascension: {
    bgTint: 0x151a2a,
    particleColor: 0x6688cc,
    particleAlpha: { min: 0.06, max: 0.25 },
    particleSpeed: { min: 10, max: 30 },
    particleCount: 15,
    fadeColor: 0x6688cc,
    flicker: false,
  },
};

/**
 * Manages environmental visual theming for the current Era.
 * Call `applyTheme` when entering a scene or after an Era transition.
 * Call `destroy` when leaving the scene.
 */
export class EraTheme {
  private scene: Phaser.Scene;
  private particles: Phaser.GameObjects.Graphics[] = [];
  private flickerTween: Phaser.Tweens.Tween | null = null;
  private ambientOverlay: Phaser.GameObjects.Rectangle | null = null;
  private currentEra: EraState | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Apply the visual theme for a given era. */
  applyTheme(era: EraState, animate = true): void {
    this.cleanup();
    this.currentEra = era;

    const theme = ERA_THEMES[era];
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    // Ambient color overlay (very subtle)
    this.ambientOverlay = this.scene.add.rectangle(w / 2, h / 2, w, h, theme.bgTint, 0.15);
    this.ambientOverlay.setDepth(-100);

    // Floating ambient particles (simple graphics dots)
    for (let i = 0; i < theme.particleCount; i++) {
      const dot = this.scene.add.graphics();
      const size = s(1) + Math.random() * s(2);
      dot.fillStyle(theme.particleColor, theme.particleAlpha.min + Math.random() * (theme.particleAlpha.max - theme.particleAlpha.min));
      dot.fillCircle(0, 0, size);
      dot.setPosition(Math.random() * w, Math.random() * h);
      dot.setDepth(-99);

      // Slow drift upward
      const speed = theme.particleSpeed.min + Math.random() * (theme.particleSpeed.max - theme.particleSpeed.min);
      this.scene.tweens.add({
        targets: dot,
        y: { from: dot.y, to: -s(10) },
        x: dot.x + (Math.random() - 0.5) * s(40),
        alpha: { from: 1, to: 0 },
        duration: (h / speed) * 1000,
        delay: Math.random() * 3000,
        repeat: -1,
        onRepeat: () => {
          dot.setPosition(Math.random() * w, h + s(10));
        },
      });

      this.particles.push(dot);
    }

    // Ambient flicker (Unraveling era)
    if (theme.flicker && this.ambientOverlay) {
      this.flickerTween = this.scene.tweens.add({
        targets: this.ambientOverlay,
        alpha: { from: 0.15, to: 0.08 },
        duration: 800 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  /** Play a transition effect between eras. */
  transition(from: EraState, to: EraState): void {
    const theme = ERA_THEMES[to];

    // Brief flash overlay
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const flash = this.scene.add.rectangle(w / 2, h / 2, w, h, theme.fadeColor, 0);
    flash.setDepth(1000);

    this.scene.tweens.add({
      targets: flash,
      alpha: { from: 0, to: 0.3 },
      duration: 300,
      yoyo: true,
      onComplete: () => {
        flash.destroy();
        this.applyTheme(to, false);
      },
    });
  }

  private cleanup(): void {
    for (const p of this.particles) {
      this.scene.tweens.killTweensOf(p);
      p.destroy();
    }
    this.particles = [];

    if (this.flickerTween) {
      this.flickerTween.destroy();
      this.flickerTween = null;
    }

    if (this.ambientOverlay) {
      this.scene.tweens.killTweensOf(this.ambientOverlay);
      this.ambientOverlay.destroy();
      this.ambientOverlay = null;
    }
  }

  destroy(): void {
    this.cleanup();
  }
}

export { ERA_THEMES };
