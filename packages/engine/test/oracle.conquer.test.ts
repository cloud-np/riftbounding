import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { CardInstance, Room } from "@rift/protocol";
import { applyGameAction } from "../src";
import { isUnitCardType } from "../src/catalog";

const ROOT = path.resolve(__dirname, "../../..");
const ORACLE = path.join(ROOT, ".recon/oracle/load.mjs");
const FIXTURE = path.join(ROOT, ".recon/oracle/fixtures/duel-in-game-t1-main.json");

function normalize(room: Room): unknown {
  const copy = JSON.parse(JSON.stringify(room)) as Record<string, unknown>;
  delete copy.updatedAt;
  delete copy.gameOutcome;
  delete copy.log;
  delete copy.rewindProtocolVersion;
  delete copy.rewindablePlayerIds;
  delete copy.forwardablePlayerIds;
  delete copy.forwardAvailableUntil;
  delete copy.rewindConfirmation;
  return copy;
}
function counterFactory() {
  let n = 0;
  return (kind: string) => `${kind}_t${n++}`;
}
function seeded(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (1664525 * state + 0x3c6ef35f) >>> 0;
    return state / 0x100000000;
  };
}
type Action = Record<string, unknown> & { type: string };

describe.skipIf(!fs.existsSync(ORACLE) || !fs.existsSync(path.join(ROOT, ".recon/site/playapp/dl/_next/static/immutable/chunks")) || !fs.existsSync(FIXTURE))("oracle conquer variants", () => {
  it("matches conquer-and-draw at victory threshold", async () => {
    const { loadOriginal } = await import(pathToFileURL(ORACLE).href);
    const original = loadOriginal();
    let mine = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Room;
    let theirs = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Room;
    mine.players[0]!.board!.score = 7;
    theirs.players[0]!.board!.score = 7;
    let now = 1760000600000;
    let step = 0;
    const act = (actor: string, action: Action) => {
      now += 1000;
      step += 1;
      const result = applyGameAction(mine, actor, action, {
        now,
        rng: seeded(700 + step),
        mode: "multiplayer",
        idFactory: counterFactory(),
      });
      const oracle = original.applyDirect(theirs, actor, action, {
        now: () => now,
        random: seeded(700 + step),
        idFactory: counterFactory(),
      });
      if (result.ok) mine = result.state;
      theirs = oracle.state;
      expect(normalize(mine), `${actor} ${action.type} #${step}`).toEqual(normalize(theirs));
    };
    const unit = mine.players[0]!.board!.hand.find(isUnitCardType) as CardInstance;
    act("p1", { type: "move_card", from: "hand", to: "battlefieldA", cardId: unit.id });
    act("p1", { type: "battlefield_conquer_pass_focus", zone: "battlefieldA" });
    act("p2", { type: "battlefield_conquer_pass_focus", zone: "battlefieldA" });
    act("p1", { type: "battlefield_conquer_confirm", zone: "battlefieldA" });
    expect(mine.players[0]!.board!.score).toBe(7);
    expect(mine.players[0]!.board!.hand.length).toBe(5);
  });

  it("matches pass_response and dismiss", async () => {
    const { loadOriginal } = await import(pathToFileURL(ORACLE).href);
    const original = loadOriginal();
    let mine = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Room;
    let theirs = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Room;
    let now = 1760000700000;
    let step = 0;
    const act = (actor: string, action: Action) => {
      now += 1000;
      step += 1;
      const result = applyGameAction(mine, actor, action, {
        now,
        rng: seeded(800 + step),
        mode: "multiplayer",
        idFactory: counterFactory(),
      });
      const oracle = original.applyDirect(theirs, actor, action, {
        now: () => now,
        random: seeded(800 + step),
        idFactory: counterFactory(),
      });
      if (result.ok) mine = result.state;
      theirs = oracle.state;
      expect(normalize(mine), `${actor} ${action.type} #${step}`).toEqual(normalize(theirs));
    };
    const unit = mine.players[0]!.board!.hand.find(isUnitCardType) as CardInstance;
    act("p1", { type: "move_card", from: "hand", to: "battlefieldA", cardId: unit.id });
    act("p1", { type: "battlefield_conquer_pass_focus", zone: "battlefieldA" });
    act("p2", { type: "battlefield_conquer_pass_focus", zone: "battlefieldA" });
    act("p2", { type: "battlefield_conquer_pass_response", zone: "battlefieldA" });
    act("p1", { type: "battlefield_conquer_dismiss", zone: "battlefieldA" });
    expect(mine.pendingBattlefieldConquerAssist).toBeUndefined();
  });
});
