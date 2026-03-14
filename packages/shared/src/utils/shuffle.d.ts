/**
 * Fisher-Yates shuffle. Returns a NEW array (does not mutate input).
 */
export declare function shuffle<T>(array: readonly T[]): T[];
/**
 * Seeded Fisher-Yates shuffle for deterministic replays.
 * Uses a simple mulberry32 PRNG.
 */
export declare function seededShuffle<T>(array: readonly T[], seed: number): T[];
/** Draw N cards from the top of an array. Mutates the source array. */
export declare function drawCards<T>(source: T[], count: number): T[];
export declare function generateInstanceId(): string;
//# sourceMappingURL=shuffle.d.ts.map