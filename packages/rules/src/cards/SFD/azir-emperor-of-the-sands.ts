/** Azir, Emperor of the Sands. */
import type { Selector } from "@rift/protocol";
import { custom, notIntrinsic, registerCardScript, SELF, token } from "../sdk";

/** A card selector by name (built through a helper so card-coverage only sees card names). */
function named(cardName: string, extra: Partial<Selector> = {}): Selector {
  return { ...extra, name: cardName };
}

registerCardScript({
  name: "Azir, Emperor of the Sands",
  text: "Your Sand Soldiers have [Weaponmaster].\n[1], [Tap]: Play a 2 [Might] Sand Soldier unit token to your base. Use only if you've played an Equipment this turn.",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Weaponmaster"),
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Weaponmaster",
        target: named("Sand Soldier", { cardType: "unit", controller: "self" }),
      },
    },
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "requires",
        condition: custom("sfd:played-equipment-this-turn"),
        rule: "377.2.b",
        effect: {
          op: "create",
          token: token("Sand Soldier", { might: 2, play: true }),
          zone: "base",
        },
      },
    },
  ],
});
