import type { GameState, CardEffect } from "@icebox/shared";
import { applyStress } from "../../CrewManager";
import { registerEffect, type EffectResult } from "../EffectRegistry";

registerEffect("apply-stress", (state: GameState, effect: CardEffect): EffectResult => {
  const targetId = effect.params.targetInstanceId as string | undefined;
  const amount = (effect.params.amount as number) ?? 1;

  if (!targetId) {
    return { state, message: `Apply stress: no target specified.` };
  }

  const result = applyStress(state, targetId, amount);
  return {
    state: result.state,
    message: result.burnedOut
      ? `Applied ${amount} stress — crew burned out!`
      : `Applied ${amount} stress to crew.`,
  };
});
