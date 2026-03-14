/** Helper: get all market slots across both rows as a flat array */
export function getAllMarketSlots(market) {
    return [...market.physicalRow.slots, ...market.socialRow.slots];
}
/** Helper: get all non-null cards currently in the market */
export function getAllMarketCards(market) {
    return getAllMarketSlots(market).filter((s) => s !== null);
}
/** Helper: get a specific row by ID */
export function getMarketRowById(market, rowId) {
    return rowId === "physical" ? market.physicalRow : market.socialRow;
}
/** Helper: create an empty market row */
export function createEmptyRow(slotsPerRow) {
    return {
        slots: new Array(slotsPerRow).fill(null),
        investments: new Array(slotsPerRow).fill(null),
    };
}
//# sourceMappingURL=deck.js.map