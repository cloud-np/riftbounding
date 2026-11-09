/**
 * Self-tests for the declarative scenario tooling: position builder, runner diffs, expected
 * failures, validation and the repro → scenario converter (docs/rules/scenarios.md).
 */
import { describe, expect, it } from "vitest";
import { replayStrictRepro } from "../../../engine/src/index";
import { suggestNames } from "./catalog";
import { convertRepro, reproIndices, scenarioSource } from "./convert";
import { defineScenario, type PositionSpec, type ScenarioSpec } from "./format";
import { buildPosition } from "./position";
import { makeBotRepro } from "./repro-fixture";
import { assertScenarioResult, explainResult, runScenario, ScenarioSession } from "./runner";
import { validateScenario } from "./validate";

const BASE_POSITION: PositionSpec = {
  turn: { player: "P1", number: 7 },
  battlefields: [
    { name: "Void Gate" },
    { name: "Targon's Peak", controller: "P2", units: { P2: ["Pouty Poro"] } },
  ],
  players: {
    P1: {
      legend: "Ezreal, Prodigal Explorer",
      points: 3,
      base: ["Ezreal, Prodigy"],
      hand: ["Rebuke"],
      deck: ["Fizz, Trickster", "Traveling Merchant"],
      runes: { ready: { Chaos: 2 }, exhausted: { Mind: 1 } },
    },
    P2: { legend: "Annie, Dark Child", points: 4 },
  },
};

function spec(steps: ScenarioSpec["steps"], extra: Partial<ScenarioSpec> = {}): ScenarioSpec {
  return defineScenario({
    title: "tooling self-test",
    verification: "illustrative",
    notes: "self-test position, not a real game",
    position: BASE_POSITION,
    steps,
    ...extra,
  });
}

describe("scenario position builder", () => {
  it("builds the declared board: zones, deck order, runes, points, control, object state", () => {
    const built = buildPosition({
      ...BASE_POSITION,
      battlefields: [
        {
          name: "Void Gate",
          controller: "P1",
          units: {
            P1: [
              {
                name: "Pouty Poro",
                label: "Poro",
                damage: 1,
                buffs: 1,
                exhausted: true,
                gear: ["Spinning Axe"],
              },
            ],
          },
          facedown: { owner: "P1", card: "Tideturner" },
        },
        { name: "Targon's Peak", controller: null },
      ],
    });
    const s = new ScenarioSession(built);
    const p1 = built.room.players[0]!.board!;
    expect(p1.score).toBe(3);
    expect(p1.hand.map((card) => card.name)).toEqual(["Rebuke"]);
    // The deck's top is the end of the array: "Fizz, Trickster" is drawn first, filler below.
    expect(p1.deck.at(-1)?.name).toBe("Fizz, Trickster");
    expect(p1.deck.at(-2)?.name).toBe("Traveling Merchant");
    expect(p1.deck).toHaveLength(22);
    expect(p1.runeArea.map((card) => [card.name, card.exhausted])).toEqual([
      ["Chaos Rune", false],
      ["Chaos Rune", false],
      ["Mind Rune", true],
    ]);
    const poro = s.resolve("Poro", "test");
    expect(poro.zone).toBe("battlefieldA");
    expect(built.room.rules!.objects[poro.id]).toMatchObject({ damage: 1, buffs: 1 });
    expect(s.host.isExhausted(built.room, poro.id)).toBe(true);
    const axe = s.resolve("Spinning Axe", "test");
    expect(s.host.findCard(built.room, axe.id)?.card.attachedToCardId).toBe(poro.id);
    const tideturner = s.resolve("Tideturner", "test");
    expect(s.host.findCard(built.room, tideturner.id)?.card.hidden).toBe(true);
    expect(built.room.rules!.objects[tideturner.id]).toMatchObject({
      hiddenTurn: 6,
      hiddenBy: "p1",
    });
    expect(built.room.rules!.objects.battlefieldA?.controller).toBe("p1");
    expect(built.room.rules!.objects.battlefieldB?.controller).toBe(null);
    expect(built.room.rules).toMatchObject({
      turn: { player: "p1", number: 7, phase: "main" },
      priority: "p1",
      chain: [],
    });
    expect(s.stateLine()).toContain("neutral_open");
  });

  it("rejects a misspelled card with a did-you-mean hint", () => {
    expect(() =>
      buildPosition({
        ...BASE_POSITION,
        players: { ...BASE_POSITION.players, P2: { legend: "Anie, Dark Child" } },
      }),
    ).toThrow(/Unknown card "Anie, Dark Child" \(P2 legend\)\. Did you mean "Annie, Dark Child"/);
    expect(suggestNames("Ravenblom Studnet", ["Ravenbloom Student", "Rebuke"])).toEqual([
      "Ravenbloom Student",
    ]);
  });

  it("rejects a non-unit at a battlefield and a non-battlefield as battlefield", () => {
    expect(() =>
      buildPosition({
        ...BASE_POSITION,
        battlefields: [
          { name: "Void Gate", units: { P1: ["Rebuke"] } },
          BASE_POSITION.battlefields[1],
        ],
      }),
    ).toThrow(/only units stand at a battlefield/);
    expect(() =>
      buildPosition({
        ...BASE_POSITION,
        battlefields: [{ name: "Rebuke" }, BASE_POSITION.battlefields[1]],
      }),
    ).toThrow(/not a Battlefield/);
  });
});

describe("scenario runner", () => {
  it("passes a correct sequence and reports a readable diff for a wrong expectation", () => {
    const ok = runScenario(
      spec([
        { by: "P1", move: "Ezreal, Prodigy", to: "Targon's Peak" },
        { settle: true },
        { check: { dead: ["Pouty Poro"], control: { "Targon's Peak": "P1" }, points: { P1: 4 } } },
      ]),
    );
    expect(ok.status, explainResult(ok)).toBe("pass");

    const wrong = runScenario(
      spec([
        { by: "P1", move: "Ezreal, Prodigy", to: "Targon's Peak" },
        { settle: true, expect: { dead: ["Ezreal, Prodigy"], points: { P1: 3 } } },
      ]),
    );
    expect(wrong.status).toBe("fail");
    expect(wrong.failure?.step).toBe(2);
    expect(wrong.failure?.message).toMatch(
      /^step 2 \(everyone passes until the chain\/showdown settles\): expected P1 at 3 point\(s\), got 4; expected Ezreal, Prodigy dead, got alive at Targon's Peak \(Might 3, exhausted\)$/,
    );
    expect(() => assertScenarioResult(wrong)).toThrow(/FAIL tooling self-test/);
  });

  it("reports an unexpected engine rejection, and checks expected rejections", () => {
    const rejected = runScenario(spec([{ by: "P2", move: "Pouty Poro", to: "Void Gate" }]));
    expect(rejected.status).toBe("fail");
    expect(rejected.failure?.message).toMatch(
      /^step 1 \(P2 moves Pouty Poro to Void Gate\): the engine rejected it: not_your_priority \(rule 312\.1\)/,
    );

    const expected = runScenario(
      spec([
        {
          by: "P2",
          move: "Pouty Poro",
          to: "Void Gate",
          reject: { code: "not_your_priority", rule: "312.1" },
        },
      ]),
    );
    expect(expected.status, explainResult(expected)).toBe("pass");

    const accepted = runScenario(
      spec([{ by: "P1", move: "Ezreal, Prodigy", to: "Void Gate", reject: true }]),
    );
    expect(accepted.failure?.message).toMatch(
      /expected the engine to reject this, but it was accepted/,
    );
  });

  it("names unknown refs and locations with a did-you-mean hint", () => {
    const typo = runScenario(spec([{ by: "P1", move: "Ezrael, Prodigy", to: "Targon's Peak" }]));
    expect(typo.failure?.message).toMatch(
      /no "Ezrael, Prodigy" available\. Did you mean "Ezreal, Prodigy"/,
    );
    const place = runScenario(spec([{ by: "P1", move: "Ezreal, Prodigy", to: "Targons Peek" }]));
    expect(place.failure?.message).toMatch(/is not a location .*Did you mean "Targon's Peak"/);
  });

  it("treats expectFailure as XFAIL while it fails and XPASS once it passes", () => {
    const failing = spec(
      [
        { by: "P1", move: "Ezreal, Prodigy", to: "Targon's Peak" },
        { settle: true },
        { check: { points: { P1: 9 } } },
      ],
      {
        expectFailure: { reason: "[BUG] self-test", rule: "000 quoted", atStep: 3 },
      },
    );
    const xfail = runScenario(failing);
    expect(xfail.status).toBe("xfail");
    expect(() => assertScenarioResult(xfail)).not.toThrow();

    const wrongStep = runScenario({
      ...failing,
      expectFailure: { reason: "[BUG] self-test", atStep: 2 },
    });
    expect(wrongStep.status).toBe("fail");
    expect(wrongStep.failure?.message).toMatch(
      /expected the known divergence at step 2, but the scenario failed at step 3/,
    );

    const passing = runScenario(
      spec([{ by: "P1", move: "Ezreal, Prodigy", to: "Targon's Peak" }], {
        expectFailure: "[BUG] fixed already",
      }),
    );
    expect(passing.status).toBe("xpass");
    expect(() => assertScenarioResult(passing)).toThrow(/XPASS .*remove `expectFailure`/);
  });

  it("validates structure with did-you-mean hints for unknown keys", () => {
    const bad = {
      ...spec([
        { by: "P1", move: "Ezreal, Prodigy", too: "Void Gate" } as never,
        { check: { pionts: { P1: 1 } } } as never,
      ]),
      verification: "sourced" as const,
    };
    const problems = validateScenario(bad);
    expect(problems.join("\n")).toMatch(/step 1: unknown key "too"\. Did you mean "to"/);
    expect(problems.join("\n")).toMatch(
      /step 2 check: unknown key "pionts"\. Did you mean "points"/,
    );
    expect(problems.join("\n")).toMatch(/sourced scenario must cite at least one source URL/);
    expect(runScenario(bad).status).toBe("fail");
  });
});

describe("docs/rules/scenarios.md", () => {
  it("the minimal example passes (scoredThisTurn makes the Conquer the Final Point)", () => {
    const result = runScenario(
      defineScenario({
        title: "Final Point by Conquer",
        verification: "illustrative",
        sources: [
          { label: "Ezreal — RQ Bologna 1st place decklist", url: "https://example.invalid" },
        ],
        notes: "Not a real game: cards from the cited list, board invented.",
        position: {
          turn: { player: "P1", number: 12 },
          battlefields: [
            { name: "Void Gate" },
            { name: "Targon's Peak", controller: "P2", units: { P2: ["Pouty Poro"] } },
          ],
          players: {
            P1: {
              legend: "Ezreal, Prodigal Explorer",
              points: 7,
              base: ["Ezreal, Prodigy"],
              scoredThisTurn: ["Void Gate"],
            },
            P2: { legend: "Annie, Dark Child", points: 6 },
          },
        },
        steps: [
          {
            by: "P1",
            move: "Ezreal, Prodigy",
            to: "Targon's Peak",
            expect: { combat: { at: "Targon's Peak" } },
          },
          { settle: true },
          { check: { dead: ["Pouty Poro"], points: { P1: 8 }, winner: "P1" } },
        ],
      }),
    );
    expect(result.status, explainResult(result)).toBe("pass");
  });
});

describe("repro → scenario converter", () => {
  const repro = makeBotRepro({ actions: 70 });

  it("produces a repro that the engine replays exactly", () => {
    expect(repro.actions.length).toBeGreaterThan(40);
    expect(replayStrictRepro(repro).ok).toBe(true);
  }, 60_000);

  it("turns windows of the repro into scenarios that replay green in the runner", () => {
    const indices = reproIndices(repro);
    // Positions start before a clean index (Main Phase, empty chain); take the first action of
    // each turn plus every later clean index, with the following actions as steps.
    const starts = indices.filter(
      (info, index) => info.clean && (index === 0 || indices[index - 1]!.turn !== info.turn),
    );
    expect(starts.length).toBeGreaterThan(4);
    const statuses: string[] = [];
    for (const start of starts) {
      const converted = convertRepro(repro, { at: start.index, count: 12 });
      expect(validateScenario(converted.spec)).toEqual([]);
      const result = runScenario(converted.spec);
      statuses.push(`${start.index}:${result.status}`);
      expect(result.status, `${start.index}: ${explainResult(result)}`).toBe("pass");
      expect(converted.spec.steps.at(-1)).toHaveProperty("check");
    }
    expect(statuses.length).toBe(starts.length);
  }, 120_000);

  it("emits TypeScript source with the defineScenario wrapper", () => {
    const start = reproIndices(repro).find((info) => info.clean && info.index > 10)!;
    const converted = convertRepro(repro, {
      at: start.index,
      count: 3,
      title: "Converted self-test",
    });
    const source = scenarioSource(converted.spec, converted.warnings, "../format");
    expect(source).toContain('import { defineScenario } from "../format";');
    expect(source).toContain("export default defineScenario({");
    expect(source).toContain('title: "Converted self-test"');
    expect(converted.spec.position.players.P1.deckFiller).toEqual({ count: 0 });
  });

  it("rejects an out-of-range index", () => {
    expect(() => convertRepro(repro, { at: repro.actions.length })).toThrow(
      /--at must be between 0 and/,
    );
  });
});
