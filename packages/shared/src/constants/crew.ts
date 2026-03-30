import type { ResourceCost } from "../types/resource.js";

/** Cost to freeze a crew member in a Cryo-Pod during cryosleep */
export const CRYO_POD_COST: ResourceCost = { energy: 3 };

/** Cost to have a crew member train a successor (Mentorship) during cryosleep */
export const MENTORSHIP_COST: ResourceCost = { influence: 3 };

/** Cost to upload a crew member's mind to a Digital Archive during cryosleep */
export const DIGITAL_ARCHIVE_COST: ResourceCost = { data: 3 };

/** Default cost to reassign a crew member to a different structure */
export const DEFAULT_REASSIGN_COST: ResourceCost = { influence: 1 };
