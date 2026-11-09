/**
 * Udyr, Wildman (OGN-157) — "[Ganking] Spend my buff: Choose one you've not chosen this turn — Deal
 * 2 to a unit at a battlefield. / Stun a unit at a battlefield. / Ready me. / Give me [GANKING] this
 * turn."
 *
 * [Ganking] (810) is printed. The modes are written like Riven, Broken Blade's (per-turn `mark`,
 * `requires` guards, 355.3). Partial: "Spend my buff" is not a payable activation cost (702.2.b);
 * it is kept as an unsupported phrase, so the ability is unpayable (203.3) rather than free.
 */
import type { Effect } from "@rift/protocol";
import { aUnit, marked, not, registerCardScript, SELF } from "../sdk";

const KEY = "ogn-oz:udyr-wildman:{self}";

function mode(id: string, label: string, effect: Effect) {
  return {
    id,
    label,
    effect: {
      op: "requires" as const,
      condition: not(marked(KEY, id)),
      effect: {
        op: "seq" as const,
        effects: [{ op: "mark" as const, key: KEY, value: id }, effect],
      },
    },
  };
}

registerCardScript({
  name: "Udyr, Wildman",
  text: "[GANKING]\nSpend my buff: Choose one you've not chosen this turn --\nDeal 2 to a unit at a battlefield.\nStun a unit at a battlefield\nReady me.\nGive me [GANKING] this turn.",
  status: "partial",
  notes:
    "The activated ability's cost 'Spend my buff' (702.2.b) is not payable, so it cannot be activated.",
  abilities: [
    {
      kind: "activated",
      cost: { additional: { "unsupported:Spend my buff": true } },
      effect: {
        op: "choose_mode",
        modes: [
          mode("deal", "Deal 2 to a unit at a battlefield", {
            op: "deal",
            amount: 2,
            target: aUnit({ zone: "battlefield" }),
          }),
          mode("stun", "Stun a unit at a battlefield", {
            op: "stun",
            target: aUnit({ zone: "battlefield" }),
          }),
          mode("ready", "Ready me", { op: "ready", target: SELF }),
          mode("ganking", "Give me Ganking this turn", {
            op: "grant_keyword",
            keyword: "Ganking",
            target: SELF,
            duration: "this-turn",
          }),
        ],
      },
    },
  ],
});
