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
  warmGray:   0xC8C0B8,
  paper:      0xD8D4CC,
} as const;
