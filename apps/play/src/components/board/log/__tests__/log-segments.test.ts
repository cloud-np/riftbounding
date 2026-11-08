import { describe, expect, it } from "vitest";

import {
  deriveActionKind,
  formatLogTime,
  segmentEnglishLogText,
  segmentLogEntry,
} from "../log-segments";

describe("segmentEnglishLogText", () => {
  it("marks catalog card names as card segments", () => {
    const segments = segmentEnglishLogText("Played Rebuke from hand.");
    expect(segments).toContainEqual({
      type: "card",
      value: "Rebuke",
      cardCode: "OGN-172",
    });
    expect(segments[0]).toEqual({ type: "text", value: "Played " });
  });

  it("handles multi-word card names", () => {
    const segments = segmentEnglishLogText("Moved Kai'Sa, Survivor to Base.");
    expect(segments).toContainEqual({
      type: "card",
      value: "Kai'Sa, Survivor",
      cardCode: "OGN-039",
    });
  });

  it("does not mark token names as cards", () => {
    const segments = segmentEnglishLogText("Played a Gold token to Base.");
    expect(segments.some((segment) => segment.type === "card")).toBe(false);
  });

  it("extracts rune phrases", () => {
    const segments = segmentEnglishLogText("channeled 2 fury runes.");
    expect(segments).toContainEqual({
      type: "rune",
      count: 2,
      domain: "fury",
      before: "2 ",
      after: "fury runes",
    });
  });

  it("extracts compact resource amounts and rune details", () => {
    const segments = segmentEnglishLogText(
      "Auto-paid 3E / 1P — Exhaust 2 · Recycle 1 Fury Rune (+1E).",
    );
    expect(segments).toContainEqual({
      type: "resource",
      value: "3E / 1P",
      kind: "both",
      energy: 3,
      power: 1,
      form: "compact",
      floating: false,
    });
    expect(segments.some((segment) => segment.type === "rune" && segment.domain === "fury")).toBe(
      true,
    );
  });

  it("returns plain text for unknown lines", () => {
    expect(segmentEnglishLogText("Some custom line.")).toEqual([
      { type: "text", value: "Some custom line." },
    ]);
  });
});

describe("segmentLogEntry", () => {
  it("uses the i18n renderer outside English", () => {
    const segments = segmentLogEntry({ text: "exhausted Blazing Scorcher." }, "fr");
    expect(
      segments.some((segment) => segment.type === "card" && segment.cardCode === "OGN-001"),
    ).toBe(true);
  });

  it("uses the English tokenizer for en/unknown locales", () => {
    const segments = segmentLogEntry({ text: "Played Rebuke from hand." }, "en-US");
    expect(segments.some((segment) => segment.type === "card")).toBe(true);
  });
});

describe("deriveActionKind", () => {
  it("keeps wire action kinds", () => {
    expect(deriveActionKind({ text: "anything", actionKind: "score" })).toBe("score");
  });

  it("classifies fixture lines", () => {
    expect(deriveActionKind({ text: "Played Rebuke from hand." })).toBe("spell");
    expect(deriveActionKind({ text: "Paid 2 — Exhaust 2." })).toBe("resource");
    expect(deriveActionKind({ text: "Dismissed showdown at Grove." })).toBe("battle");
    expect(deriveActionKind({ text: "Ended their turn." })).toBe("turn");
  });
});

describe("formatLogTime", () => {
  it("formats 24-hour times", () => {
    expect(formatLogTime(Date.UTC(2026, 0, 1, 13, 5), "en")).toMatch(/^\d{2}:\d{2}$/);
  });
});
