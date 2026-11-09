/** Esteemed Hierophant. */
import { custom, registerCardScript, runesControlled, SELF } from "../sdk";

registerCardScript({
  name: "Esteemed Hierophant",
  text: "While you control 7 or more runes, prevent all damage that enemy spells and abilities would deal to me.",
  status: "implemented",
  abilities: [
    {
      // 438.1.a / 438.3.c: a prevention replacement ("all") while the condition holds.
      kind: "replacement",
      matches: {
        type: "damage",
        subject: SELF,
        condition: {
          kind: "and",
          conditions: [runesControlled("gte", 7), custom("ven:damage-from-enemy-spell-or-ability")],
        },
      },
      replace: { prevent: 9999 },
    },
  ],
});
