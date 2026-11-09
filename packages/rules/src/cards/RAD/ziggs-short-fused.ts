/** Ziggs, Short-Fused (RAD-023) — "When you play me, play a Bomb gear token to a battlefield. Abilities of friendly gear deal 1 Bonus Damage." */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { playBombs } from "./custom";

const BOMB_NOTE =
  "The Bomb token's own [Deathknell] (deal 2, kill your other Bombs there) needs a token script (src/cards/tokens, 187).";

registerCardScript({
  name: "Ziggs, Short-Fused",
  text: "When you play me, play a Bomb gear token to a battlefield. (It has [Deploy]. When it dies, deal 2 to an enemy there and kill your other Bombs there.)\nAbilities of friendly gear deal 1 Bonus Damage.",
  status: "partial",
  notes: `${BOMB_NOTE} "Abilities of friendly gear deal 1 Bonus Damage" needs a source-type filter on Bonus Damage (712–715; \`bonus-damage\` only filters spells/abilities).`,
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: playBombs(1) }],
});
