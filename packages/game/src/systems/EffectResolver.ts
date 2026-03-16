/**
 * Legacy EffectResolver — now delegates to the registry-based effect system.
 *
 * All new code should import from "./effects/index" directly.
 * This file exists for backward compatibility with existing consumers.
 */

// Initialize all handlers and conditions by importing the effect system
import "./effects/index";

// Re-export everything consumers expect
export { resolveEffect, emitTiming } from "./effects/index";
export type { EffectResult } from "./effects/index";
