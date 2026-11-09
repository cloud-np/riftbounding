/** Heisho, Shell of the World. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Heisho, Shell of the World",
  text: "Players ignore [Deflect] while paying for spells and abilities choosing something here.",
  status: "partial",
  notes:
    "`ignore-keyword` (764–767) is registered but has no consumer in R2-play's Deflect payment yet, so the [Deflect] surcharge is still charged.",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "ignore-keyword", keyword: "Deflect", action: "pay-costs", here: true },
    },
  ],
});
