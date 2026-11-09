/**
 * Jayce, Defender of Tomorrow (VEN-149, legend) — "[Empower][2][Rune][Rune] [1], [Tap]: Ready a
 * gear. [Empowered] [1], [Tap]: Ready 2 gear."
 *
 * 827.1.c.1 Empower; 828.1.c: the Empowered activated ability can only be used while I'm
 * Empowered (377.2.b precondition).
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { SELF_EMPOWERED, empower } from "./shared";

registerCardScript({
  name: "Jayce, Defender of Tomorrow",
  text: "[Empower][2][Rune][Rune] ([2][Rune][Rune]: Empower me. Use only if not Empowered.)\n[1], [Tap]: Ready a gear.\n[Empowered] [1], [Tap]: Ready 2 gear.",
  status: "implemented",
  abilities: [
    empower({ energy: 2, power: { any: 2 } }),
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: { op: "ready", target: { chosen: true, cardType: "gear" } },
    },
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "requires",
        condition: SELF_EMPOWERED,
        rule: "828.1.c",
        effect: { op: "ready", target: { chosen: true, cardType: "gear", count: 2 } },
      },
    },
  ],
});
