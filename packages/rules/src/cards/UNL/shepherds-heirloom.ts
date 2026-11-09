/** Shepherd's Heirloom. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { equip } from "./custom";

registerCardScript({
  name: "Shepherd's Heirloom",
  text: "When you play this, gain 1 XP.\n[Equip] — Spend 1 XP (Pay the cost: Attach this to a unit you control.)",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "gain_xp", amount: 1 } },
    equip({ spendXp: 1 }),
  ],
});
