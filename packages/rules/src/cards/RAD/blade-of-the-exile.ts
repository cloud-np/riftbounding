/**
 * Blade of the Exile (RAD-150) — "[Equip] — [Rune] or exhaust a friendly unit (Pay the cost:
 * Attach this to a unit you control.) [Ganking] +3 [Might]"
 *
 * Effect text (applies to the top-most card while attached, 718.3/718.4): Ganking and +3 Might.
 * Equip (818) is the play layer's built-in `equip:<n>` ability; its printed alternatives
 * ("[Rune] or exhaust a friendly unit") are parsed into the two Base Costs (204.1.b) and paid by
 * the ordinary cost layer. The scripted `activated:0` keeps the R2 compatibility ref used by
 * `test/cards/fixture-deck.test.ts` (it performs the same attach for the [Rune] alternative).
 */
import { aUnit, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Blade of the Exile",
  text: "[Equip] — [Rune] or exhaust a friendly unit (Pay the cost: Attach this to a unit you control.)\n[Ganking] (I can move from battlefield to battlefield.)\n+3 [Might]",
  status: "implemented",
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
