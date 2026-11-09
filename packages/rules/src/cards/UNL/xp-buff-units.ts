/**
 * Crowd Favorite (UNL-102) and Enthralling Protector (UNL-162) — [Hunt] (823, engine keyword) and
 * "Spend 2 XP: [Buff] me." (activated ability, 377; XP cost 730.2/357.2; Buff 427/702.3). The
 * catalog's [Buff] is reminder text, not a keyword ability.
 */
import type { Ability } from "@rift/protocol";
import { registerCardScript, SELF } from "../sdk";

const SPEND_2_BUFF_ME: Ability = {
  kind: "activated",
  cost: { spendXp: 2 },
  effect: { op: "buff", target: SELF },
};

registerCardScript({
  name: "Crowd Favorite",
  text: "[Hunt] (When I conquer or hold, gain 1 XP.)\nSpend 2 XP: [Buff] me. (Give me a +1 Buff if I dont have one.)",
  status: "implemented",
  abilities: [SPEND_2_BUFF_ME],
});

registerCardScript({
  name: "Enthralling Protector",
  text: "[Hunt] (When i conquer or hold, gain 1 XP.)\nSpend 2 XP: [Buff] me. (Give me a +1 buff if i dont have one.)",
  status: "implemented",
  abilities: [SPEND_2_BUFF_ME],
});
