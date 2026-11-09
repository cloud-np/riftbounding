/**
 * Tryndamere, Barbarian (OGN-034) — "When I conquer after an attack, if you assigned 5 or more
 * excess damage to enemy units, you score 1 Point."
 *
 * Manual: the condition needs the excess (beyond lethal) combat damage assigned this combat
 * (467.2.c) and whether the conquer followed an attack; neither is recorded once the combat ends.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Tryndamere, Barbarian",
  text: "When I conquer after an attack, if you assigned 5 or more excess damage to enemy units, you score 1 Point.",
  status: "manual",
  notes:
    "Excess combat damage assigned (467.2.c) and 'conquer after an attack' are not recorded for trigger conditions.",
  abilities: [],
});
