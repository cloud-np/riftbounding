import { describe, expect, it } from "vitest";

import { boardEmoteDuration, emoteFlightGeometry } from "../emote-flight-math";

describe("emote flight math (original r3/ae)", () => {
  it("uses 3200 ms for Poro and 1080 ms for base emotes", () => {
    expect(boardEmoteDuration("poro_wave")).toBe(3200);
    expect(boardEmoteDuration("thumbs_up")).toBe(1080);
    expect(boardEmoteDuration("unknown")).toBe(1080);
  });

  it("starts in a 76 px box beside the sender and arcs toward the middle", () => {
    const geometry = emoteFlightGeometry({
      boardRect: { left: 100, top: 50, width: 1000, height: 600 },
      senderSide: "bottom",
      eventId: 4,
    });
    expect(geometry.startLeftPx).toBeGreaterThan(100 + 500 - 38 - 30);
    expect(geometry.startLeftPx).toBeLessThan(100 + 500 + 38 + 30);
    expect(geometry.startTopPx).toBeGreaterThan(50 + 300);
    expect(geometry.offsetYPx).toBeLessThan(0);
    expect(Math.abs(geometry.arcXPx)).toBeGreaterThanOrEqual(10);
    expect(Math.abs(geometry.arcXPx)).toBeLessThanOrEqual(24);
  });

  it("mirrors the start side for the top sender", () => {
    const top = emoteFlightGeometry({
      boardRect: { left: 0, top: 0, width: 800, height: 400 },
      senderSide: "top",
      eventId: 3,
    });
    expect(top.startTopPx).toBeLessThan(200);
    expect(top.offsetYPx).toBeGreaterThan(0);
  });
});
