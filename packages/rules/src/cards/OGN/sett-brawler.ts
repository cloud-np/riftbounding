/**
 * Sett, Brawler (OGN-164) — "When I'm played and when I conquer, buff me. Spend my buff: Give me +4
 * [Might] this turn."
 *
 * Both triggers are automated (383.4.a play effect, 383.4.c.2.a "when I conquer"). Partial: "Spend
 * my buff" is not a payable activation cost (702.2.b); the ability is written with the cost kept as
 * an unsupported phrase, so it is unpayable (203.3) rather than free.
 */
import { registerCardScript, SELF, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Sett, Brawler",
  text: "When I'm played and when I conquer, buff me. (If I don't have a buff, I get a +1 [Might] buff.)\nSpend my buff: Give me +4 [Might] this turn.",
  status: "partial",
  notes:
    "The activated ability's cost 'Spend my buff' (702.2.b) is not payable, so it cannot be activated.",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "buff", target: SELF } },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      effect: { op: "buff", target: SELF },
    },
    {
      kind: "activated",
      cost: { additional: { "unsupported:Spend my buff": true } },
      effect: { op: "temporary_might", amount: 4, target: SELF },
    },
  ],
});
