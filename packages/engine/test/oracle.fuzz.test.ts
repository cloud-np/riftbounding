import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { Room } from "@rift/protocol";
import { applyGameAction } from "../src";

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
function lcg(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (1664525 * state + 0x3c6ef35f) >>> 0;
    return state / 0x100000000;
  };
}
function factory(prefix: string) {
  let n = 0;
  return (kind: string) => `${prefix}${kind}_${n++}`;
}

type Action = Record<string, unknown> & { type: string };

function randomAction(room: Room, random: () => number): Action {
  const actorIndex = Math.max(0, room.players.findIndex((player) => player.id === room.activeTurnPlayerId));
  const board = room.players[actorIndex]?.board;
  const pick = <T,>(items: T[]): T | undefined => items[Math.floor(random() * items.length)];
  const handCard = pick(board?.hand ?? [])?.id;
  const rune = pick(board?.runeArea ?? [])?.id;
  const baseCard = pick(board?.base ?? [])?.id;
  const deckCard = board?.deck.at(-1)?.id;
  const pool: Action[] = [
    { type: "adjust_score", delta: 1 },
    { type: "adjust_legend_xp", delta: 1 },
    { type: "adjust_floating_resource", resource: "energy", delta: 1 },
    { type: "draw_cards", count: 1 },
    { type: "draw_rune" },
    { type: "peek_deck_top", count: 2 },
    { type: "dismiss_deck_peek" },
    { type: "shuffle_deck" },
    { type: "create_token", zone: "base", name: "Recruit" },
    { type: "set_hand_reveal", reveal: true },
    { type: "toggle_exhausted", zone: "runeArea", cardId: rune ?? "missing", expectedExhausted: false },
    { type: "toggle_exhausted", zone: "base", cardId: baseCard ?? "missing", expectedExhausted: false },
    { type: "adjust_card_might", zone: "base", cardId: baseCard ?? "missing", delta: 1 },
    { type: "adjust_card_counter", zone: "base", cardId: baseCard ?? "missing", counter: "white", delta: 1 },
    { type: "set_card_label", zone: "base", cardId: baseCard ?? "missing", slot: 0, label: "Shield 1" },
    { type: "duplicate_card", zone: "hand", cardId: handCard ?? "missing" },
    { type: "move_card", from: "hand", to: "base", cardId: handCard ?? "missing" },
    { type: "send_to_deck", from: "hand", cardId: handCard ?? "missing", position: "bottom" },
    { type: "take_top_from_deck", to: "hand" },
    { type: "recycle_all_trash_to_deck" },
    { type: "roll_die", sides: 20 },
    { type: "chain_add", from: "hand", cardId: handCard ?? "missing" },
    { type: "chain_resolve", entryId: room.chainEntries[0]?.id ?? "missing" },
    { type: "end_beginning_phase", observed: { turnNumber: room.turnNumber, activePlayerId: room.activeTurnPlayerId, activeStep: room.activeTurnStep } },
    { type: "end_turn", observed: { turnNumber: room.turnNumber, activePlayerId: room.activeTurnPlayerId, activeStep: room.activeTurnStep } },
    { type: "set_extra_turn", entryId: room.chainEntries[0]?.id ?? "missing", enabled: true },
    { type: "payment_batch", operations: [{ type: "adjust_floating_resource", resource: "energy", delta: -1 }] },
    { type: "rune_batch", operations: [{ type: "draw_rune" }] },
    { type: "target_arrow_add", sourceCardId: deckCard ?? "missing", targetCardId: handCard ?? "missing", sourceAnchor: "board", targetAnchor: "board" },
    { type: "peek_deck_bottom" },
    { type: "clear_deck_peek" },
    { type: "set_deck_peek_cards_reveal", cardIds: [...(board?.deckPeek?.cardIds ?? [])], reveal: true },
    { type: "set_card_revealed_to_opponent", zone: "hand", cardId: handCard ?? "missing", revealed: true },
    { type: "set_card_hidden", zone: "hand", cardId: handCard ?? "missing", hidden: true },
    { type: "set_card_hidden", zone: "hand", cardId: handCard ?? "missing", hidden: false },
    { type: "send_rune_to_deck_bottom", cardId: rune ?? "missing" },
    { type: "recycle_rune_for_floating_energy", cardId: rune ?? "missing" },
    { type: "send_to_deck", from: "base", cardId: baseCard ?? "missing", position: "top" },
    { type: "floating_resource_batch", operations: [{ type: "adjust_floating_resource", resource: "power", delta: 2 }] },
    { type: "adjust_floating_resource", resource: "power", delta: -1 },
    { type: "set_score", score: Math.floor(random() * 9) },
    { type: "chain_set_repeat", entryId: room.chainEntries[0]?.id ?? "missing", enabled: true },
    { type: "chain_set_flow", entryId: room.chainEntries[0]?.id ?? "missing", enabled: true },
    { type: "target_arrow_remove_from_source", sourceCardId: baseCard ?? "missing", sourceAnchor: "board" },
    { type: "target_arrow_clear_all" },
    { type: "set_battlefield_brush", zone: "battlefieldA", active: true },
    ...(room.pendingBattlefieldConquerAssist
      ? [
          { type: "battlefield_conquer_pass_focus", zone: room.pendingBattlefieldConquerAssist.zone },
          { type: "battlefield_conquer_pass_response", zone: room.pendingBattlefieldConquerAssist.zone },
          { type: "battlefield_conquer_confirm", zone: room.pendingBattlefieldConquerAssist.zone },
          { type: "battlefield_conquer_dismiss", zone: room.pendingBattlefieldConquerAssist.zone },
        ]
      : []),
  ];
  return pick(pool) ?? { type: "draw_cards" };
}

describe.skipIf(!fs.existsSync(ORACLE) || !fs.existsSync(path.join(ROOT, ".recon/site/playapp/dl/_next/static/immutable/chunks")) || !fs.existsSync(FIXTURE))("oracle fuzz", () => {
  it("stays in sync across pseudo-random action sequences", async () => {
    const { loadOriginal } = await import(pathToFileURL(ORACLE).href);
    const original = loadOriginal();
    for (const seed of [20261022, 77, 1234567, 424242, 999]) {
      let mine = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Room;
      let theirs = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Room;
      const random = lcg(seed);
      const factoryA = factory("t");
      const factoryB = factory("t");
      for (let step = 0; step < 120; step += 1) {
      const actor = mine.activeTurnPlayerId ?? mine.players[0]!.id;
      const action = randomAction(mine, random);
      const now = 1760001000000 + step * 1000;
      const mineResult = applyGameAction(mine, actor, action, {
        now,
        rng: lcg(3000 + step),
        mode: "multiplayer",
        idFactory: factoryA,
      });
      const oracle = original.applyDirect(theirs, actor, action, {
        now: () => now,
        random: lcg(3000 + step),
        idFactory: factoryB,
      });
        const mineState = mineResult.ok ? mineResult.state : mine;
        expect(normalize(mineState), `seed ${seed} ${actor} ${action.type} #${step}`).toEqual(
          normalize(oracle.state),
        );
        mine = mineState;
        theirs = oracle.state;
        if (mine.phase !== "in_game") break;
      }
    }
  });
});
