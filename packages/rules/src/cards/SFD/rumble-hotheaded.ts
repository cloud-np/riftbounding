/** Rumble, Hotheaded. */
import type { Effect } from "@rift/protocol";
import { notIntrinsic, registerCardScript, SELF } from "../sdk";

const MANUAL: Effect = { op: "custom", id: "manual" };

registerCardScript({
  name: "Rumble, Hotheaded",
  text: "Your Mechs each have [Assault] (+1 [Might] while we're attackers.)\nWhen I conquer, you may recycle another friendly unit to play a Mech from your trash. Reduce its Energy cost by the Might of the unit you recycled.",
  status: "partial",
  notes:
    '"When I conquer, you may recycle another friendly unit to play a Mech from your trash, reducing its Energy cost by that unit\'s Might": the trigger is detected but resolves in the §6.4 manual window (effect plays cannot apply a computed cost reduction, 420.3/356.4).',
  abilities: [
    ...notIntrinsic("Assault"),
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Assault",
        target: { cardType: "unit", controller: "self", tag: "Mech" },
      },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      optional: true,
      effect: MANUAL,
    },
  ],
});
