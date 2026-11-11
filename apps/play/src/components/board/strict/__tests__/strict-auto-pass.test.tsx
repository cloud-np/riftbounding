/**
 * Strict auto-pass on the board (docs/rules/auto-pass.md): the settings panel for the viewer's
 * own seat, the leak warning, "pass until …" intents, notices for automatic actions, the
 * "yes to all" / default-order prompt controls and the response banner's Shift+W button.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { applyGameAction } from "@rift/engine";
import { createTranslator } from "@rift/i18n";
import type { GameplayLogEntry, Prompt, Room } from "@rift/protocol";
import { redactRoomForViewer } from "@rift/sync";

import { BoardInteractionProvider } from "@/components/board/interaction";
import { GameBoardView } from "@/components/board/layout/GameBoardView";
import { StrictAutoPassPanel } from "../StrictAutoPassPanel";
import { StrictPromptDialog } from "../StrictPromptDialog";
import { StrictPromptHost } from "../StrictPromptHost";
import {
  activePassUntil,
  autoNotices,
  autoPassSeat,
  passUntilIntent,
  prefsLeak,
  promptAllowsSimilar,
} from "../strict-auto-pass";
import { chooseIntent } from "../strict-model";
import { autoPassMode, fastModeUpdate, isBotGame } from "../strict-auto-pass";

import { placeUnit } from "../../../../../../../packages/rules/test/rules/combat/helpers";
import { scenario } from "../../../../../../../packages/rules/test/scenarios/dsl";

const noop = () => undefined;
const t = createTranslator("en");

function viewFor(room: Room, viewerId: string): Room {
  return redactRoomForViewer(room, { playerId: viewerId, viewerRole: "player", controlledPlayerIds: [viewerId] });
}

function withPrefs(room: Room, ctx: ReturnType<typeof scenario>["ctx"], playerId: string, prefs: Record<string, unknown>): Room {
  const result = applyGameAction(room, playerId, { type: "rules_set_auto_pass", prefs }, ctx);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function defaultsRoom() {
  const s = scenario();
  let room = withPrefs(s.room, s.ctx, "p1", { ownItems: true, responses: "safe", forcedPrompts: "safe", endTurn: "manual" });
  room = withPrefs(room, s.ctx, "p2", { ownItems: true, responses: "safe", forcedPrompts: "safe", endTurn: "manual" });
  return { s, room };
}

function renderPanel(room: Room, viewerId: string, defaultOpen = true): string {
  return renderToStaticMarkup(
    createElement(StrictAutoPassPanel, {
      state: room,
      viewerId,
      controlledPlayerIds: [viewerId],
      dispatch: noop,
      defaultOpen,
    }),
  );
}

describe("strict auto-pass client model", () => {
  it("acts for the deciding controlled seat, else the viewer", () => {
    const { room } = defaultsRoom();
    expect(room.rules?.priority).toBe("p1");
    expect(autoPassSeat(room, "p1", ["p1", "p2"])).toBe("p1");
    expect(autoPassSeat(room, "p2", ["p2"])).toBe("p2");
  });

  it("pass until …: sets the current turn, and the same kind again cancels", () => {
    const { room, s } = defaultsRoom();
    const prefs = room.rules!.autoPass!.p2!;
    const set = passUntilIntent(room, prefs, "end_of_turn");
    expect(set).toEqual({ type: "rules_set_auto_pass", prefs: { passUntil: { kind: "end_of_turn", turn: 1 } } });
    const next = withPrefs(room, s.ctx, "p2", (set as { prefs: Record<string, unknown> }).prefs);
    const nextPrefs = next.rules!.autoPass!.p2!;
    expect(activePassUntil(next, nextPrefs)).toBe("end_of_turn");
    expect(passUntilIntent(next, nextPrefs, "end_of_turn")).toEqual({ type: "rules_set_auto_pass", prefs: { passUntil: null } });
  });

  it("flags the options that can reveal hand information", () => {
    const base = { ownItems: true, responses: "safe", forcedPrompts: "safe", endTurn: "safe", hold: false } as const;
    expect(prefsLeak(base)).toBe(false);
    expect(prefsLeak({ ...base, responses: "no_response" })).toBe(true);
    expect(prefsLeak({ ...base, forcedPrompts: "all" })).toBe(true);
    expect(prefsLeak({ ...base, endTurn: "no_action" })).toBe(true);
  });

  it("turns rules.auto.* log entries into translated notices and ignores the rest", () => {
    const entries = [
      { id: "l1", at: 1, text: "Bob auto-passed (×2)", key: "rules.auto.pass", params: { player: "Bob", count: 2 }, authorPlayerId: "p2" },
      { id: "l2", at: 2, text: "Alice drew a card" },
      { id: "l3", at: 3, text: "x", key: "rules.auto.endTurn", params: { player: "Alice", count: 1 } },
    ] as GameplayLogEntry[];
    expect(autoNotices(t, entries)).toEqual([
      { id: "l1", key: "rules.auto.pass", text: "Bob auto-passed (×2)", playerId: "p2" },
      { id: "l3", key: "rules.auto.endTurn", text: "Alice's turn was ended automatically", playerId: null },
    ]);
  });

  it("offers \"yes to all\" only for yes/no and order prompts, and sends applyToSimilar", () => {
    const yesNo: Prompt = { id: "p", kind: "yes-no", playerId: "p1", options: [{ id: "yes" }, { id: "no" }] };
    const target: Prompt = { id: "q", kind: "choose-target", playerId: "p1", options: [{ id: "a" }] };
    expect(promptAllowsSimilar(yesNo)).toBe(true);
    expect(promptAllowsSimilar({ ...yesNo, kind: "order" })).toBe(true);
    expect(promptAllowsSimilar(target)).toBe(false);
    expect(chooseIntent(yesNo, { optionIds: ["yes"] }, true)).toEqual({
      type: "rules_choose",
      promptId: "p",
      answer: { optionIds: ["yes"] },
      applyToSimilar: true,
    });
    expect(chooseIntent(yesNo, { optionIds: ["yes"] })).not.toHaveProperty("applyToSimilar");
  });
});

describe("StrictAutoPassPanel", () => {
  it("shows the viewer's own settings with the safe defaults selected and no leak warning", () => {
    const { room } = defaultsRoom();
    const html = renderPanel(viewFor(room, "p2"), "p2");
    expect(html).toContain('data-testid="strict-auto-pass-settings"');
    expect(html).toContain('data-auto-pass-seat="p2"');
    expect(html).toMatch(/data-testid="strict-auto-pass-responses".*?aria-pressed="true" data-auto-pass-choice="safe"/su);
    expect(html).not.toContain('data-testid="strict-auto-pass-leak-warning"');
    expect(html).toContain("Pass until end of turn");
    expect(html).toContain("Pass until the opponent acts");
  });

  it("warns when a leaky option is on, and shows an active override in the pill", () => {
    const { room, s } = defaultsRoom();
    const leaky = withPrefs(room, s.ctx, "p2", { responses: "no_response", passUntil: { kind: "opponent_action", turn: 1 } });
    const html = renderPanel(viewFor(leaky, "p2"), "p2");
    expect(html).toContain('data-testid="strict-auto-pass-leak-warning"');
    expect(html).toContain('data-auto-pass-until="opponent_action"');
    expect(html).toContain("Passing until the opponent acts");
    expect(html).toContain("Stop passing");
  });

  it("a room without preferences (pre-auto-pass) shows the manual base the server merges into", () => {
    const s = scenario();
    expect(s.room.rules?.autoPass).toBeUndefined();
    const html = renderPanel(viewFor(s.room, "p1"), "p1");
    expect(html).toMatch(/data-testid="strict-auto-pass-responses".*?aria-pressed="true" data-auto-pass-choice="stop"/su);
    expect(html).toContain('data-testid="strict-auto-pass-until-eot"');
  });

  it("Fast mode switch: off with the safe defaults, PvP hint, collapsed Advanced section", () => {
    const { room } = defaultsRoom();
    const html = renderPanel(viewFor(room, "p2"), "p2");
    expect(html).toMatch(/data-testid="strict-auto-pass-fast" data-auto-pass-mode="safe"/);
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"[^>]*data-testid="strict-auto-pass-fast-switch"/);
    expect(html).toContain("Your opponent can tell from the instant pass that you had none.");
    expect(html).toContain('data-testid="strict-auto-pass-advanced"');
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).not.toContain('data-testid="strict-auto-pass-custom"');
  });

  it("Fast mode switch: on for fast prefs, bot hint in bot games, Custom when the values mix", () => {
    const { room, s } = defaultsRoom();
    const fast = withPrefs(room, s.ctx, "p2", { responses: "no_response", forcedPrompts: "all" });
    expect(renderPanel(viewFor(fast, "p2"), "p2")).toMatch(/data-auto-pass-mode="fast"/);
    const botRoom = structuredClone(fast);
    botRoom.players[0]!.isBot = true;
    const botHtml = renderPanel(viewFor(botRoom, "p2"), "p2");
    expect(botHtml).toContain("On by default — there&#x27;s no opponent to read your timing.");
    const custom = withPrefs(room, s.ctx, "p2", { responses: "no_response" });
    const customHtml = renderPanel(viewFor(custom, "p2"), "p2");
    expect(customHtml).toMatch(/data-auto-pass-mode="custom"/);
    expect(customHtml).toContain('data-testid="strict-auto-pass-custom"');
  });

  it("fastModeUpdate / autoPassMode map the switch to the presets", () => {
    expect(fastModeUpdate(true)).toEqual({ responses: "no_response", forcedPrompts: "all" });
    expect(fastModeUpdate(false)).toEqual({ responses: "safe", forcedPrompts: "safe" });
    expect(autoPassMode(null)).toBe("safe");
    expect(isBotGame({ players: [{ id: "a" }, { id: "b", isBot: true }] } as never)).toBe(true);
  });

  it("is absent from sandbox rooms", () => {
    const s = scenario();
    const sandbox = { ...s.room, rulesMode: "sandbox" as const };
    expect(renderPanel(sandbox, "p1")).toBe("");
  });
});

describe("prompt dialog shortcuts", () => {
  it("yes/no prompts offer \"same answer this turn\"; order prompts add Default order", () => {
    const s = scenario();
    const yesNo: Prompt = {
      id: "prompt-yes",
      kind: "yes-no",
      playerId: "p1",
      promptKey: "rules.prompt.playTrigger",
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
      min: 1,
      max: 1,
      data: { reason: "play.trigger" },
    };
    const html = renderToStaticMarkup(createElement(StrictPromptDialog, { room: s.room, prompt: yesNo, t, onAnswer: noop }));
    expect(html).toContain('data-testid="strict-prompt-similar"');
    expect(html).not.toContain('data-testid="strict-prompt-default-order"');

    const order: Prompt = {
      id: "prompt-order",
      kind: "order",
      playerId: "p1",
      promptKey: "rules.prompt.orderTriggers",
      options: [
        { id: "t1", label: "Treasure Hunter" },
        { id: "t2", label: "Treasure Hunter" },
      ],
      min: 0,
      max: 2,
      data: { reason: "effects.order_triggers" },
    };
    const orderHtml = renderToStaticMarkup(createElement(StrictPromptDialog, { room: s.room, prompt: order, t, onAnswer: noop }));
    expect(orderHtml).toContain('data-testid="strict-prompt-default-order"');
    expect(orderHtml).toContain('data-testid="strict-prompt-similar"');
  });
});

describe("response banner", () => {
  it("offers Pass (W) and Pass until end of turn (Shift+W)", () => {
    const s = scenario({ p1: { hand: ["Gust", "Defy"], energy: 3, power: { Calm: 1 } } });
    const target = placeUnit(s, "p2", "Treasure Hunter", "battlefieldA", "chain-target");
    s.as("p1").play("Gust", { hold: true, choices: { "target:0": target.id } }).expectOk();
    expect(s.room.rules?.priority).toBe("p1");
    const room = viewFor(s.room, "p1");
    const props = { state: room, viewerId: "p1", controlledPlayerIds: ["p1"], dispatch: noop, mode: "multiplayer" as const };
    const html = renderToStaticMarkup(
      createElement(BoardInteractionProvider, {
        ...props,
        children: createElement(GameBoardView, {
          state: room,
          viewerId: "p1",
          layoutHints: { showScoreTrack: true, connectedPlayerIds: ["p1", "p2"] },
          slots: { prompts: createElement(StrictPromptHost, props) },
        }),
      }),
    );
    expect(html).toContain('data-testid="strict-response-pass"');
    expect(html).toContain('data-testid="strict-response-pass-until-eot"');
  });
});
