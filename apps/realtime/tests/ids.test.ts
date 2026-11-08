import { describe, expect, it } from "vitest";
import { ROOM_CODE_LENGTH, generateRoomCode, normalizeRoomCode } from "../src/core/ids";

describe("room codes", () => {
  it("uses the original five-character uppercase alphanumeric alphabet", () => {
    expect(ROOM_CODE_LENGTH).toBe(5);
    const codes = Array.from({ length: 200 }, () => generateRoomCode());
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z0-9]{5}$/u);
    }
    // The recon captures include `V30BY` (zero) and `PZUSU`; the generator must be able to emit
    // both letters and digits, not an ambiguous-glyph subset.
    expect(codes.some((code) => /\d/u.test(code))).toBe(true);
    expect(codes.some((code) => /^[A-Z]+$/u.test(code))).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(150);
  });

  it("normalizes and validates pasted room codes like the join input", () => {
    expect(normalizeRoomCode(" v30by ")).toBe("V30BY");
    expect(normalizeRoomCode("PZUSU")).toBe("PZUSU");
    expect(normalizeRoomCode("")).toBeNull();
    expect(normalizeRoomCode("WITH SPACE")).toBeNull();
    expect(normalizeRoomCode("TOO-LONG-CODE")).toBeNull();
  });
});
