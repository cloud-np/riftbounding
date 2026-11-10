/**
 * 411.2 soft-locks found by the edge-case audit (docs/rules/edge-cases-audit.md):
 *
 * 1. Clicking an opponent's card did not answer a target prompt in multiplayer rooms (the
 *    ownership check ran first), so a trigger or click-played spell aimed at an enemy unit
 *    could never be answered.
 * 2. A prompt whose options sit in a pile (deck, trash, …) opened in board-click mode, which
 *    hides the prompt dialog, although pile cards cannot be clicked on the board (Stacked Deck,
 *    Vision/Predict, trash picks).
 */
import { describe, expect, it } from "vitest";

import { applyGameAction } from "@rift/engine";
import type { CardInstance, Prompt, Room } from "@rift/protocol";

import { promptHasBoardTargets, strictPromptClick } from "../strict-interaction";
import { placeUnit } from "../../../../../../../packages/rules/test/rules/combat/helpers";
import { scenario } from "../../../../../../../packages/rules/test/scenarios/dsl";
import { makeContext } from "../../../../../../../packages/engine/test/strict-gestures-fixture";

function enemyTargetPrompt() {
  const s = scenario({ p1: { hand: ["Gust"], energy: 2 } });
  // Two enemy units so the target is a real choice (a single legal target is bound without a
  // prompt); the own base unit is only used by the hand-built pick prompts below.
  const target = placeUnit(s, "p2", "Treasure Hunter", "battlefieldA", "softlock-target");
  placeUnit(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "softlock-target-2");
  const own = placeUnit(s, "p1", "Treasure Hunter", "base", "softlock-own");
  s.as("p1").play("Gust").expectOk();
  const prompt = s.room.rules!.prompt!;
  return { s, prompt, targetId: target.id, ownId: own.id };
}

function moveToPile(room: Room, playerIndex: number, pile: "trash" | "deck"): CardInstance {
  const board = room.players[playerIndex]!.board!;
  const card = board.deck.shift()!;
  board[pile].push(card);
  return card;
}

function pickPrompt(playerId: string, cardIds: string[]): Prompt {
  return {
    id: "softlock-pick",
    kind: "choose-card",
    playerId,
    options: cardIds.map((cardId) => ({ id: `opt-${cardId}`, cardId })),
    min: 1,
    max: 1,
  };
}

describe("strict prompt soft-locks [R411.2]", () => {
  it("clicking an opponent's unit answers the prompt, sent by the prompted player", () => {
    const { s, prompt, targetId } = enemyTargetPrompt();
    expect(prompt.playerId).toBe("p1");
    expect(prompt.options?.some((option) => option.cardId === targetId || option.objectId === targetId)).toBe(true);
    expect(promptHasBoardTargets(s.room, prompt)).toBe(true);

    // The routing takes no owner: the enemy card resolves to the answering gesture.
    const gesture = strictPromptClick(prompt, true, "battlefieldA", targetId);
    expect(gesture).toMatchObject({ type: "toggle_exhausted", cardId: targetId });
    if (!gesture || gesture === "not-an-option") throw new Error("expected a gesture");

    // The engine accepts it from the prompted player (p1) although p2 owns the card.
    const result = applyGameAction(s.room, "p1", gesture, makeContext());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.rules?.prompt?.id).not.toBe(prompt.id);
  });

  it("a card that is not an option sends nothing, and no board prompt falls through", () => {
    const { s, prompt } = enemyTargetPrompt();
    expect(strictPromptClick(prompt, true, "base", "not-an-option-id")).toBe("not-an-option");
    // A non-option card at the same battlefield as the options must not pick one by its zone.
    expect(strictPromptClick(prompt, true, "battlefieldA", "not-an-option-id")).toBe("not-an-option");
    expect(strictPromptClick(null, false, "battlefieldA", "anything")).toBe(null);
    expect(strictPromptClick(prompt, false, "battlefieldA", "anything")).toBe(null);
    expect(s.room.rules?.prompt?.id).toBe(prompt.id);
  });

  it("a prompt whose options are in the trash or deck uses the dialog, not board clicks", () => {
    const { s } = enemyTargetPrompt();
    const trashCard = moveToPile(s.room, 0, "trash");
    const deckCard = s.room.players[0]!.board!.deck[0]!;
    expect(promptHasBoardTargets(s.room, pickPrompt("p1", [trashCard.id]))).toBe(false);
    expect(promptHasBoardTargets(s.room, pickPrompt("p1", [deckCard.id]))).toBe(false);
  });

  it("a prompt mixing board units and pile cards uses the dialog, so every option stays reachable", () => {
    const { s, ownId, targetId } = enemyTargetPrompt();
    const trashCard = moveToPile(s.room, 0, "trash");
    expect(promptHasBoardTargets(s.room, pickPrompt("p1", [ownId, targetId]))).toBe(true);
    expect(promptHasBoardTargets(s.room, pickPrompt("p1", [ownId, trashCard.id]))).toBe(false);
  });
});
