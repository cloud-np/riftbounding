/** Daisy!. */
import type { Condition } from "@rift/protocol";
import {
  aUnit,
  custom,
  ENTER_READY_MODIFIER,
  HERE,
  registerCardScript,
  SELF,
  whilePassive as whenever,
} from "../sdk";
import { PETS } from "./custom";

const ENEMY_HERE = aUnit({ controller: "opponent", zone: HERE });

const DAISY_TAG = (tag: string): Condition => ({
  kind: "exists",
  selector: { cardType: "unit", controller: "self", tag },
});

registerCardScript({
  name: "Daisy!",
  text: "I enter ready.\nReduce my cost by for each of the following tags among your units — Bird, Cat, Dog, and Poro.\nWhen I attack while your units have all 4 tags, [Stun] an enemy unit here. (It doesn't deal combat damage this turn.)",
  status: "partial",
  notes:
    "The printed cost reduction has no amount or symbol ('Reduce my cost by for each …'); it is read as [1] Energy per tag (366.2.a). Otherwise automated.",
  abilities: [
    { kind: "passive", modifier: ENTER_READY_MODIFIER },
    ...PETS.map((tag) => whenever(DAISY_TAG(tag), { kind: "cost", amount: -1, target: SELF })),
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "attack",
          subject: SELF,
          condition: custom("unl:units-have-all-tags", { tags: PETS }),
        },
      },
      effect: { op: "stun", target: ENEMY_HERE },
    },
  ],
});
