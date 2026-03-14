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

/** Center-X of the main playable area (accounts for left gutter) */
export const MAIN_CX = Math.round(GAME_W / 2);

export const LAYOUT = {
  // Left gutter
  phaseX: s(16),
  phaseY: s(20),

  // Market (6 cols × 2 rows)
  marketLabelY: s(14),
  marketRow1Y: s(108),
  marketRow2Y: s(213),
  marketColSpacing: s(120),

  // Resources (between market and play mat)
  resourceY: s(315),

  // Sectors
  sectorY: s(460),
  sectorSpacing: s(300),

  // Hand
  handY: s(665),
  handTuckOffset: s(60),

  // Right gutter
  infoPanelX: Math.round(GAME_W * (1170 / 1280)),
  infoPanelY: s(180),
  deckCountX: Math.round(GAME_W * (1264 / 1280)),
  deckCountY: s(15),

  // Message
  messageY: s(625),

  // Play mat (encloses sectors + hand)
  playMatTop: s(370),
  playMatBottom: s(720),
  playMatW: s(1000),
  playMatBtnRadius: s(36),

  // Play zone (drop target for playing cards from hand)
  playZoneY: s(600),
  playZoneH: s(50),
} as const;
