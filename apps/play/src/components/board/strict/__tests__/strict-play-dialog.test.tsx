import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createTranslator } from "@rift/i18n";
import type { PlayableCardDetail, Room, Verdict } from "@rift/protocol";

import { StrictPlayDialog } from "../StrictPlayDialog";

const t = createTranslator("en");
const noop = () => undefined;

function room(): Room {
  return {
    roomCode: "DIALOG",
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
          hand: [{ id: "card_1", name: "Clockwork Keeper", source: "mainDeck", exhausted: false, createdAt: 1 }],
          runeArea: [
            {
              id: "rune_1",
              name: "Fury Rune",
              source: "rune",
              exhausted: false,
              createdAt: 1,
              domains: ["Fury"],
            },
          ],
        },
      },
      { id: "p2", seat: 1, name: "Bob", joinedAt: 1 },
    ],
    log: [],
    chainEntries: [],
    chainResolveVotes: [],
    rulesMode: "strict",
  } as unknown as Room;
}

const detail: PlayableCardDetail = {
  cardId: "card_1",
  locations: ["base", "battlefieldA"],
  optionalCosts: ["optional:0"],
  cost: { energy: 2, power: 0 },
};

function dialog(overrides: {
  explain?: (intent: unknown) => Verdict;
  initialHide?: boolean;
  hideLocations?: string[];
} = {}) {
  return renderToStaticMarkup(
    createElement(StrictPlayDialog, {
      room: room(),
      actorId: "p1",
      cardId: "card_1",
      detail,
      hideLocations: overrides.hideLocations ?? ["battlefieldA"],
      t,
      initialHide: overrides.initialHide ?? false,
      explain: overrides.explain ?? (() => ({ ok: true })),
      onIntent: noop,
      onClose: noop,
    }),
  );
}

describe("StrictPlayDialog (R4-strict-ui)", () => {
  it("[R355.1.a][R356] renders cost, optional costs, Location and payment-plan controls", () => {
    const html = dialog();
    expect(html).toContain('data-testid="strict-play-dialog"');
    expect(html).toContain("Cost: 2 Energy · 0 Power");
    expect(html).toContain('data-testid="strict-optional-costs"');
    expect(html).toContain('data-strict-optional-cost="optional:0"');
    expect(html).toContain('data-testid="strict-payment-auto"');
    expect(html).toContain('data-testid="strict-payment-manual"');
    expect(html).toContain('data-strict-location="base"');
    expect(html).toContain('data-strict-location="battlefieldA"');
    expect(html).not.toContain('data-testid="strict-play-rejection"');
    expect(html).toContain('data-testid="strict-play-confirm"');
  });

  it("[R811.1.b] shows the Hide switch when legalIntents.hideable offers a battlefield", () => {
    const html = dialog();
    expect(html).toContain('data-testid="strict-mode-hide"');
    expect(html).toContain('data-testid="strict-mode-play"');
    expect(html).toContain("Hide");
  });

  it("[R357] a rejected plan shows the engine code + rule and disables Play", () => {
    const html = dialog({
      explain: () => ({ ok: false, code: "invalid_payment", rule: "357" }),
    });
    expect(html).toContain('data-testid="strict-play-rejection"');
    expect(html).toContain('data-strict-code="invalid_payment"');
    expect(html).toContain('data-strict-rule="357"');
    expect(html).toContain("That payment doesn");
    expect(html).toMatch(/data-testid="strict-play-confirm"[^>]*disabled/u);
  });

  it("[R811.1.b] opens in Hide mode with the Hide intent controls", () => {
    const html = dialog({ initialHide: true });
    expect(html).toContain('data-mode="hide"');
    expect(html).toContain('data-testid="strict-mode-hide"');
    expect(html).not.toContain('data-testid="strict-payment"');
  });
});
