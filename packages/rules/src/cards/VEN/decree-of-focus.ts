/** Decree of Focus. */
import { aUnit, custom, registerCardScript } from "../sdk";

const DECREE_OF_FOCUS_UNIT = aUnit({
  controller: "self",
  targetRef: "target:0",
  where: custom("ven:decree-focus-eligible"),
});

registerCardScript({
  name: "Decree of Focus",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a friendly unit that's in combat with an enemy Fury ([Fury]) unit or that's being chosen by an enemy Fury spell. Give it +4 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: { op: "temporary_might", amount: 4, target: DECREE_OF_FOCUS_UNIT },
    },
  ],
});
