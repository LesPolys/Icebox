/** Native resolution — computed once at load time, no dependency on config.ts */
export const GAME_W = window.innerWidth;
export const GAME_H = window.innerHeight;

/** Scale factor: converts 720p design values to native resolution */
export const SCALE = GAME_H / 720;

/** Scale a pixel value from the 720p design to native resolution */
export function s(px: number): number {
  return Math.round(px * SCALE);
}

/** Build a fontSize string scaled to native resolution */
export function fontSize(px: number): string {
  return `${Math.round(px * SCALE)}px`;
}

/** Center-X of the main playable area (between left gutter and right gutter) */
export const MAIN_CX = Math.round(GAME_W * (600 / 1280));

export const LAYOUT = {
  // Left gutter
  phaseX: s(16),
  phaseY: s(20),
  btnX: s(70),
  btnStartY: s(105),
  btnSpacing: s(34),

  // Market (6 cols × 2 rows)
  marketLabelY: s(14),
  marketRow1Y: s(70),
  marketRow2Y: s(175),
  marketColSpacing: s(120),

  // Sectors
  sectorY: s(355),
  sectorSpacing: s(300),

  // Resources
  resourceY: s(495),

  // Hand
  handY: s(630),
  handTuckOffset: s(60),

  // Right gutter
  infoPanelX: Math.round(GAME_W * (1170 / 1280)),
  infoPanelY: s(180),
  deckCountX: Math.round(GAME_W * (1264 / 1280)),
  deckCountY: s(15),

  // Message
  messageY: s(575),
} as const;
