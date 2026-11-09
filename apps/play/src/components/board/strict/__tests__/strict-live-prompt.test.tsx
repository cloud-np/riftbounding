/**
 * Live strict prompt/banner/chain/seat presentation built from a real engine room:
 * Azir's legend plays a Sand Soldier token, the granted Weaponmaster trigger opens the
 * choose-target prompt, and the board is rendered from the human's per-viewer redacted snapshot.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Prompt, Room } from "@rift/protocol";
import { redactRoomForViewer } from "@rift/sync";

import { BoardInteractionProvider } from "@/components/board/interaction";
import { ChainSlot } from "@/components/board/chain";
import { GameBoardView } from "@/components/board/layout/GameBoardView";

import { settle } from "../../../../../../../packages/rules/test/cards/sfd/helpers";
import { addPool, put } from "../../../../../../../packages/rules/test/rules/engine-r4/d/helpers";
import { scenario, type RulesScenario } from "../../../../../../../packages/rules/test/scenarios/dsl";

const noop = () => undefined;

function toHand(s: RulesScenario, name: string): void {
  if (!s.handCard("p1", name)) s.moveDeckCardToHand("p1", name);
}

/** Drive the optional Weaponmaster trigger to the equipment choose-target prompt. */
function stopAtTargetPrompt(s: RulesScenario): Prompt {
  for (let step = 0; step < 24; step += 1) {
    const prompt = s.room.rules?.prompt;
    if (!prompt) {
      const rules = s.room.rules;
      if (rules?.chain.length && rules.priority) {
        s.as(rules.priority).pass();
        continue;
      }
      break;
    }
    if (prompt.kind === "choose-target") return prompt;
    if (prompt.kind === "yes-no") {
      const yes = (prompt.options ?? []).find(
        (option) => option.id === "yes" || option.value === "yes",
      );
      s.as(prompt.playerId).choose({ optionIds: [yes?.id ?? prompt.options![0]!.id] });
      continue;
    }
    break;
  }
  throw new Error(`expected a choose-target prompt, got ${s.room.rules?.prompt?.kind ?? "none"}`);
}

interface LivePromptFixture {
  room: Room;
  prompt: Prompt;
  axeId: string;
  angelId: string;
  soldierId: string;
  chainEntryId: string;
}

function livePromptRoom(): LivePromptFixture {
  const s = scenario({
    extraCards: {
      p1: ["Azir, Emperor of the Sands", "Spinning Axe", "Guardian Angel", "Treasure Hunter"],
    },
  });
  toHand(s, "Spinning Axe");
  const legend = put(s, "p1", "Azir, Emperor of the Sands", "legend");
  const hunter = put(s, "p1", "Treasure Hunter", "battlefieldA");
  addPool(s, "p1", 8, { Fury: 1 });
  s.as("p1").play("Spinning Axe").expectOk();
  settle(s);
  const axe = s.findBoardCardAnywhere("Spinning Axe")!;
  // The attachment representation is the real board one: same zone behind its host.
  s.host.attach(s.room, axe.id, hunter.id);
  const angel = put(s, "p1", "Guardian Angel", "base");

  s.as("p1").apply({ type: "rules_activate", objectId: legend.id, ability: "activated:2" } as never).expectOk();
  const prompt = stopAtTargetPrompt(s);
  const soldier = s.findBoardCardAnywhere("Sand Soldier")!;
  const chainEntry = s.room.chainEntries.find((entry) => entry.card.name === "Sand Soldier");
  if (!chainEntry) throw new Error("Sand Soldier trigger is not on the chain");

  // Match the live bot-room presentation: Cloud vs the server-driven Practice Bot.
  s.room.players[0]!.name = "Cloud";
  s.room.players[1]!.name = "Practice Bot";
  s.room.players[1]!.isBot = true;

  return {
    room: s.room,
    prompt,
    axeId: axe.id,
    angelId: angel.id,
    soldierId: soldier.id,
    chainEntryId: chainEntry.id,
  };
}

function humanView(room: Room): Room {
  return redactRoomForViewer(room, {
    playerId: "p1",
    viewerRole: "player",
    controlledPlayerIds: ["p1"],
  });
}

function slotProps(room: Room) {
  return {
    state: room,
    viewerId: "p1",
    controlledPlayerIds: ["p1"],
    dispatch: noop,
    mode: "multiplayer" as const,
  };
}

function renderBoard(room: Room): string {
  const props = slotProps(room);
  return renderToStaticMarkup(
    createElement(BoardInteractionProvider, {
      ...props,
      children: createElement(GameBoardView, {
        state: room,
        viewerId: "p1",
        layoutHints: {
          showScoreTrack: true,
          connectedPlayerIds: ["p1", "p2"],
          battlefields: {
            own: { zone: "battlefieldA", name: "Training Grounds" },
            opponent: { zone: "battlefieldB", name: "Mountain Pass" },
          },
        },
        slots: { chain: createElement(ChainSlot, { ...props, embedded: true }) },
      }),
    }),
  );
}

describe("live strict board prompt (Azir Sand Soldier Weaponmaster)", () => {
  it("shows the production banner, chips and board highlights for the real prompt", () => {
    const fixture = livePromptRoom();
    const view = humanView(fixture.room);
    const html = renderBoard(view);

    expect(view.rules?.prompt?.kind).toBe("choose-target");
    expect(html).toContain('data-testid="strict-prompt-banner"');
    expect(html).toContain("Sand Soldier");
    expect(html).toContain("Choose a target");
    expect(html).toContain('data-testid="strict-prompt-chip"');
    expect(html).toContain("Spinning Axe");
    expect(html).toContain("Guardian Angel");
    expect(html).toContain(`data-attached-card-id="${fixture.axeId}"`);
    expect(html).toMatch(/(?<!\[)data-strict-prompt-option="true"/u);
    expect(((html.match(/(?<!\[)data-strict-prompt-option="true"/gu) ?? []).length)).toBeGreaterThanOrEqual(
      fixture.prompt.options?.length ?? 0,
    );
    expect(html).toContain(`data-card-id="${fixture.angelId}"`);
  });

  it("derives the chain status from strict state and renders the token with board art", () => {
    const fixture = livePromptRoom();
    const view = humanView(fixture.room);
    const html = renderToStaticMarkup(
      createElement(ChainSlot, slotProps(view)),
    );
    expect(html).toContain("Cloud must choose");
    expect(html).toContain("Choose a target");
    expect(html).not.toContain("has priority");
    expect(html).toContain("tokens/SandSoldier.webp");
    expect(html).not.toContain("placeholder.svg");
    expect(html).toContain('data-testid="chain-resolve"');
    expect(html).toMatch(
      /(?:disabled=""[^>]*data-testid="chain-resolve"|data-testid="chain-resolve"[^>]*disabled)/u,
    );
  });

  it("renders the bot seat with an avatar, presence dot and Bot clock badge", () => {
    const fixture = livePromptRoom();
    const view = humanView(fixture.room);
    const html = renderBoard(view);
    expect(html).toContain("Practice Bot");
    expect(html).toContain('data-identity-avatar="true"');
    expect(html).toContain('data-identity-avatar-bot="true"');
    expect(html).toContain('data-identity-presence="online"');
    expect(html).toContain('data-identity-bot-badge="true"');
  });

  it("keeps the sandbox board free of strict prompt UI on the same real room", () => {
    const fixture = livePromptRoom();
    const sandbox = structuredClone(fixture.room);
    sandbox.rulesMode = undefined;
    sandbox.rules = undefined;
    sandbox.chainEntries = [];
    const html = renderBoard(sandbox);
    expect(html).not.toContain('data-testid="strict-prompt-banner"');
    expect(html).not.toContain('data-strict-prompt-id="');
    expect(html).not.toMatch(/(?<!\[)data-strict-prompt-option="true"/u);
  });
});
