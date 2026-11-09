/**
 * R4-engine part A integration — the two fixes the lane reports left outside their ownership:
 *
 * 1. `effects/targets.ts` `noteLki` records the same object state as the `kill` event
 *    (383.2.c.3.b / 424 / 427 / 442), so a later look-back sees stunned/buffs/Empowered.
 * 2. `play/triggered.ts` `answerTriggerDecision` keys an accepted optional attached trigger's
 *    once-per-turn limit by the attached script name (718.3 / 719.1, 383.3.e.1).
 */
import { describe, expect, it } from "vitest";
import type { CardScript } from "@rift/protocol";
import {
  answerTriggerDecision,
  flushPendingTriggers,
  getCardScript,
} from "../../../../src";
import { lkiOf, type EffectEnv } from "../../../../src/effects/env";
import { noteLki } from "../../../../src/effects/targets";
import { place, run, stepFor } from "../../effects/helpers";
import { put, withDeck } from "../d/helpers";
import { withCards } from "../../../cards/unl/helpers";
import { registerTestCardScript } from "../../../../src/testing";

describe("R4-engine part A integration", () => {
  it("[R359.3.e.13][R383.2.c.3.b][R424][R427][R442] noteLki records stunned, buffs and Empowered", () => {
    const s = withCards([]);
    const unit = place(s, "p1", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects[unit.id] = {
      ...s.room.rules!.objects[unit.id],
      stunned: true,
      buffs: 2,
      empowered: 1,
    };
    const env: EffectEnv = { controller: "p1", choices: {}, vars: {} };
    noteLki({ room: s.room, host: s.host, env }, [unit.id]);
    expect(lkiOf(env, unit.id)).toMatchObject({
      zone: "battlefieldA",
      name: "Treasure Hunter",
      stunned: true,
      buffs: 2,
      empowered: 1,
    });
  });

  it("[C:Guardian Angel][R718.3][R719.1][R383.3.e.1] an accepted optional attached trigger counts against the attached script's limit", () => {
    const original = getCardScript("Guardian Angel");
    registerTestCardScript({
      name: "Guardian Angel",
      text: "test attached optional trigger",
      status: "implemented",
      abilities: [
        {
          kind: "triggered",
          optional: true,
          limit: { kind: "once-per-turn" },
          trigger: { kind: "event", event: { type: "move", subject: { targetRef: "self" } } },
          effect: { op: "draw", amount: 1 },
        },
      ],
    } satisfies CardScript);
    try {
      const s = withDeck(["Guardian Angel"]);
      const host = put(s, "p1", "Caitlyn, Patrolling", "base");
      const gear = put(s, "p1", "Guardian Angel", "base");
      run(s, {
        op: "attach",
        gear: { targetRef: `obj:${gear.id}` },
        to: { targetRef: `obj:${host.id}` },
      });
      s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
      const step = stepFor(s);
      if (!s.room.rules!.chain.some((item) => item.cardName === "Guardian Angel")) {
        flushPendingTriggers(s.room, step);
      }
      const item = s.room.rules!.chain.find((entry) => entry.cardName === "Guardian Angel")!;
      expect(item).toMatchObject({
        sourceObjectId: host.id,
        sourceName: "Guardian Angel",
        abilityRef: "triggered:0",
        optional: true,
      });
      answerTriggerDecision(s.room, step, item, "may", true);
      const limits = s.room.rules!.history.effects?.limits ?? {};
      expect(limits[`${host.id}|Guardian Angel|triggered:0`]).toBe(1);
      expect(limits[`${host.id}|triggered:0`]).toBeUndefined();
    } finally {
      if (original) registerTestCardScript(original);
    }
  });
});
