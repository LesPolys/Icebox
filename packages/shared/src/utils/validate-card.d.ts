export interface ValidationError {
    field: string;
    message: string;
}
/** Validate a card object against expected structure */
export declare function validateCard(card: unknown): ValidationError[];
//# sourceMappingURL=validate-card.d.ts.map