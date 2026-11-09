/** Mordekaiser, Dominating. */
import type { Effect } from "@rift/protocol";
import { registerCardScript, WHEN_I_ATTACK, WHEN_PLAYED } from "../sdk";
import { UNIT_OR_GEAR } from "./custom";

/** Mordekaiser, Dominating (RAD-137) — "When you play me or when I attack, you may discard 1 to kill a unit or gear." */
const MORDE_KILL: Effect = {
  op: "cost_then",
  cost: { discard: 1 },
  optional: true,
  effect: { op: "kill", target: { chosen: true, where: UNIT_OR_GEAR } },
};

registerCardScript({
  name: "Mordekaiser, Dominating",
  text: "When you play me or when I attack, you may discard 1 to kill a unit or gear.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: MORDE_KILL },
    { kind: "triggered", trigger: WHEN_I_ATTACK, effect: MORDE_KILL },
  ],
});
