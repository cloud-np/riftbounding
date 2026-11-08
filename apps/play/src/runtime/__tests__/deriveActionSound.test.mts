import { describe, expect, it } from "vitest";
import type { PlayerBoard, Room } from "@rift/protocol";
import {
  GAME_START_SOUND,
  clampScore,
  deriveActionSound,
  deriveBaronPitSound,
  deriveScoreSound,
  deriveTurnStartSound,
  isScoreActionType,
} from "../deriveActionSound";

function board(extra: Partial<PlayerBoard> = {}): PlayerBoard {
  return {
    score: 0,
    floatingEnergy: 0,
    floatingPower: 0,
    deck: [],
    hand: [],
    handRevealToOpponent: false,
    base: [],
    trash: [],
    banished: [],
    battlefieldA: [],
    battlefieldB: [],
    battlefieldToken: [],
    champion: [],
    legend: [],
    runeDeck: [],
    runeArea: [],
    deckPeek: { cardIds: [], revealedCardIds: [] },
    ...extra,
  };
}

function room(extra: Partial<Room> = {}): Room {
  return {
    roomCode: "AB12CD",
    createdAt: 0,
    updatedAt: 0,
    phase: "in_game",
    players: [
      { id: "p1", seat: 0, name: "p1", joinedAt: 0, board: board() },
      { id: "p2", seat: 1, name: "p2", joinedAt: 0, board: board() },
    ],
    log: [],
    chainEntries: [],
    chainResolveVotes: [],
    ...extra,
  };
}

const ctx = (extra: Partial<Parameters<typeof deriveActionSound>[1]> = {}) => ({
  actorPlayerId: "p1",
  boardBefore: board(),
  roomBefore: room(),
  victoryScore: 8,
  ...extra,
});

describe("deriveActionSound — trigger table (0xawjzm3yjpr1.js ~53800)", () => {
  it("draws and deck-to-hand take the card_draw sound", () => {
    expect(
      deriveActionSound({ type: "draw_cards" }, ctx({ boardBefore: board({ deck: [card()] }) })),
    ).toBe("card_draw");
    expect(
      deriveActionSound({ type: "draw_cards" }, ctx({ boardBefore: board({ deck: [] }) })),
    ).toBeNull();
    expect(
      deriveActionSound(
        { type: "draw_cards", to: "trash" },
        ctx({ boardBefore: board({ deck: [card()] }) }),
      ),
    ).toBe("card_discard");
    expect(
      deriveActionSound({ type: "draw_rune" }, ctx({ boardBefore: board({ runeDeck: [rune()] }) })),
    ).toBe("card_draw");
    expect(
      deriveActionSound({ type: "draw_rune" }, ctx({ boardBefore: board({ runeDeck: [] }) })),
    ).toBeNull();
    expect(deriveActionSound({ type: "take_top_from_deck", to: "hand" }, ctx())).toBe("card_draw");
    expect(deriveActionSound({ type: "take_card_from_deck", cardId: "c", to: "base" }, ctx())).toBe(
      "card_play",
    );
  });

  it("trash/discard paths", () => {
    expect(
      deriveActionSound({ type: "move_card", from: "base", to: "trash", cardId: "c" }, ctx()),
    ).toBe("card_discard");
    expect(
      deriveActionSound({ type: "move_cards_to_trash_batch", from: "base", cardIds: ["c"] }, ctx()),
    ).toBe("card_discard");
    expect(
      deriveActionSound({ type: "move_cards_to_trash_batch", from: "base", cardIds: [] }, ctx()),
    ).toBeNull();
    expect(deriveActionSound({ type: "chain_resolve", entryId: "e", to: "banished" }, ctx())).toBe(
      "card_discard",
    );
    expect(
      deriveActionSound(
        { type: "move_off_board_cards_batch", from: "base", to: "trash", cardIds: ["c"] },
        ctx(),
      ),
    ).toBe("card_discard");
  });

  it("play from hand vs board play", () => {
    expect(
      deriveActionSound({ type: "move_card", from: "hand", to: "base", cardId: "c" }, ctx()),
    ).toBe("card_play_from_hand");
    expect(
      deriveActionSound(
        { type: "move_card", from: "base", to: "battlefieldA", cardId: "c" },
        ctx(),
      ),
    ).toBe("card_play");
    expect(
      deriveActionSound({ type: "move_card", from: "hand", to: "hand", cardId: "c" }, ctx()),
    ).toBeNull();
    expect(deriveActionSound({ type: "chain_add", from: "hand", cardId: "c" }, ctx())).toBe(
      "card_play_from_hand",
    );
    expect(deriveActionSound({ type: "chain_add", from: "base", cardId: "c" }, ctx())).toBe(
      "card_play",
    );
    expect(deriveActionSound({ type: "create_token", zone: "base", name: "Recruit" }, ctx())).toBe(
      "card_play",
    );
    expect(deriveActionSound({ type: "duplicate_card", zone: "base", cardId: "c" }, ctx())).toBe(
      "card_play",
    );
    expect(
      deriveActionSound(
        {
          type: "dockside_play_banished",
          zone: "battlefieldA",
          cardId: "c",
          banishedCardId: "b",
          to: "base",
        },
        ctx(),
      ),
    ).toBe("card_play");
    expect(
      deriveActionSound(
        {
          type: "kharox_play_from_trash",
          zone: "battlefieldA",
          cardId: "c",
          targetPlayerId: "p2",
          trashCardId: "t",
          to: "base",
        },
        ctx(),
      ),
    ).toBe("card_play");
  });

  it("recycle paths", () => {
    expect(
      deriveActionSound(
        { type: "send_to_deck", from: "base", cardId: "c", position: "top" },
        ctx(),
      ),
    ).toBe("card_recycle");
    expect(
      deriveActionSound(
        { type: "send_to_rune_deck", from: "runeArea", cardId: "c", position: "bottom" },
        ctx(),
      ),
    ).toBe("card_recycle");
    expect(deriveActionSound({ type: "recycle_all_trash_to_deck" }, ctx())).toBe("card_recycle");
    expect(deriveActionSound({ type: "send_rune_to_deck_bottom", cardId: "c" }, ctx())).toBe(
      "card_recycle",
    );
    expect(
      deriveActionSound(
        { type: "send_rune_to_deck_bottom", cardId: "c", paymentGroupOrigin: "auto_pay_button" },
        ctx(),
      ),
    ).toBeNull();
    expect(
      deriveActionSound({ type: "recycle_rune_for_floating_energy", cardId: "c" }, ctx()),
    ).toBe("card_recycle");
    expect(
      deriveActionSound(
        { type: "move_off_board_cards_batch", from: "base", to: "deck", cardIds: ["c"] },
        ctx(),
      ),
    ).toBe("card_recycle");
    expect(deriveActionSound({ type: "chain_resolve", entryId: "e", to: "deck_top" }, ctx())).toBe(
      "card_recycle",
    );
  });

  it("auto-pay and exhaustion", () => {
    expect(
      deriveActionSound(
        { type: "payment_batch", operations: [], paymentGroupOrigin: "auto_pay_button" },
        ctx(),
      ),
    ).toBe("card_autopay");
    expect(deriveActionSound({ type: "payment_batch", operations: [] }, ctx())).toBeNull();
    expect(
      deriveActionSound(
        { type: "toggle_exhausted", zone: "base", cardId: "c", expectedExhausted: false },
        ctx({ boardBefore: board({ base: [card({ id: "c" })] }) }),
      ),
    ).toBe("card_exhaust");
    expect(
      deriveActionSound(
        { type: "toggle_exhausted", zone: "base", cardId: "missing", expectedExhausted: false },
        ctx({ boardBefore: board({ base: [card({ id: "c" })] }) }),
      ),
    ).toBeNull();
    expect(
      deriveActionSound(
        {
          type: "rune_batch",
          operations: [{ type: "set_rune_exhausted", cardId: "r", exhausted: true }],
        },
        ctx(),
      ),
    ).toBe("card_exhaust");
    expect(
      deriveActionSound({ type: "rune_batch", operations: [{ type: "draw_rune" }] }, ctx()),
    ).toBe("card_draw");
    expect(
      deriveActionSound(
        { type: "rune_batch", operations: [{ type: "send_rune_to_deck_bottom", cardId: "r" }] },
        ctx(),
      ),
    ).toBe("card_recycle");
  });

  it("ui_confirm / ui_click / card_click groups", () => {
    expect(deriveActionSound({ type: "submit_mulligan", cardIds: [] }, ctx())).toBe("ui_confirm");
    expect(
      deriveActionSound(
        { type: "submit_sideboard", champion: [], mainDeck: [], sideboard: [] },
        ctx(),
      ),
    ).toBe("ui_confirm");
    expect(deriveActionSound({ type: "report_game_result", winnerPlayerId: "p1" }, ctx())).toBe(
      "ui_confirm",
    );
    expect(deriveActionSound({ type: "request_bo3_rematch" }, ctx())).toBe("ui_confirm");
    expect(deriveActionSound({ type: "choose_first_player", firstPlayerId: "p1" }, ctx())).toBe(
      "ui_click",
    );
    expect(deriveActionSound({ type: "roll_initiative" }, ctx())).toBe("ui_click");
    expect(deriveActionSound({ type: "chain_resolve", entryId: "e" }, ctx())).toBe("ui_click");
    expect(deriveActionSound({ type: "select_battlefield", random: true }, ctx())).toBe(
      "card_click",
    );
    expect(
      deriveActionSound({ type: "adjust_card_might", zone: "base", cardId: "c", delta: 1 }, ctx()),
    ).toBe("card_click");
    expect(
      deriveActionSound(
        { type: "set_card_label", zone: "base", cardId: "c", slot: 0, label: "Buff" },
        ctx(),
      ),
    ).toBe("card_click");
    expect(deriveActionSound({ type: "target_arrow_clear_all" }, ctx())).toBe("card_click");
  });

  it("rewind/forward", () => {
    expect(deriveActionSound({ type: "rewind_last_action" }, ctx())).toBe("game_rewind");
    expect(deriveActionSound({ type: "forward_last_rewind" }, ctx())).toBe("game_forward");
  });

  it("score sounds", () => {
    expect(
      deriveActionSound(
        { type: "adjust_score", delta: 1 },
        ctx({ boardBefore: board({ score: 2 }) }),
      ),
    ).toBe("score_generic");
    expect(
      deriveActionSound(
        { type: "adjust_score", delta: -1 },
        ctx({ boardBefore: board({ score: 2 }) }),
      ),
    ).toBeNull();
    expect(
      deriveActionSound(
        { type: "adjust_score", delta: 1 },
        ctx({ boardBefore: board({ score: 7 }), victoryScore: 8 }),
      ),
    ).toBe("score_end");
    expect(
      deriveActionSound({ type: "set_score", score: 3 }, ctx({ boardBefore: board({ score: 0 }) })),
    ).toBe("score_generic");
    expect(
      deriveActionSound(
        { type: "end_turn", observed: { turnNumber: 1, activePlayerId: "p1", activeStep: "main" } },
        ctx({ boardBefore: board({ score: 3 }) }),
      ),
    ).toBeNull();
  });

  it("conquer sounds", () => {
    const conquerRoom = room({
      pendingBattlefieldConquerAssist: {
        zone: "battlefieldA",
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        stage: "attacker_confirm_conquer",
      },
    });
    expect(
      deriveActionSound(
        { type: "battlefield_conquer_confirm", zone: "battlefieldA" },
        ctx({ roomBefore: conquerRoom, boardBefore: board({ score: 0 }) }),
      ),
    ).toBe("score_conquer");
    expect(
      deriveActionSound(
        { type: "battlefield_conquer_confirm", zone: "battlefieldA" },
        ctx({ roomBefore: conquerRoom, boardBefore: board({ score: 7 }) }),
      ),
    ).toBe("card_draw");
    expect(
      deriveActionSound(
        { type: "battlefield_conquer_confirm", zone: "battlefieldA" },
        ctx({
          roomBefore: conquerRoom,
          boardBefore: board({ score: 0 }),
          conquerReward: { gainPoint: false, drawCard: true },
        }),
      ),
    ).toBe("card_draw");
  });
});

describe("score sound helper (rf)", () => {
  it("selects end/conquer/generic/hold", () => {
    expect(
      deriveScoreSound({
        actionType: "adjust_score",
        previousScore: 0,
        nextScore: 1,
        victoryScore: 8,
      }),
    ).toBe("score_generic");
    expect(
      deriveScoreSound({
        actionType: "battlefield_conquer_confirm",
        previousScore: 0,
        nextScore: 1,
        victoryScore: 8,
      }),
    ).toBe("score_conquer");
    expect(
      deriveScoreSound({ actionType: "end_turn", previousScore: 0, nextScore: 1, victoryScore: 8 }),
    ).toBe("score_hold");
    expect(
      deriveScoreSound({
        actionType: "end_beginning_phase",
        previousScore: 7,
        nextScore: 8,
        victoryScore: 8,
      }),
    ).toBe("score_end");
    expect(
      deriveScoreSound({ actionType: "end_turn", previousScore: 3, nextScore: 3, victoryScore: 8 }),
    ).toBeNull();
  });

  it("clamps scores", () => {
    expect(clampScore(150)).toBe(99);
    expect(clampScore(-150)).toBe(-99);
    expect(clampScore(Number.NaN)).toBe(0);
  });
});

describe("snapshot-driven sounds", () => {
  it("turn start vs time warp", () => {
    const previous = room({ turnNumber: 3 });
    expect(deriveTurnStartSound(previous, room({ turnNumber: 4 }))).toBe("turn_start");
    expect(
      deriveTurnStartSound(previous, room({ turnNumber: 4, extraTurnResumePlayerId: "p2" })),
    ).toBe("time_warp");
    expect(deriveTurnStartSound(previous, room({ turnNumber: 3 }))).toBeNull();
    expect(deriveTurnStartSound(null, room({ turnNumber: 4 }))).toBeNull();
  });

  it("baron pit activation", () => {
    expect(
      deriveBaronPitSound(
        room(),
        room({
          sharedBattlefieldToken: {
            kind: "baron_pit",
            zone: "battlefieldToken",
            title: "Baron Pit",
            active: true,
          },
        }),
      ),
    ).toBe("baron_nashor");
    expect(
      deriveBaronPitSound(
        room({
          sharedBattlefieldToken: {
            kind: "baron_pit",
            zone: "battlefieldToken",
            title: "Baron Pit",
            active: true,
          },
        }),
        room({
          sharedBattlefieldToken: {
            kind: "baron_pit",
            zone: "battlefieldToken",
            title: "Baron Pit",
            active: true,
          },
        }),
      ),
    ).toBeNull();
  });

  it("exposes the game start sound and score action set", () => {
    expect(GAME_START_SOUND).toBe("game_start");
    expect(isScoreActionType("adjust_score")).toBe(true);
    expect(isScoreActionType("draw_cards")).toBe(false);
  });
});

function card(extra: { id?: string } = {}) {
  return {
    id: extra.id ?? "c",
    name: "Card",
    source: "mainDeck" as const,
    exhausted: false,
    createdAt: 0,
  };
}

function rune() {
  return { id: "r", name: "Rune", source: "rune" as const, exhausted: false, createdAt: 0 };
}
