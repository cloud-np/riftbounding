/**
 * Twisted Fate, Gambler (OGN-200) — "When I attack, reveal the top rune of your rune deck, then
 * recycle it. Do one of the following based on its domain: [Fury] - Deal 2 to an enemy unit here and
 * 1 to all other enemy units here. [Mind] - Draw 1. [Order] - Stun an enemy unit."
 *
 * Registers `ogn:twisted-fate`: reveals the top rune (425), recycles it to the bottom of its Rune
 * Deck (417.1.b), then runs the instruction of its domain (any other domain does nothing). The enemy
 * unit for [Fury]/[Order] is chosen when that instruction is known, on resolution (355.18 fallback:
 * an unbound target is asked then, still checked for targetability, 758).
 */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Twisted Fate, Gambler",
  text: "When I attack, reveal the top rune of your rune deck, then recycle it. Do one of the following based on its domain:\n[Fury] - Deal 2 to an enemy unit here and 1 to all other enemy units here.\n[Mind] - Draw 1.\n[Order] - Stun an enemy unit.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "attack", subject: SELF } },
      effect: { op: "custom", id: "ogn:twisted-fate" },
    },
  ],
});
