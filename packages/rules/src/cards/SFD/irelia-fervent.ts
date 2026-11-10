/** Irelia, Fervent. */
import { registerCardScript, SELF } from "../sdk";
import { CHOOSE_TRIGGER } from "./custom";

registerCardScript({
  name: "Irelia, Fervent",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nWhen you choose or ready me, give me +1 [Might] this turn.",
  status: "partial",
  notes: `${CHOOSE_TRIGGER} "When you ready me" is automated, including the Awaken Phase ready (315.1.b / 416.3.a).`,
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "ready", subject: SELF } },
      effect: { op: "temporary_might", amount: 1, target: SELF },
    },
  ],
});
