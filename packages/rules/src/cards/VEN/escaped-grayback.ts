/** Escaped Grayback (VEN-124) — "[Empower] - Kill a friendly unit [Empowered] I have +2 [Might]." (827.1.c.2) */
import { empower, whileEmpowered } from "./shared";
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Escaped Grayback",
  text: "[Empower] - Kill a friendly unit (Pay the cost: Empower me. USe only if not Empowered.)\n[Empowered] I have +2 [Might]",
  status: "implemented",
  abilities: [
    empower({ kill: { cardType: "unit", controller: "self" } }),
    whileEmpowered({ kind: "might", amount: 2, target: SELF }),
  ],
});
