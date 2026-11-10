import { describe, expect, it } from "vitest";
import { strictLegalIntents, strictWhoMayAct } from "@rift/engine";
import type { Room } from "@rift/protocol";

import { createSeededRng } from "../localGame";
import {
  STRICT_BOT_ACTION_CAP,
  STRICT_BOT_ID,
  STRICT_HUMAN_ID,
  applyStrictIntent,
  createStrictHarness,
  runBotUntilIdle,
  strictViewFor,
} from "../strictGame";

function names(room: Room, id: string, zone: "hand" | "base" | "battlefieldB" | "runeArea") {
  return room.players.find((p) => p.id === id)!.board![zone].map((c) => c.name);
}

describe("strict dev room", () => {
  it("auto-setups into a strict Main Phase", () => {
    const h = createStrictHarness({ seed: 7 });
    expect(h.room.phase).toBe("in_game");
    expect(h.room.rulesMode).toBe("strict");
    expect(h.room.rules).toBeTruthy();
    expect(h.room.roomMode).toBe("multiplayer");
    expect(h.room.players.find((p) => p.id === STRICT_BOT_ID)?.isBot).toBe(true);
  });

  it("bot burst terminates within the cap and never errors", () => {
    const h = createStrictHarness({ seed: 7 });
    const rng = createSeededRng(3);
    // Whoever has the first turn, drive bot (and hand the turn back by ending the human's turn).
    let { room, timeline } = h;
    for (let round = 0; round < 6 && !room.gameOutcome; round += 1) {
      const who = strictWhoMayAct(room);
      if (who && who.kind !== "none" && who.player === STRICT_HUMAN_ID) {
        const legal = strictLegalIntents(strictViewFor(room, STRICT_HUMAN_ID), STRICT_HUMAN_ID);
        if (legal?.canEndTurn) {
          const step = applyStrictIntent(room, timeline, STRICT_HUMAN_ID, { type: "rules_end_turn" }, rng, "human");
          expect(step.record.ok).toBe(true);
          room = step.room;
          timeline = step.timeline;
        } else {
          const step = applyStrictIntent(room, timeline, STRICT_HUMAN_ID, { type: "rules_pass" }, rng, "human");
          room = step.room;
          timeline = step.timeline;
        }
      }
      const burst = runBotUntilIdle(room, timeline, rng);
      expect(burst.records.length).toBeLessThanOrEqual(STRICT_BOT_ACTION_CAP);
      expect(burst.records.every((r) => r.ok)).toBe(true);
      room = burst.room;
      timeline = burst.timeline;
    }
  });
});

describe("showdown scenario", () => {
  it("builds a consistent strict room", () => {
    const h = createStrictHarness({ seed: 1, scenario: "showdown" });
    const { room } = h;
    expect(names(room, STRICT_HUMAN_ID, "base")).toEqual(["Legion Rearguard", "Hunting Dog", "Petty Officer"]);
    expect(names(room, STRICT_HUMAN_ID, "hand")).toEqual(["Noxus Saboteur", "Hextech Ray", "Cleave"]);
    expect(names(room, STRICT_HUMAN_ID, "runeArea")).toHaveLength(8);
    expect(names(room, STRICT_BOT_ID, "battlefieldB")).toEqual(["Legion Rearguard", "Carrion Dredger"]);
    expect(room.rules!.objects.battlefieldB?.controller).toBe(STRICT_BOT_ID);
    expect(room.rules!.turn.player).toBe(STRICT_HUMAN_ID);
    expect(strictWhoMayAct(room)).toMatchObject({ kind: "priority", player: STRICT_HUMAN_ID });
    // every card id is unique across all zones
    const ids = room.players.flatMap((p) => Object.values(p.board!).flatMap((z) => (Array.isArray(z) ? z.map((c: { id: string }) => c.id) : [])));
    expect(new Set(ids).size).toBe(ids.length);
    // the bot is not asked to act yet
    const legal = strictLegalIntents(strictViewFor(room, STRICT_HUMAN_ID), STRICT_HUMAN_ID);
    expect(legal?.canEndTurn).toBe(true);
  });

  it("moving a unit to the bot battlefield opens a showdown that resolves into combat deaths", () => {
    const h = createStrictHarness({ seed: 1, scenario: "showdown" });
    let { room, timeline } = h;
    const rng = createSeededRng(5);
    const dog = h.scenarioInfo!.humanUnits[1]!;
    let step = applyStrictIntent(room, timeline, STRICT_HUMAN_ID, { type: "rules_move", unitIds: [dog], to: "battlefieldB" }, rng, "human");
    expect(step.record).toMatchObject({ ok: true });
    room = step.room;
    timeline = step.timeline;
    expect(room.rules!.showdown).toBeTruthy();
    let guard = 0;
    while ((room.rules!.showdown || room.rules!.combat || room.rules!.prompt || room.rules!.chain.length) && guard++ < 30) {
      const who = strictWhoMayAct(room);
      if (!who || who.kind === "none") break;
      if (who.player === STRICT_BOT_ID) {
        const burst = runBotUntilIdle(room, timeline, rng, 4);
        expect(burst.records.length).toBeGreaterThan(0);
        room = burst.room;
        timeline = burst.timeline;
      } else if (who.kind === "prompt") {
        const prompt = room.rules!.prompt!;
        const data = prompt.data as { suggested?: unknown } | undefined;
        step = applyStrictIntent(room, timeline, STRICT_HUMAN_ID, { type: "rules_choose", promptId: prompt.id, answer: { assignments: data?.suggested ?? [] } } as never, rng, "human");
        expect(step.record.ok).toBe(true);
        room = step.room; timeline = step.timeline;
      } else {
        step = applyStrictIntent(room, timeline, STRICT_HUMAN_ID, { type: "rules_pass" }, rng, "human");
        expect(step.record.ok).toBe(true);
        room = step.room; timeline = step.timeline;
      }
    }
    expect(room.rules!.showdown).toBeNull();
    expect(room.rules!.combat).toBeNull();
    const botTrash = room.players.find((p) => p.id === STRICT_BOT_ID)!.board!.trash.map((c) => c.name);
    expect(botTrash.length).toBeGreaterThan(0);
  });
});
