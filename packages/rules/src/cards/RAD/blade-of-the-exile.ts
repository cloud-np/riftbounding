/**
 * Blade of the Exile (RAD-150) — "[Equip] — [Rune] or exhaust a friendly unit (Pay the cost:
 * Attach this to a unit you control.) [Ganking] +3 [Might]"
 *
 * Effect text (applies to the top-most card while attached, 718.3/718.4): Ganking and +3 Might.
 * Equip (818) is R2-play's activated keyword: its alternative cost ("[Rune] or exhaust a friendly
 * unit") and timing are not expressible here; the scripted ability attaches with the [Rune] cost.
 */
import { registerCardScript } from "../registry";
import { SELF, aUnit } from "../dsl";

registerCardScript({
  name: "Blade of the Exile",
  text: "[Equip] — [Rune] or exhaust a friendly unit (Pay the cost: Attach this to a unit you control.)\n[Ganking] (I can move from battlefield to battlefield.)\n+3 [Might]",
  status: "partial",
  notes: "Equip's alternative cost (exhaust a friendly unit) and Equip timing are R2-play's (818).",
  abilities: [
    {
      kind: "activated",
      cost: { power: { any: 1 } },
      keywords: ["Equip"],
      effect: { op: "attach", gear: SELF, to: aUnit({ controller: "self" }) },
    },
    {
      kind: "passive",
      modifier: { kind: "keyword", keyword: "Ganking", target: { targetRef: "host" } },
    },
    { kind: "passive", modifier: { kind: "might", amount: 3, target: { targetRef: "host" } } },
  ],
});
