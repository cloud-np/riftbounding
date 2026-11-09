/** Unsung Hero. */
import { custom, registerCardScript, WHEN_I_DIE } from "../sdk";

registerCardScript({
  name: "Unsung Hero",
  text: "[Deathknell] — If I was [Mighty], draw 2. (When I die, get the effect. I'm Mighty while I have 5+ [Might].)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      // 383.2.a.1 / 808.1.d.3: "if I was Mighty" reads the last-known Might on the kill event.
      condition: custom("sfd:event-might-at-least", { n: 5 }),
      effect: { op: "draw", amount: 2 },
    },
  ],
});
