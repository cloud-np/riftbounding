/**
 * Differential tests against the original minified engine (`.recon/oracle/`).
 *
 * The oracle is gitignored dev tooling; these tests skip gracefully when it is absent.
 * Every action is run through the original handler map (`cU`) with the same clock, RNG and
 * id factory, then through @rift/engine. State comparison ignores the fields the original
 * server owns outside the transition function (log, updatedAt, rewind bookkeeping) and the
 * client-mirror's duel-victory quirk (see PORTING.md).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { CardInstance, Room } from "@rift/protocol";
import { applyGameAction } from "../src";
import { isSpellCardType, isUnitCardType } from "../src/catalog";

const ROOT = path.resolve(__dirname, "../../..");
const ORACLE_DIR = path.join(ROOT, ".recon/oracle");
const ORACLE = path.join(ORACLE_DIR, "load.mjs");
const FIXTURE = path.join(ORACLE_DIR, "fixtures/duel-in-game-t1-main.json");
const HAS_ORACLE = fs.existsSync(ORACLE) && fs.existsSync(path.join(ORACLE_DIR, "README.md")) && fs.existsSync(FIXTURE) && fs.existsSync(path.join(ROOT, ".recon/site/playapp/dl/_next/static/immutable/chunks"));

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

function seeded(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (1664525 * state + 0x3c6ef35f) >>> 0;
    return state / 0x100000000;
  };
}

function counterFactory() {
  let n = 0;
  return (kind: string) => `${kind}_t${n++}`;
}

/** cY's id factory: `${prefix}_q${intent.id}_${n++}` (counter resets per action). */
function optimisticFactory(intentId: number) {
  let n = 0;
  return (kind: string) => `${kind}_q${intentId}_${n++}`;
}

function fixture(): Room {
  return JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Room;
}

type Action = Record<string, unknown> & { type: string };

describe.skipIf(!HAS_ORACLE)("oracle differential", () => {
  it("matches the browser optimistic path (cY) including generated ids", async () => {
    const { loadOriginal } = await import(pathToFileURL(ORACLE).href);
    const original = loadOriginal();
    const actions: Action[] = [
      { type: "draw_cards", count: 2 },
      { type: "draw_rune", exhausted: true },
      { type: "peek_deck_top", count: 3 },
      { type: "adjust_score", delta: 2 },
      { type: "adjust_floating_resource", resource: "energy", delta: 3 },
      { type: "create_token", zone: "base", name: "Recruit", count: 2 },
      { type: "duplicate_card", zone: "hand", cardId: "" },
      { type: "set_hand_reveal", reveal: true },
      { type: "toggle_exhausted", zone: "runeArea", cardId: "", expectedExhausted: false },
      { type: "move_card", from: "hand", to: "base", cardId: "" },
      { type: "shuffle_deck" },
    ];
    for (let index = 0; index < actions.length; index += 1) {
      const action = JSON.parse(JSON.stringify(actions[index])) as Action;
      const mineRoom = fixture();
      const board = mineRoom.players[0]!.board!;
      if (action.cardId === "") {
        if (action.type === "toggle_exhausted") action.cardId = board.runeArea[0]!.id;
        else action.cardId = board.hand.find(isUnitCardType)?.id ?? board.hand[0]!.id;
      }
      const theirsRoom = JSON.parse(JSON.stringify(mineRoom)) as Room;
      const intentId = 101 + index;
      const now = mineRoom.updatedAt;
      const mine = applyGameAction(mineRoom, "p1", action, {
        now,
        rng: seeded(intentId),
        mode: "multiplayer",
        idFactory: optimisticFactory(intentId),
      });
      const oracle = original.applyOptimistic(theirsRoom, "p1", action, { intentId });
      const oracleState = oracle.state;
      const mineState = mine.ok ? mine.state : mineRoom;
      expect(normalize(mineState), action.type).toEqual(normalize(oracleState));
    }
  });

  it("matches a long scripted sequence through the cU pipeline", async () => {
    const { loadOriginal } = await import(pathToFileURL(ORACLE).href);
    const original = loadOriginal();
    let mine = fixture();
    let theirs = fixture();
    let now = 1760000100000;
    let step = 0;
    const factoryA = counterFactory();
    const factoryB = counterFactory();
    const act = (actor: string, action: Action) => {
      now += 1000;
      step += 1;
      const mineResult = applyGameAction(mine, actor, action, {
        now,
        rng: seeded(100 + step),
        mode: "multiplayer",
        idFactory: factoryA,
      });
      const oracle = original.applyDirect(theirs, actor, action, {
        now: () => now,
        random: seeded(100 + step),
        idFactory: factoryB,
      });
      if (mineResult.ok) mine = mineResult.state;
      theirs = oracle.state;
      expect(normalize(mine), `${actor} ${action.type} #${step}`).toEqual(normalize(theirs));
    };
    const unit = mine.players[0]!.board!.hand.find(isUnitCardType) as CardInstance;
    const gear = mine.players[0]!.board!.hand.find((card) => card.type?.toLowerCase().includes("gear")) as CardInstance;
    const spell = mine.players[0]!.board!.hand.find(isSpellCardType) as CardInstance;
    act("p1", { type: "move_card", from: "hand", to: "base", cardId: unit.id });
    const inBase = mine.players[0]!.board!.base.find((card) => card.name === unit.name)!;
    act("p1", { type: "toggle_exhausted", zone: "base", cardId: inBase.id, expectedExhausted: true });
    act("p1", { type: "adjust_card_might", zone: "base", cardId: inBase.id, delta: 1 });
    act("p1", { type: "adjust_card_counter", zone: "base", cardId: inBase.id, counter: "white", delta: 2, initializeAtUnitMight: true });
    act("p1", { type: "move_card", from: "hand", to: "base", cardId: gear.id });
    const baseGear = mine.players[0]!.board!.base.find((card) => card.name === gear.name)!;
    act("p1", { type: "equip_card", equipmentCardId: baseGear.id, unitCardId: inBase.id });
    act("p1", { type: "draw_cards", count: 2 });
    act("p1", { type: "draw_rune" });
    act("p1", { type: "peek_deck_top", count: 3 });
    act("p1", { type: "clear_deck_peek" });
    act("p1", { type: "create_token", zone: "base", name: "Recruit" });
    act("p1", { type: "chain_add", from: "hand", cardId: spell.id });
    const chain = mine.chainEntries[0]!;
    act("p1", { type: "chain_resolve", entryId: chain.id });
    act("p1", { type: "adjust_floating_resource", resource: "energy", delta: 2 });
    act("p1", { type: "payment_batch", operations: [{ type: "adjust_floating_resource", resource: "energy", delta: -1 }] });
    act("p1", {
      type: "end_turn",
      observed: { turnNumber: mine.turnNumber, activePlayerId: mine.activeTurnPlayerId, activeStep: mine.activeTurnStep },
    });
    act("p2", { type: "draw_cards" });
    act("p2", { type: "adjust_score", delta: 1 });
    act("p2", {
      type: "end_turn",
      observed: { turnNumber: mine.turnNumber, activePlayerId: mine.activeTurnPlayerId, activeStep: mine.activeTurnStep },
    });
  });
});
