import { describe, expect, it } from "vitest";
import type { CardInstance, Room, RulesState } from "@rift/protocol";
import { hiddenZoneCardId, redactRoomForViewer, viewerForSpectator } from "./redact";
import { diffRuntimeState, diffRuntimeStateForViewer } from "./diff";
import { applyRuntimePatch } from "./patch";
import { makeCard, makeRoom, makeRng } from "./test-helpers";

/*
 * Card ids encode the card (`setup-<owner>-<source>-<index>-<slug>`), so every private id in
 * `Room.rules` is a leak of the card face (128.4). The fixture uses real-shaped ids.
 */
const BOB_HAND = "setup-bob-mainDeck-0-ogn-viktor-leader";
const BOB_HAND_2 = "setup-bob-mainDeck-1-ogn-flash";
const BOB_DECK_TOP = "setup-bob-mainDeck-2-ogn-singularity";
const BOB_DECK_2 = "setup-bob-mainDeck-3-ogn-void-seeker";
const BOB_FACEDOWN = "setup-bob-mainDeck-4-ogn-hidden-blade";
const BOB_UNIT = "setup-bob-mainDeck-5-ogn-noxus-hopeful";
const BOB_TRASH = "setup-bob-mainDeck-6-ogn-discarded";
const ALICE_HAND = "setup-alice-mainDeck-0-ogn-rebuke";
const ALICE_DECK_TOP = "setup-alice-mainDeck-1-ogn-falling-star";
const ALICE_DECK_2 = "setup-alice-mainDeck-2-ogn-eclipse";

const BOB_PRIVATE = [BOB_HAND, BOB_HAND_2, BOB_DECK_TOP, BOB_DECK_2, BOB_FACEDOWN];
const ALICE_PRIVATE = [ALICE_HAND, ALICE_DECK_TOP, ALICE_DECK_2];

function card(id: string, overrides: Partial<CardInstance> = {}): CardInstance {
  return makeCard(makeRng(id.length), { id, name: id, ...overrides });
}

function emptyRules(): RulesState {
  return {
    version: 1,
    turn: { player: "alice", number: 3, phase: "main" },
    priority: "alice",
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
    pools: { alice: { energy: 0, power: {} }, bob: { energy: 1, power: {} } },
    scoredThisTurn: {},
    history: { cardsPlayedThisTurn: {} },
    manual: null,
  };
}

function strictRoom(rules: Partial<RulesState> = {}): Room {
  const room = makeRoom(makeRng(7), 2);
  const alice = room.players[0]!;
  const bob = room.players[1]!;
  alice.id = "alice";
  bob.id = "bob";
  const a = alice.board!;
  const b = bob.board!;
  for (const board of [a, b]) {
    board.base = [];
    board.trash = [];
    board.banished = [];
    board.battlefieldA = [];
    board.battlefieldB = [];
    board.battlefieldC = [];
    board.battlefieldToken = [];
    board.champion = [];
    board.legend = [];
    board.runeDeck = [];
    board.runeArea = [];
    board.handRevealToOpponent = false;
    board.handRevealedToPlayerIds = [];
    board.deckPeek = { cardIds: [], revealedCardIds: [] };
    delete board.additionalLegends;
  }
  a.hand = [card(ALICE_HAND)];
  a.deck = [card(ALICE_DECK_TOP), card(ALICE_DECK_2)];
  b.hand = [card(BOB_HAND), card(BOB_HAND_2)];
  b.deck = [card(BOB_DECK_TOP), card(BOB_DECK_2)];
  b.base = [card(BOB_UNIT)];
  b.trash = [card(BOB_TRASH)];
  b.battlefieldA = [card(BOB_FACEDOWN, { hidden: true })];
  room.chainEntries = [];
  room.rulesMode = "strict";
  room.rules = { ...emptyRules(), ...rules };
  return room;
}

const aliceView = { playerId: "alice", viewerRole: "player" as const };
const bobView = { playerId: "bob", viewerRole: "player" as const };
const plainSpectator = { playerId: null, viewerRole: "spectator" as const };

function rulesFor(room: Room, viewer: Parameters<typeof redactRoomForViewer>[1]): RulesState {
  const view = redactRoomForViewer(room, viewer);
  // The redacted value is still a RulesState (type-level check).
  const rules: RulesState = view.rules!;
  return rules;
}

function expectNoLeak(value: unknown, ids: readonly string[]): void {
  const json = JSON.stringify(value);
  for (const id of ids) expect(json).not.toContain(id);
}

/** Bob is resolving a "look at the top 2, choose one" effect (425 / 355.18 effects.resume). */
function bobResumePrompt(): RulesState["prompt"] {
  return {
    id: "prompt_1",
    kind: "choose-card",
    playerId: "bob",
    promptKey: "rules.prompt.chooseSearch",
    rule: "355.18",
    sourceItemId: "chain_1",
    options: [
      { id: BOB_DECK_TOP, cardId: BOB_DECK_TOP, label: "Singularity" },
      { id: BOB_DECK_2, cardId: BOB_DECK_2, label: "Void Seeker" },
    ],
    min: 0,
    max: 1,
    data: {
      reason: "effects.resume",
      continuation: {
        stack: [{ effect: { op: "look" } }],
        env: { itemId: "chain_1", controller: "bob", vars: { looked: [BOB_DECK_TOP, BOB_DECK_2] } },
      },
      ask: { answer: "objects" },
    },
  };
}

describe("redactRulesForViewer — rules.prompt [R128.4][R411.2]", () => {
  it("[R128.4] another player sees only that a prompt of this kind is pending for Bob", () => {
    const room = strictRoom({ prompt: bobResumePrompt() });
    const prompt = rulesFor(room, aliceView).prompt;
    expect(prompt).toEqual({
      id: "prompt_1",
      kind: "choose-card",
      playerId: "bob",
      promptKey: "rules.prompt.chooseSearch",
      rule: "355.18",
      sourceItemId: "chain_1",
      data: { reason: "effects.resume" },
    });
    expectNoLeak(rulesFor(room, aliceView), BOB_PRIVATE);
    // The authoritative room is untouched.
    expect(room.rules!.prompt!.options).toHaveLength(2);
  });

  it("[R128.4] the prompted player keeps options, bounds and data", () => {
    const room = strictRoom({ prompt: bobResumePrompt() });
    expect(rulesFor(room, bobView).prompt).toEqual(bobResumePrompt());
  });

  it("[R128.4] a plain spectator sees the pending-prompt shell only", () => {
    const room = strictRoom({ prompt: bobResumePrompt() });
    const rules = rulesFor(room, plainSpectator);
    expect(rules.prompt?.options).toBeUndefined();
    expect(rules.prompt?.data).toEqual({ reason: "effects.resume" });
    expectNoLeak(rules, [...BOB_PRIVATE, ...ALICE_PRIVATE]);
  });

  it("[R128.4] a spectator granted Bob's private view sees Bob's prompt", () => {
    const room = strictRoom({ prompt: bobResumePrompt() });
    const spectator = viewerForSpectator({
      authSubject: "sub",
      displayName: "Spec",
      joinedAt: 1,
      updatedAt: 1,
      grantedPrivatePlayerIds: ["bob"],
    });
    expect(rulesFor(room, spectator).prompt).toEqual(bobResumePrompt());
  });

  it("[R128.4] a solo viewer controlling both seats sees every prompt", () => {
    const room = strictRoom({ prompt: bobResumePrompt() });
    const solo = { ...aliceView, controlledPlayerIds: ["alice", "bob"] };
    expect(rulesFor(room, solo).prompt).toEqual(bobResumePrompt());
  });

  it("[R467.2.c] a damage-assignment prompt keeps only kind and reason for the defender", () => {
    const room = strictRoom({
      prompt: {
        id: "prompt_2",
        kind: "damage-assignment",
        playerId: "bob",
        promptKey: "rules.prompt.combatDamageAssignment",
        rule: "467.2.c",
        options: [{ id: "u1", objectId: "u1" }],
        data: {
          reason: "combat.damage_assignment",
          battlefield: "battlefieldA",
          assignerId: "bob",
          total: 3,
          targets: [{ objectId: "u1", lethal: 2, tier: 1 }],
        },
      },
    });
    expect(rulesFor(room, aliceView).prompt).toEqual({
      id: "prompt_2",
      kind: "damage-assignment",
      playerId: "bob",
      promptKey: "rules.prompt.combatDamageAssignment",
      rule: "467.2.c",
      data: { reason: "combat.damage_assignment" },
    });
  });

  it("[R425][R128.4] Alice looking at Bob's hand keeps her offered options; the rest of the continuation is rewritten", () => {
    const room = strictRoom({
      prompt: {
        id: "prompt_3",
        kind: "choose-card",
        playerId: "alice",
        rule: "355.18",
        options: [{ id: BOB_HAND, cardId: BOB_HAND }],
        min: 1,
        max: 1,
        data: {
          reason: "effects.resume",
          continuation: {
            stack: [],
            env: { controller: "alice", vars: { looked: [BOB_HAND], other: BOB_HAND_2 } },
          },
        },
      },
    });
    const prompt = rulesFor(room, aliceView).prompt!;
    expect(prompt.options).toEqual([{ id: BOB_HAND, cardId: BOB_HAND }]);
    const env = (prompt.data!.continuation as { env: { vars: Record<string, unknown> } }).env;
    expect(env.vars.looked).toEqual([BOB_HAND]);
    expect(env.vars.other).toBe(hiddenZoneCardId({ playerId: "bob", zone: "hand", index: 1 }));
  });
});

describe("redactRulesForViewer — rules.chain [R108.1.b][R811][R422.4]", () => {
  function hiddenChainRoom(revealed: Partial<CardInstance> = {}): Room {
    const snapshot = card("setup-bob-mainDeck-9-ogn-zhonyas-hourglass", {
      hidden: true,
      ...revealed,
    });
    const room = strictRoom({
      chain: [
        {
          id: "chain_public",
          kind: "card",
          status: "finalized",
          controller: "alice",
          cardName: "Rebuke",
          choices: { "target:0": BOB_UNIT },
          origin: "play",
          cardSnapshot: card("setup-alice-mainDeck-7-ogn-rebuke"),
        },
        {
          id: "chain_hidden",
          kind: "card",
          status: "pending",
          controller: "bob",
          cardName: "Zhonya's Hourglass",
          cardCode: "OGN-999",
          abilityRef: "spell",
          choices: { "target:0": BOB_UNIT },
          paid: { energy: 0, discarded: [BOB_TRASH] },
          origin: "play",
          fromZone: "battlefieldA",
          playedFromFacedown: "battlefieldA",
          cardSnapshot: snapshot,
          addedAt: 5,
        },
      ],
    });
    room.chainEntries = [
      {
        id: "chain_hidden",
        card: snapshot,
        addedAt: 5,
        fromZone: "battlefieldA",
        byPlayerId: "bob",
        byPlayerName: "Bob",
      },
    ];
    return room;
  }

  it("[R108.1.b] public chain items are unchanged for every viewer", () => {
    const room = hiddenChainRoom();
    expect(rulesFor(room, aliceView).chain[0]).toEqual(room.rules!.chain[0]);
    expect(rulesFor(room, plainSpectator).chain[0]).toEqual(room.rules!.chain[0]);
  });

  it("[R811][R128.4] an unrevealed facedown card on the chain keeps only its timing facts", () => {
    const room = hiddenChainRoom();
    const view = redactRoomForViewer(room, aliceView);
    const item = view.rules!.chain[1]!;
    const placeholder = hiddenZoneCardId({ playerId: "bob", zone: "chain", index: 0 });
    expect(item).toEqual({
      id: "chain_hidden",
      kind: "card",
      status: "pending",
      controller: "bob",
      origin: "play",
      choices: {},
      fromZone: "battlefieldA",
      playedFromFacedown: "battlefieldA",
      addedAt: 5,
      cardSnapshot: expect.objectContaining({ id: placeholder, isPlaceholder: true }),
    });
    // Same placeholder as the chainEntries display projection.
    expect(view.chainEntries[0]!.card.id).toBe(placeholder);
    expectNoLeak(view.rules, ["zhonyas", "Zhonya", "OGN-999", BOB_TRASH]);
  });

  it("[R811] the controller and revealed viewers see the item in full", () => {
    const room = hiddenChainRoom();
    expect(rulesFor(room, bobView).chain[1]).toEqual(room.rules!.chain[1]);
    const revealed = hiddenChainRoom({ revealedToPlayerIds: ["alice"] });
    expect(rulesFor(revealed, aliceView).chain[1]).toEqual(revealed.rules!.chain[1]);
  });
});

describe("redactRulesForViewer — rules.objects [R107.3.f][R128.4]", () => {
  it("[R107.3.f] drops object state of facedown cards and private-zone cards for other viewers", () => {
    const room = strictRoom({
      objects: {
        [BOB_FACEDOWN]: { hiddenTurn: 2, hiddenBy: "bob" },
        [BOB_HAND]: { counters: { charge: 1 } },
        [BOB_UNIT]: { damage: 1, buffs: 1 },
        battlefieldA: { controller: "bob" },
      },
    });
    const alice = rulesFor(room, aliceView);
    expect(Object.keys(alice.objects).sort()).toEqual([BOB_UNIT, "battlefieldA"].sort());
    expect(rulesFor(room, plainSpectator).objects[BOB_FACEDOWN]).toBeUndefined();
    expect(rulesFor(room, bobView).objects).toEqual(room.rules!.objects);
  });

  it("[R107.3.f] a revealed hand card is public, so its object state stays", () => {
    const room = strictRoom({ objects: { [BOB_HAND]: { counters: { charge: 1 } } } });
    room.players[1]!.board!.hand[0]!.revealedToOpponent = true;
    expect(rulesFor(room, aliceView).objects[BOB_HAND]).toEqual({ counters: { charge: 1 } });
  });
});

describe("redactRulesForViewer — auto-pass preferences (docs/rules/auto-pass.md)", () => {
  it("each seat sees only its own auto-pass preferences", () => {
    const alicePrefs = { ownItems: true, responses: "safe", forcedPrompts: "safe", endTurn: "safe", hold: false } as const;
    const bobPrefs = { ownItems: true, responses: "no_response", forcedPrompts: "all", endTurn: "no_action", hold: false } as const;
    const room = strictRoom({ autoPass: { alice: { ...alicePrefs }, bob: { ...bobPrefs } } });
    expect(rulesFor(room, aliceView).autoPass).toEqual({ alice: alicePrefs });
    expect(rulesFor(room, bobView).autoPass).toEqual({ bob: bobPrefs });
    expect(rulesFor(room, plainSpectator).autoPass).toEqual({});
    // Rooms without preferences stay byte-for-byte as before.
    expect(rulesFor(strictRoom(), aliceView)).not.toHaveProperty("autoPass");
  });
});

describe("redactRulesForViewer — history, marks, triggers [R425][R437][R128.4]", () => {
  it("[R437] prompt answers of other players are removed", () => {
    const room = strictRoom({
      history: {
        cardsPlayedThisTurn: { bob: 1 },
        promptAnswers: [
          { promptId: "p1", playerId: "bob", answer: { optionIds: [BOB_DECK_TOP] } },
          { promptId: "p2", playerId: "alice", answer: { zone: "battlefieldA" } },
        ],
      },
    });
    expect(rulesFor(room, aliceView).history.promptAnswers).toEqual([
      { promptId: "p2", playerId: "alice", answer: { zone: "battlefieldA" } },
    ]);
    expect(rulesFor(room, bobView).history.promptAnswers).toEqual([
      { promptId: "p1", playerId: "bob", answer: { optionIds: [BOB_DECK_TOP] } },
    ]);
    expect(rulesFor(room, plainSpectator).history.promptAnswers).toEqual([]);
  });

  it("[R425] effect marks holding a looked-at card id are rewritten to the board placeholder", () => {
    const room = strictRoom({
      history: {
        cardsPlayedThisTurn: {},
        effects: { marks: { "chain_1:looked": [BOB_DECK_TOP], "chain_1:mode": "draw" } },
        activationsThisTurn: { [`${BOB_HAND}::activated:0`]: 1 },
      },
    });
    const rules = rulesFor(room, aliceView);
    const placeholder = hiddenZoneCardId({ playerId: "bob", zone: "deck", index: 0 });
    expect(rules.history.effects?.marks).toEqual({
      "chain_1:looked": [placeholder],
      "chain_1:mode": "draw",
    });
    expect(Object.keys(rules.history.activationsThisTurn ?? {})).toEqual([
      `${hiddenZoneCardId({ playerId: "bob", zone: "hand", index: 0 })}::activated:0`,
    ]);
    // Bob still sees his own ids.
    expect(rulesFor(room, bobView).history.effects?.marks?.["chain_1:looked"]).toEqual([
      BOB_DECK_TOP,
    ]);
  });

  it("[R414][R128.4] a pending draw trigger keeps the event but not the drawn card's id or name", () => {
    const room = strictRoom({
      triggers: [
        {
          id: "t1",
          controller: "bob",
          sourceObjectId: BOB_UNIT,
          sourceName: "Noxus Hopeful",
          event: {
            type: "draw",
            playerId: "bob",
            cardId: BOB_HAND,
            cardName: "Viktor, Leader",
            data: { cardIds: [BOB_HAND] },
          },
        },
      ],
    });
    const trigger = rulesFor(room, aliceView).triggers[0]!;
    const placeholder = hiddenZoneCardId({ playerId: "bob", zone: "hand", index: 0 });
    expect(trigger.sourceName).toBe("Noxus Hopeful");
    expect(trigger.event).toEqual({
      type: "draw",
      playerId: "bob",
      cardId: placeholder,
      data: { cardIds: [placeholder] },
    });
    expect(rulesFor(room, bobView).triggers[0]).toEqual(room.rules!.triggers[0]);
  });

  it("[R128.4] no private id of the other seat survives anywhere in the rules state", () => {
    const room = strictRoom({
      prompt: bobResumePrompt(),
      tasks: [{ id: "task_1", kind: "custom", playerId: "bob", data: { cards: [BOB_HAND] } }],
      effects: [
        {
          id: "e1",
          controller: "bob",
          duration: "this-turn",
          modifier: { kind: "might", amount: 1, target: { ids: [BOB_HAND_2] } } as never,
        },
      ],
      objects: { [BOB_FACEDOWN]: { hiddenTurn: 2 }, [ALICE_HAND]: { counters: { x: 1 } } },
    });
    expectNoLeak(rulesFor(room, aliceView), BOB_PRIVATE);
    expectNoLeak(rulesFor(room, bobView), ALICE_PRIVATE);
    expectNoLeak(rulesFor(room, plainSpectator), [...BOB_PRIVATE, ...ALICE_PRIVATE]);
  });

  it("leaves sandbox rooms (no rules) byte-for-byte as before", () => {
    const room = strictRoom();
    delete room.rules;
    delete room.rulesMode;
    const view = redactRoomForViewer(room, aliceView);
    expect(view.rules).toBeUndefined();
    expect("rules" in view).toBe(false);
  });
});

describe("diffRuntimeStateForViewer — patches never carry redacted rules fields", () => {
  it("[R128.4] a resolved prompt patch for Alice contains no private id, and round-trips", () => {
    const before = strictRoom({ prompt: bobResumePrompt() });
    const after = structuredClone(before);
    // Bob picks the top card: it moves to his hand; the prompt clears; his answer is recorded.
    const bob = after.players[1]!.board!;
    const [picked] = bob.deck.splice(0, 1);
    bob.hand.push(picked!);
    after.rules!.prompt = null;
    after.rules!.history.promptAnswers = [
      { promptId: "prompt_1", playerId: "bob", answer: { optionIds: [BOB_DECK_TOP] } },
    ];
    after.rules!.history.effects = { marks: { picked: BOB_DECK_TOP } };

    for (const viewer of [aliceView, plainSpectator]) {
      const patch = diffRuntimeStateForViewer({ room: before }, { room: after }, viewer);
      expectNoLeak(patch, [...BOB_PRIVATE, "Singularity", "Void Seeker", "continuation"]);
      const previous = redactRoomForViewer(before, viewer);
      const applied = applyRuntimePatch(
        { room: previous, sequence: 1, gameplayLogEntries: [] },
        patch,
      );
      expect(applied.room).toEqual(redactRoomForViewer(after, viewer));
    }
    // Bob's own patch carries his answer.
    const bobPatch = diffRuntimeStateForViewer({ room: before }, { room: after }, bobView);
    expect(JSON.stringify(bobPatch)).toContain(BOB_DECK_TOP);
  });

  it("[R128.4] opening a prompt sends the shell to others and the full prompt to the chooser", () => {
    const before = strictRoom();
    const after = strictRoom({ prompt: bobResumePrompt() });
    const alicePatch = diffRuntimeStateForViewer({ room: before }, { room: after }, aliceView);
    expectNoLeak(alicePatch, BOB_PRIVATE);
    const bobPatch = diffRuntimeStateForViewer({ room: before }, { room: after }, bobView);
    expect(JSON.stringify(bobPatch)).toContain(BOB_DECK_TOP);
    // An unredacted diff would leak (the reason this helper exists).
    expect(JSON.stringify(diffRuntimeState({ room: before }, { room: after }))).toContain(
      BOB_DECK_TOP,
    );
  });
});
