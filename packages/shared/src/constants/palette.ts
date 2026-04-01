/**
 * ICEBOX COLOR PALETTE — Barok Visual Language
 * =============================================
 * Single source of truth for all UI colors across the project.
 * Use these values everywhere — never hardcode hex colors in components.
 *
 * Reference:
 *   signal-red   #CC3333   — danger, junk, alerts
 *   bone         #E8E6E0   — primary text on dark
 *   graphite     #3A3836   — borders, dividers
 *   void         #0A0A0A   — deep panel backgrounds
 *   steel        #2A2826   — button fills
 *   chartreuse   #D4FF00   — primary accent (selections, highlights, costs)
 *   slab         #161618   — card/panel inner backgrounds
 *   carbon       #111111   — canvas background
 *   concrete     #6B6860   — muted text, disabled states
 *   teal         #00CCAA   — secondary accent (type badges, data readouts)
 *   glow         #88FFDD   — effect descriptions
 *   lime         #A0DD22   — positive feedback, growth
 *   spring       #66CC55   — success states, completion
 *   emerald      #33BB88   — green-teal bridge, health
 *   ocean        #1199AA   — cool info text, secondary data
 *   slate        #336688   — muted labels, tertiary text
 *   indigo       #6B55A0   — body text on dark panels
 *   grape        #3D2255   — deep accents, borders on dark
 *   abyss        #1A0E2E   — extreme dark backgrounds
 *   warm-gray    #C8C0B8   — surface backgrounds, card shells
 *   paper        #D8D4CC   — game board surface
 */

export const PALETTE = {
  signalRed:  { hex: "#CC3333", num: 0xCC3333 },
  bone:       { hex: "#E8E6E0", num: 0xE8E6E0 },
  graphite:   { hex: "#3A3836", num: 0x3A3836 },
  void:       { hex: "#0A0A0A", num: 0x0A0A0A },
  steel:      { hex: "#2A2826", num: 0x2A2826 },
  chartreuse: { hex: "#D4FF00", num: 0xD4FF00 },
  slab:       { hex: "#161618", num: 0x161618 },
  carbon:     { hex: "#111111", num: 0x111111 },
  concrete:   { hex: "#6B6860", num: 0x6B6860 },
  teal:       { hex: "#00CCAA", num: 0x00CCAA },
  glow:       { hex: "#88FFDD", num: 0x88FFDD },
  lime:       { hex: "#A0DD22", num: 0xA0DD22 },
  spring:     { hex: "#66CC55", num: 0x66CC55 },
  emerald:    { hex: "#33BB88", num: 0x33BB88 },
  ocean:      { hex: "#1199AA", num: 0x1199AA },
  slate:      { hex: "#336688", num: 0x336688 },
  indigo:     { hex: "#6B55A0", num: 0x6B55A0 },
  grape:      { hex: "#3D2255", num: 0x3D2255 },
  abyss:      { hex: "#1A0E2E", num: 0x1A0E2E },
  warmGray:   { hex: "#C8C0B8", num: 0xC8C0B8 },
  paper:      { hex: "#D8D4CC", num: 0xD8D4CC },
} as const;

/** Convenience: just the hex strings */
export const HEX = {
  signalRed:  "#CC3333",
  bone:       "#E8E6E0",
  graphite:   "#3A3836",
  void:       "#0A0A0A",
  steel:      "#2A2826",
  chartreuse: "#D4FF00",
  slab:       "#161618",
  carbon:     "#111111",
  concrete:   "#6B6860",
  teal:       "#00CCAA",
  glow:       "#88FFDD",
  lime:       "#A0DD22",
  spring:     "#66CC55",
  emerald:    "#33BB88",
  ocean:      "#1199AA",
  slate:      "#336688",
  indigo:     "#6B55A0",
  grape:      "#3D2255",
  abyss:      "#1A0E2E",
  warmGray:   "#C8C0B8",
  paper:      "#D8D4CC",
} as const;

/** Convenience: just the 0x numeric values (for Phaser fillStyle etc.) */
export const NUM = {
  signalRed:  0xCC3333,
  bone:       0xE8E6E0,
  graphite:   0x3A3836,
  void:       0x0A0A0A,
  steel:      0x2A2826,
  chartreuse: 0xD4FF00,
  slab:       0x161618,
  carbon:     0x111111,
  concrete:   0x6B6860,
  teal:       0x00CCAA,
  glow:       0x88FFDD,
  lime:       0xA0DD22,
  spring:     0x66CC55,
  emerald:    0x33BB88,
  ocean:      0x1199AA,
  slate:      0x336688,
  indigo:     0x6B55A0,
  grape:      0x3D2255,
  abyss:      0x1A0E2E,
  warmGray:   0xC8C0B8,
  paper:      0xD8D4CC,
} as const;
