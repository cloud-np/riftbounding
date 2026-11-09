/** Pillaged Armory. */
import type { Effect } from "@rift/protocol";
import {
  aUnit,
  notIntrinsic,
  registerCardScript,
  WHEN_PLAYED,
  WHEN_YOU_CONQUER_HERE,
} from "../sdk";

/** Pillaged Armory (RAD-073) — "[Deploy] When you play this or when you conquer here, [Buff] a friendly unit." */
const BUFF_FRIENDLY: Effect = { op: "buff", target: aUnit({ controller: "self" }) };

registerCardScript({
  name: "Pillaged Armory",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you play this or when you conquer here, [Buff] a friendly unit. (Give it a +1[Might] buff if it doesn't have one.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Buff"),
    { kind: "triggered", trigger: WHEN_PLAYED, effect: BUFF_FRIENDLY },
    { kind: "triggered", trigger: WHEN_YOU_CONQUER_HERE, effect: BUFF_FRIENDLY },
  ],
});
