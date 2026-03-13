/**
 * Fisher-Yates shuffle. Returns a NEW array (does not mutate input).
 */
export function shuffle<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Seeded Fisher-Yates shuffle for deterministic replays.
 * Uses a simple mulberry32 PRNG.
 */
export function seededShuffle<T>(array: readonly T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Mulberry32 PRNG — fast, decent distribution, 32-bit seed */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw N cards from the top of an array. Mutates the source array. */
export function drawCards<T>(source: T[], count: number): T[] {
  return source.splice(0, Math.min(count, source.length));
}

/** Generate a unique instance ID */
let instanceCounter = 0;
export function generateInstanceId(): string {
  return `inst_${Date.now()}_${instanceCounter++}`;
}
