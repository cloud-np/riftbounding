/**
 * Rage Amplifier (VEN-018, gear) — "[Empower][6][Fury] Your units have +1 [Might]. If I'm
 * [Empowered], they have +2 [Might] instead." (827.1.c.1; 364.3.a conditional passives)
 */
import { SELF_EMPOWERED, conditional, empower } from "./shared";
import { not, registerCardScript } from "../sdk";

const YOUR_UNITS = { cardType: "unit" as const, controller: "self" as const };

registerCardScript({
  name: "Rage Amplifier",
  text: "[Empower][6][Fury] ([6][Fury]: Empower this. Use only if not Empowered.)\nYour units have +1 [Might]. If I'm [Empowered], they have +2 [Might] instead.",
  status: "implemented",
  abilities: [
    empower({ energy: 6, power: { Fury: 1 } }),
    conditional(not(SELF_EMPOWERED), { kind: "might", amount: 1, target: YOUR_UNITS }),
    conditional(SELF_EMPOWERED, { kind: "might", amount: 2, target: YOUR_UNITS }),
  ],
});
