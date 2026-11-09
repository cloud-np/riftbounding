import { describe, expect, it } from "vitest";

import { createTranslator } from "@rift/i18n";
import type {
  CombatDamageAssignmentData,
  LegalIntents,
  Prompt,
  Room,
  WireAction,
} from "@rift/protocol";

import {
  assignmentAnswer,
  canSubmitAssignment,
  canSubmitSelection,
  damageAssignmentData,
  initialAssignment,
  isStrictRoom,
  promptForClient,
  remainingDamage,
  selectionAnswer,
  stepAssignment,
  strictActionButtons,
  strictActorFor,
  strictIntentFor,
  strictStatus,
  toggleSelection,
} from "../strict-model";

const t = createTranslator("en");

function room(overrides: Partial<Room> = {}): Room {
  return {
    roomCode: "STRICT",
    createdAt: 1,
    updatedAt: 1,
    phase: "in_game",
    players: [
      {
        id: "p1",
        seat: 0,
        name: "Alice",
        joinedAt: 1,
        board: {
          hand: [{ id: "c1", name: "Rebuke", source: "mainDeck", exhausted: false, createdAt: 1 }],
          base: [
            { id: "u1", name: "Noxus Hopeful", source: "mainDeck", exhausted: false, createdAt: 1 },
          ],
        },
      },
      { id: "p2", seat: 1, name: "Bob", joinedAt: 1 },
    ],
    log: [],
    chainEntries: [],
    chainResolveVotes: [],
    rulesMode: "strict",
    rules: {
      version: 1,
      turn: { player: "p1", number: 1, phase: "main" },
      priority: "p1",
      focus: null,
      passes: [],
      chain: [],
      showdown: null,
      combat: null,
      contested: {},
      staged: { showdowns: [], combats: [] },
      tasks: [],
      prompt: null,
      triggers: [],
      effects: [],
      objects: {},
      pools: {},
      scoredThisTurn: {},
      history: { cardsPlayedThisTurn: {} },
      manual: null,
    },
    ...overrides,
  } as unknown as Room;
}

function legal(overrides: Partial<LegalIntents> = {}): LegalIntents {
  return {
    playerId: "p1",
    playableCardIds: [],
    activatable: [],
    moves: [],
    canPass: false,
    canEndTurn: false,
    canChoose: false,
    canManualDone: false,
    prompt: null,
    ...overrides,
  };
}

describe("strict board model (R2-int)", () => {
  it("only applies to strict in-game rooms; sandbox intents pass through unchanged", () => {
    expect(isStrictRoom(room())).toBe(true);
    const sandbox = room({ rulesMode: undefined, rules: undefined });
    expect(isStrictRoom(sandbox)).toBe(false);
    const endTurn = {
      type: "end_turn",
      observed: { turnNumber: 1, activePlayerId: "p1", activeStep: "main" },
    } as WireAction;
    expect(strictIntentFor(endTurn, sandbox)).toBe(endTurn);
    expect(strictIntentFor(endTurn, room())).toEqual({ type: "rules_end_turn" });
    expect(strictIntentFor({ type: "draw_cards", count: 1 } as never, room())).toEqual({
      type: "draw_cards",
      count: 1,
    });
  });

  it("[R312] acts as the seat that may act when this client controls it", () => {
    expect(strictActorFor({ kind: "priority", player: "p2", window: "main" }, "p1", ["p1"])).toBe(
      "p1",
    );
    expect(
      strictActorFor({ kind: "priority", player: "p2", window: "main" }, "p1", ["p1", "p2"]),
    ).toBe("p2");
    expect(strictActorFor(null, "p1", ["p1"])).toBe("p1");
  });

  it("builds one button per legal play, activation (manual label for §6.4), move, pass and end turn", () => {
    const buttons = strictActionButtons(
      room(),
      legal({
        playableCardIds: ["c1"],
        playable: [
          {
            cardId: "c1",
            locations: ["base", "battlefieldA"],
            optionalCosts: [],
            cost: { energy: 1, power: 0 },
          },
        ],
        activatable: [
          { objectId: "u1", ability: "activated:0" },
          { objectId: "u1", ability: "manual:1" },
        ],
        moves: [{ unitIds: ["u1"], to: "battlefieldA" }],
        canPass: true,
        canEndTurn: true,
      }),
      t,
    );
    expect(buttons.map((button) => button.label)).toEqual([
      "Play Rebuke → Base",
      "Play Rebuke → Battlefield A",
      "Activate: Noxus Hopeful",
      "Activate (manual): Noxus Hopeful",
      "Noxus Hopeful — Move to Battlefield A",
      "Pass",
      "End turn",
    ]);
    expect(buttons[1]!.intent).toEqual({
      type: "rules_play",
      cardId: "c1",
      location: "battlefieldA",
    });
    expect(buttons[3]!.intent).toEqual({
      type: "rules_activate",
      objectId: "u1",
      ability: "manual:1",
    });
    expect(buttons[4]!.intent).toEqual({ type: "rules_move", unitIds: ["u1"], to: "battlefieldA" });
    expect(strictActionButtons(room(), null, t)).toEqual([]);
  });

  it("[R411.2] shows whose decision is pending, and the manual window", () => {
    const r = room();
    expect(
      strictStatus(r, { kind: "priority", player: "p1", window: "main" }, ["p1"], t, null),
    ).toBe("You have priority");
    expect(
      strictStatus(
        r,
        { kind: "prompt", player: "p2", window: "prompt" },
        ["p1"],
        t,
        "Assign combat damage",
      ),
    ).toBe("Waiting for Bob: Assign combat damage");
    r.rules!.manual = { itemId: "i1", player: "p1", cardName: "Meditation" };
    expect(
      strictStatus(r, { kind: "manual", player: "p1", window: "manual" }, ["p1"], t, null),
    ).toBe("Resolve Meditation manually, then press Done.");
  });

  it("[R411.2] option prompts: single replaces, multi respects min/max, order needs every option", () => {
    const pick: Prompt = {
      id: "p",
      kind: "choose-card",
      playerId: "p1",
      options: [{ id: "a" }, { id: "b" }, { id: "c" }],
      min: 1,
      max: 2,
    };
    expect(toggleSelection(pick, ["a", "b"], "c")).toEqual(["a", "b"]);
    expect(canSubmitSelection(pick, [])).toBe(false);
    expect(canSubmitSelection(pick, ["a", "c"])).toBe(true);
    expect(canSubmitSelection(pick, ["z"])).toBe(false);
    expect(toggleSelection({ ...pick, max: 1 }, ["a"], "b")).toEqual(["b"]);
    const order: Prompt = { ...pick, kind: "order", min: undefined, max: undefined };
    expect(canSubmitSelection(order, ["b", "a"])).toBe(false);
    expect(selectionAnswer(order, ["c", "a", "b"])).toEqual({
      optionIds: ["c", "a", "b"],
      orderedIds: ["c", "a", "b"],
    });
    const r = room();
    r.rules!.prompt = pick;
    expect(promptForClient(r, ["p1"])).toBe(pick);
    expect(promptForClient(r, ["p2"])).toBeNull();
  });

  it("[R467.2.c] damage assignment: prefill the suggestion, clamp to the total, answer the contract", () => {
    const data: CombatDamageAssignmentData = {
      reason: "combat.damage_assignment",
      battlefield: "battlefieldA",
      assignerId: "p1",
      total: 3,
      targets: [
        { objectId: "u2", lethal: 2, tier: 0, exclusiveChoices: ["tank"] },
        { objectId: "u3", lethal: null, tier: 1 },
      ],
      suggested: [{ targetId: "u2", amount: 2 }],
    };
    const prompt: Prompt = {
      id: "dmg",
      kind: "damage-assignment",
      playerId: "p1",
      options: [{ id: "u2", objectId: "u2" }],
      data: data as unknown as Prompt["data"],
    };
    expect(damageAssignmentData(prompt)).toBe(data);
    expect(damageAssignmentData({ ...prompt, data: { reason: "play.choice" } })).toBeNull();
    let draft = initialAssignment(data);
    expect(draft).toEqual({ u2: 2, u3: 0 });
    expect(remainingDamage(data, draft)).toBe(1);
    expect(canSubmitAssignment(data, draft)).toBe(false);
    draft = stepAssignment(data, draft, data.targets[0]!, 5);
    expect(draft).toEqual({ u2: 3, u3: 0 });
    expect(stepAssignment(data, draft, data.targets[1]!, 1)).toEqual(draft);
    expect(canSubmitAssignment(data, draft)).toBe(true);
    expect(assignmentAnswer(draft)).toEqual({ assignments: [{ targetId: "u2", amount: 3 }] });
  });
});
