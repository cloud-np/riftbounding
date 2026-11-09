/**
 * `channel` — rule 431 (431.2.a: ready by default; "channel 1 rune exhausted", EX[219];
 * 431.3: as many as possible). `$channelled` records the count for "if you couldn't channel 2".
 */
import { channelRunes } from "../../actions/resources";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome } from "../targets";
import { amountOf, playersOf } from "./util";

registerEffectOp("channel", (effect, context) => {
  if (effect.op !== "channel") return { status: "manual", reason: "effect_not_implemented:channel" };
  const amount = Math.max(0, amountOf(context, effect.amount) ?? 0);
  const channelled: string[] = [];
  if (amount > 0) {
    for (const playerId of playersOf(context, effect.player)) {
      channelled.push(
        ...channelRunes(context.room, playerId, amount, context.step, effect.exhausted ? { exhausted: true } : {}),
      );
    }
  }
  if (context.machine) context.machine.env.vars.$channelled = channelled.length;
  recordOutcome(context, channelled, channelled.length > 0);
  return RESOLVED;
});
