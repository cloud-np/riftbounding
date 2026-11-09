/** Crescent Guardian. */
import { custom, PAID_ADDITIONAL, registerCardScript, whilePassive as whenever } from "../sdk";
import { ENTER_READY } from "./custom";

registerCardScript({
  name: "Crescent Guardian",
  text: "If you've played a spell this turn, you may pay [Chaos] as an additional cost to play me. If you do, I enter ready.",
  status: "implemented",
  // 356.2.b.1: the optional [Chaos] cost exists only "if you've played a spell this turn".
  additionalCosts: [
    {
      id: "optional:0",
      optional: true,
      cost: { power: { Chaos: 1 } },
      rule: "356.2.b.1",
      label: "pay [Chaos]",
      condition: custom("unl:played-spell-this-turn"),
    },
  ],
  abilities: [whenever(PAID_ADDITIONAL, ENTER_READY)],
});
