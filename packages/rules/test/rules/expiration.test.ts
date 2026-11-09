import { describe, expect, it } from "vitest";
import type { ChainItem } from "@rift/protocol";
import { clearCardScripts, registerCardScript } from "../../src";
import type { CleanupCustomInsertStep } from "../../src/cleanup/cleanup";
import { appendChainItem, finalizeChainItem } from "../../src/timing/fepr";
import { MAX_EXPIRATION_PASSES, runExpirationStep } from "../../src/timing/tasks";
import { scenario } from "../scenarios/dsl";
import { stepOf } from "../scenarios/cleanup-helpers";

/** A synthetic trigger injected during the special cleanup (no R1 trigger engine yet). */
function injectTrigger(id: string): CleanupCustomInsertStep {
  return {
    kind: "custom",
    id,
    apply: (room) => {
      const rules = room.rules;
      if (!rules) return;
      rules.triggers.push({
        id: `${id}-${rules.triggers.length}`,
        controller: rules.turn.player,
        sourceName: "Synthetic Expiration Trigger",
      });
    },
  };
}

describe("Expiration Step repeat [R317.2.f]", () => {
  it("[R317.2.f] an item undergoing FEPR during the step restarts it (errata: Loopy Expiration Step)", () => {
    const s = scenario();
    const step = stepOf(s);
    const first = runExpirationStep(s.room, step, {
      extraInserts: [injectTrigger("probe-trigger")],
    });

    expect(first.feprItems).toBeGreaterThan(0);
    expect(first.repeated).toBe(true);
    expect(step.events.some((event) => event.type === "expiration_repeat")).toBe(true);
    // 317.2.f: do not hand the turn over yet.
    expect(s.room.rules?.turn.player).toBe("p1");
    expect(s.room.rules?.turn.number).toBe(1);
    expect(s.room.rules?.turn.phase).toBe("ending");
    expect(s.room.rules?.turn.step).toBe("expiration");

    // The queued trigger/chain work resolves, then the Expiration Step restarts (317.2.f). The
    // restart owed by the FEPR work is consumed by this pass; the next clean pass hands over.
    // 382/402.1 (R2-effects): the trigger engine places the pending trigger on the chain during
    // the cleanup, so "resolving" it clears both the queue and the chain.
    s.room.rules!.triggers = [];
    s.room.rules!.chain = [];
    const second = runExpirationStep(s.room, step);
    expect(second.repeated).toBe(true);
    expect(s.room.rules?.turn.player).toBe("p1");
    expect(s.room.rules?.turn.phase).toBe("ending");
    expect(s.room.rules?.turn.step).toBe("expiration");
    expect(s.room.rules?.turn.expirationFepr).toBe(0);

    const third = runExpirationStep(s.room, step);
    expect(third.feprItems).toBe(0);
    expect(third.repeated).toBe(false);
    // 317.3: the next queued player is now the Turn Player.
    expect(s.room.rules?.turn.player).toBe("p2");
    expect(s.room.rules?.turn.number).toBe(2);
  });

  it("[R317.2.f][R322] the repeat is bounded and emits loop_guard", () => {
    const s = scenario();
    const step = stepOf(s);
    for (let pass = 0; pass < MAX_EXPIRATION_PASSES; pass += 1) {
      runExpirationStep(s.room, step, { extraInserts: [injectTrigger(`guard-trigger-${pass}`)] });
    }
    const guard = step.events.find((event) => event.type === "loop_guard");
    expect(guard?.data?.rule).toBe("317.2.f");
    expect(guard?.data?.passes).toBe(MAX_EXPIRATION_PASSES);
    // N6: the bound is a real Verdict, not just an event.
    expect(step.loopGuard).toEqual({ rule: "317.2.f" });
    // The bound must not deadlock the turn: the next player still starts.
    expect(s.room.rules?.turn.player).toBe("p2");
  });

  it("[R317.2.f] FEPR detection survives an intent boundary (synthetic item needs an opponent pass)", () => {
    registerCardScript({
      name: "Expiration Probe Spell",
      text: "Synthetic no-op spell for the 317.2.f cross-intent probe.",
      status: "implemented",
      abilities: [{ kind: "spell", effect: { op: "seq", effects: [] } }],
    });
    try {
      const s = scenario();
      const rules = s.room.rules!;
      rules.turn.phase = "ending";
      rules.turn.step = "expiration";
      const step = stepOf(s);

      const item: ChainItem = {
        id: "chain_expiration_probe",
        kind: "card",
        status: "pending",
        controller: "p1",
        cardName: "Expiration Probe Spell",
        choices: {},
        origin: "play",
      };
      appendChainItem(s.room, item, step);
      finalizeChainItem(s.room, item, step);
      // 317.2.f: the durable field records FEPR work during ending/expiration.
      expect(rules.turn.expirationFepr ?? 0).toBeGreaterThan(0);

      // 337.4/340.4: the item's controller holds Priority; the opponent must pass before it
      // resolves, so resolution happens in a later intent than the expiration pass that saw it.
      rules.priority = "p1";
      s.as("p1").pass().expectOk();
      expect(s.room.rules?.turn.expirationFepr ?? 0).toBeGreaterThan(0);
      s.as("p2").pass().expectOk();

      // The FEPR work still forced a restart of the Expiration Step after the resolution.
      expect(s.events().some((event) => event.type === "expiration_repeat")).toBe(true);
      // ...and the following clean pass handed the turn over (317.3).
      expect(s.room.rules?.turn.player).toBe("p2");
    } finally {
      clearCardScripts();
    }
  });

  it("[R317.2.f][N6] applyRulesIntent returns a loop_guard Verdict when the expiration bound is hit", () => {
    // Direct state: the pass counter is one short of the bound and a FEPR episode is pending, so
    // the queued Expiration Step must fail loudly through the public intent path.
    const s = scenario();
    const rules = s.room.rules!;
    rules.turn.phase = "ending";
    rules.turn.step = "expiration";
    rules.turn.expirationPasses = MAX_EXPIRATION_PASSES - 1;
    rules.turn.expirationFepr = 1;
    rules.tasks.push({ id: "task_expiration_guard", kind: "expiration" });
    rules.prompt = {
      id: "prompt_expiration_guard",
      kind: "yes-no",
      playerId: "p1",
      options: [{ id: "yes" }],
      data: { reason: "future_effect_prompt" },
    };

    s.as("p1").choose({ optionIds: ["yes"] });
    expect(s.lastError()).toEqual({ code: "loop_guard", rule: "317.2.f" });
  });

  it("[R317.2.f] blocking without FEPR work emits expiration_paused, not expiration_repeat", () => {
    // NEW-9: only "items underwent the FEPR process" restarts the step. An open showdown is a
    // blocker, but with zero FEPR items it is a pause, not a repeat.
    const s = scenario();
    s.room.rules!.showdown = {
      battlefield: "battlefieldA",
      kind: "non_combat",
      startedBy: "p1",
    };
    const step = stepOf(s);
    const result = runExpirationStep(s.room, step);

    expect(result).toEqual({ feprItems: 0, repeated: false });
    expect(step.events.some((event) => event.type === "expiration_paused")).toBe(true);
    expect(step.events.some((event) => event.type === "expiration_repeat")).toBe(false);
    // 317.2.f did not restart the step; the turn is not handed over while the window is open.
    expect(s.room.rules?.turn.player).toBe("p1");
    expect(s.room.rules?.turn.phase).toBe("ending");
    expect(s.room.rules?.turn.step).toBe("expiration");
  });
});
