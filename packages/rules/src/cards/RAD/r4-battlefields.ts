/**
 * Radiance (RAD) battlefields and gear scripted in wave R4.
 *
 * Black Market (RAD-158), Bushwhack Trap (RAD-108), Firelights' Hideout (RAD-162), Hunters'
 * Circle (RAD-163), Packed Amphitheater (RAD-164/184).
 */
import { registerCardScript } from "../registry";
import { notIntrinsic } from "./dsl";

/**
 * Black Market (RAD-158) — "[Rune] [Rune]: Draw 1. Each player may use this ability once on
 * their turn (even if they don't control this battlefield)."
 */
registerCardScript({
  name: "Black Market",
  text: "[Rune] [Rune]: Draw 1. Each player may use this ability once on their turn (even if they don't control this battlefield).",
  status: "partial",
  notes:
    "The ability is scripted (2 Power, draw 1), but a battlefield has no controller and activation legality only accepts the card's controller (378/381: 'abilities other players may activate' is not implemented), so no player can activate it.",
  abilities: [
    {
      kind: "activated",
      cost: { power: { any: 2 } },
      effect: { op: "draw", amount: 1 },
    },
  ],
});

/**
 * Bushwhack Trap (RAD-108) — "[Deploy] While you or an ally control this battlefield, that
 * player may hide an additional card here." [Deploy] is the engine's; the extra hide slot is a
 * `hide-limit` modifier, which the hide legality never reads (811.1.b / 107.3.b).
 */
registerCardScript({
  name: "Bushwhack Trap",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhile you or an ally control this battlefield, that player may hide an additional card here.",
  status: "partial",
  notes:
    "The extra facedown card ('hide an additional card here') needs the hide limit to read a `hide-limit` modifier; `planHide` only checks `facedownCardAt`, so the second card is still rejected (811.1.b, 107.3.b).",
  abilities: [
    { kind: "passive", modifier: { kind: "custom", id: "hide-limit", params: { amount: 1 } } },
  ],
});

/**
 * Firelights' Hideout (RAD-162) — "When you conquer here, the next unit you play this turn has
 * [Accelerate]." A keyword grant to a card in hand before it is played (801.3, 806).
 */
registerCardScript({
  name: "Firelights' Hideout",
  text: "When you conquer here, the next unit you play this turn has [Accelerate]. (You may pay [1] and a Power of its Domain as an additional cost to have it enter ready.)",
  status: "partial",
  notes:
    "The next unit's [Accelerate] must be visible to the play layer while the card is still in hand; passive keyword grants to cards in hand are not read (801.3, 806), so selecting the Accelerate cost is not offered.",
  abilities: [
    ...notIntrinsic("Accelerate"),
  ],
});

/** Hunters' Circle (RAD-163) — first unit/gear each player plays here on their turn costs [1] less. */
registerCardScript({
  name: "Hunters' Circle",
  text: "For each player, the first unit or gear they play here on their turn costs [1] less.",
  status: "manual",
  notes:
    "Needs a per-player per-turn record of where units/gear were played and a cost adjustment read before the play location is chosen (356.4, 420.5); neither exists.",
  abilities: [],
});

/** Packed Amphitheater (RAD-164/184) — "Champion units here have +1 [Might]." */
registerCardScript({
  name: "Packed Amphitheater",
  text: "Champion units here have +1 [Might].",
  status: "manual",
  notes:
    "The catalog does not mark Champion units on the board (133.8.b), so 'Champion units here' cannot be distinguished from other units; no passive is scripted.",
  abilities: [],
});
