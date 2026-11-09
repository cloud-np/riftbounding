/**
 * Firelights' Hideout (RAD-162) — "When you conquer here, the next unit you play this turn has
 * [Accelerate]." A keyword grant to a card in hand before it is played (801.3, 806).
 */
import { notIntrinsic, registerCardScript } from "../sdk";

registerCardScript({
  name: "Firelights' Hideout",
  text: "When you conquer here, the next unit you play this turn has [Accelerate]. (You may pay [1] and a Power of its Domain as an additional cost to have it enter ready.)",
  status: "partial",
  notes:
    "The next unit's [Accelerate] must be visible to the play layer while the card is still in hand; passive keyword grants to cards in hand are not read (801.3, 806), so selecting the Accelerate cost is not offered.",
  abilities: [...notIntrinsic("Accelerate")],
});
