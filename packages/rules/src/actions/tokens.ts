/** Token creation — rules 412+ (game action "create"). */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { interceptAction } from "../timing/hooks";

/**
 * Create a token at a zone. The engine owns token ids/images/stats (`RulesHost.createToken`);
 * this primitive only emits the game event so triggers can see the creation.
 */
export function createTokenPrimitive(
  room: Room,
  playerId: string,
  name: string,
  zone: string,
  step: RulesStepContext,
): string | null {
  // 367–375: replacements may prevent or rewrite token creation (e.g. "instead create …").
  const proposal = interceptAction(room, step, {
    type: "create_token",
    playerId,
    zone,
    data: { name },
  });
  if (!proposal) return null;
  const tokenName = typeof proposal.data?.name === "string" ? proposal.data.name : name;
  const tokenZone = proposal.zone ?? zone;
  const cardId = step.host.createToken(room, playerId, tokenName, tokenZone);
  if (!cardId) return null;
  pushEvent(step.events, {
    type: "create_token",
    playerId,
    cardId,
    zone: tokenZone,
    cardName: tokenName,
  });
  return cardId;
}
