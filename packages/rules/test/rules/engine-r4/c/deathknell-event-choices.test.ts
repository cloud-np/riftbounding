/**
 * Lane C (R4-engine) — 355.7 / 383.2.c.3.b / 808.1.d.3: a Deathknell's chosen target "here" is
 * legal while the source is already in the trash; the choice scan reads the trigger event's
 * last-known location. 411.2: one legal option is bound automatically.
 */
import { describe, expect, it } from "vitest";
import { fund } from "../../effects/helpers";
import { put, withCards, type S } from "../../../cards/rad/helpers";

/** Pass/answer prompts (target choices and the `may` decision) until the state settles. */
function drive(s: S, targetId: string, guard = 16): void {
  for (let index = 0; index < guard; index += 1) {
    const rules = s.room.rules!;
    const prompt = rules.prompt;
    if (prompt) {
      if (prompt.kind === "yes-no") {
        s.as(prompt.playerId).choose({ optionIds: ["yes"] }).expectOk();
      } else if (prompt.kind === "choose-target") {
        s.as(prompt.playerId).choose({ optionIds: [targetId] }).expectOk();
      } else {
        return;
      }
      continue;
    }
    if (rules.chain.length === 0 && !rules.showdown && !rules.combat) return;
    const holder = rules.priority ?? rules.focus;
    if (!holder) return;
    s.as(holder).pass().expectOk();
  }
}

describe("Deathknell choices read the trigger event [R808.1.d.3][R383.2.c.3.b]", () => {
  it("[C:Mournful Spirit][R355.7][R808.1.d.3] a Deathknell can choose a target 'here' when finalized", () => {
    const s = withCards(["Lost to the Sands"], ["Mournful Spirit"]);
    const spirit = put(s, "p2", "Mournful Spirit", "battlefieldA");
    const hunter = put(s, "p1", "Treasure Hunter", "battlefieldA");
    const heron = put(s, "p1", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Lost to the Sands");
    s.as("p1")
      .play("Lost to the Sands", { choices: { mode: "deal", "target:0": spirit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    // 403.2: the target is a play-time choice of the triggered ability; "here" is the dead
    // spirit's last-known battlefield (383.2.c.3.b).
    expect(s.room.rules!.prompt).toMatchObject({ kind: "choose-target", playerId: "p2", rule: "403.2" });
    const item = s.room.rules!.chain.find((entry) => entry.cardName === "Mournful Spirit")!;
    expect(item.triggerEvent).toMatchObject({ type: "kill", zone: "battlefieldA" });
    drive(s, hunter.id);
    expect(s.host.findCard(s.room, hunter.id)?.zone).toBe("trash");
    expect(s.host.findCard(s.room, heron.id)?.zone).toBe("battlefieldA");
  });

  it("[C:Mournful Spirit][R411.2][R808.1.d.3] one legal 'here' target is bound automatically", () => {
    const s = withCards(["Lost to the Sands"], ["Mournful Spirit"]);
    const spirit = put(s, "p2", "Mournful Spirit", "battlefieldA");
    const hunter = put(s, "p1", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Lost to the Sands");
    s.as("p1")
      .play("Lost to the Sands", { choices: { mode: "deal", "target:0": spirit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.prompt).toBeNull();
    const item = s.room.rules!.chain.find((entry) => entry.cardName === "Mournful Spirit")!;
    expect(item.choices["target:0"]).toBe(hunter.id);
    drive(s, hunter.id);
    expect(s.host.findCard(s.room, hunter.id)?.zone).toBe("trash");
  });
});
