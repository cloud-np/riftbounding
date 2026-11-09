/**
 * Sneaky Zeebles (RAD-076) — "When I conquer, [Add] [Rune]." (383.4.c.2.a, 430)
 *
 * The Add resolves through the chain like any trigger: 430.2 (triggered Add abilities finalize
 * and resolve immediately, without passing Priority) is not modelled for triggered abilities.
 */
import { notIntrinsic, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Sneaky Zeebles",
  text: "When I conquer, [Add] [Rune]. (Abilities that add resources can't be reacted to.)",
  status: "partial",
  notes: "430.2: a triggered Add ability goes on the chain instead of resolving immediately.",
  abilities: [
    ...notIntrinsic("Add"),
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      effect: { op: "add", resources: { power: { any: 1 } } },
    },
  ],
});
