/** Lonely Poro. */
import { custom, registerCardScript, WHEN_I_DIE } from "../sdk";

registerCardScript({
  name: "Lonely Poro",
  text: "[Deathknell] — If I died alone, draw 1. (When I die, get the effect. I'm alone if there are no other friendly units here.)",
  status: "partial",
  notes:
    '"Alone" is checked against friendly units still at my location after the death; friendly units that died simultaneously (e.g. the same combat damage step, 467.2.d) are not looked back at (no last-known information of other objects, 359.3.e.13).',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      condition: custom("sfd:died-alone"),
      effect: { op: "draw", amount: 1 },
    },
  ],
});
