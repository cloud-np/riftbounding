/**
 * Qiyana, Victorious (OGN-155) — "[Deflect] When I conquer, draw 1 or channel 1 rune exhausted."
 *
 * [Deflect] (809) is the play layer's. "When I conquer" (383.4.c.2.a): the conquer event names
 * the battlefield; the trigger matches while I'm there under the conquering player. The choice of
 * mode is made when the trigger finalizes (355.3 / 403.2).
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Qiyana, Victorious",
  text: "[Deflect] (Opponents must pay [power] to choose me with a spell or ability.)\nWhen I conquer, draw 1 or channel 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      effect: {
        op: "choose_mode",
        modes: [
          { id: "draw", label: "Draw 1", effect: { op: "draw", amount: 1 } },
          {
            id: "channel",
            label: "Channel 1 rune exhausted",
            effect: { op: "channel", amount: 1, exhausted: true },
          },
        ],
      },
    },
  ],
});
