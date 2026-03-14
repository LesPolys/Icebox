/**
 * ICEBOX COLOR PALETTE
 * ====================
 * Single source of truth for all UI colors across the project.
 * Use these values everywhere — never hardcode hex colors in components.
 *
 * Reference:
 *   dusty-mauve      #B23B4E   — accent/danger, active elements
 *   eggshell         #E3E4D4   — primary text, high contrast
 *   charcoal-blue    #2B556B   — borders, secondary surfaces
 *   coffee-bean      #1B111B   — deep background
 *   charcoal-blue-2  #2B475B   — button fills, mid-tone surfaces
 *   dark-cyan        #539593   — interactive highlights, hover states
 *   midnight-violet  #261F31   — card/panel backgrounds
 *   carbon-black     #212121   — game canvas background
 *   vintage-grape    #4E4553   — muted text, disabled states
 *   pearl-aqua       #A5CFC5   — selection highlights, resource labels
 */
export const PALETTE = {
    dustyMauve: { hex: "#B23B4E", num: 0xB23B4E },
    eggshell: { hex: "#E3E4D4", num: 0xE3E4D4 },
    charcoalBlue: { hex: "#2B556B", num: 0x2B556B },
    coffeBean: { hex: "#1B111B", num: 0x1B111B },
    charcoalBlue2: { hex: "#2B475B", num: 0x2B475B },
    darkCyan: { hex: "#539593", num: 0x539593 },
    midnightViolet: { hex: "#261F31", num: 0x261F31 },
    carbonBlack: { hex: "#212121", num: 0x212121 },
    vintageGrape: { hex: "#4E4553", num: 0x4E4553 },
    pearlAqua: { hex: "#A5CFC5", num: 0xA5CFC5 },
};
/** Convenience: just the hex strings */
export const HEX = {
    dustyMauve: "#B23B4E",
    eggshell: "#E3E4D4",
    charcoalBlue: "#2B556B",
    coffeeBean: "#1B111B",
    charcoalBlue2: "#2B475B",
    darkCyan: "#539593",
    midnightViolet: "#261F31",
    carbonBlack: "#212121",
    vintageGrape: "#4E4553",
    pearlAqua: "#A5CFC5",
};
/** Convenience: just the 0x numeric values (for Phaser fillStyle etc.) */
export const NUM = {
    dustyMauve: 0xB23B4E,
    eggshell: 0xE3E4D4,
    charcoalBlue: 0x2B556B,
    coffeeBean: 0x1B111B,
    charcoalBlue2: 0x2B475B,
    darkCyan: 0x539593,
    midnightViolet: 0x261F31,
    carbonBlack: 0x212121,
    vintageGrape: 0x4E4553,
    pearlAqua: 0xA5CFC5,
};
//# sourceMappingURL=palette.js.map