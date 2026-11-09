/**
 * Wave R4 Vendetta battlefields. Their abilities are passive/cost/play-permission effects that
 * the current layers only partially model.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Dragon Roost",
  text: "Any player may pay [Rune][Rune] as an additional cost to play a Dragon. If they do, they play it to this battlefield.",
  status: "partial",
  notes:
    "A battlefield-granted optional additional cost plus a per-card play-location permission for every player has no engine representation (355.2, 356.4.f); nothing is automated.",
  abilities: [],
});

registerCardScript({
  name: "Heisho, Shell of the World",
  text: "Players ignore [Deflect] while paying for spells and abilities choosing something here.",
  status: "partial",
  notes:
    "`ignore-keyword` (764–767) is registered but has no consumer in R2-play's Deflect payment yet, so the [Deflect] surcharge is still charged.",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "custom",
        id: "ignore-keyword",
        params: { keyword: "Deflect", action: "pay-costs", here: true },
      },
    },
  ],
});

registerCardScript({
  name: "Mystic Vortex",
  text: "During showdowns here, cards with [Reaction] cost [Rune] more to play. (Hidden cards have [Reaction].)",
  status: "partial",
  notes:
    "Cost modifiers only apply to the modifier controller's plays (356.3), and a chain spell's keywords are not available to the cost layer; no cost increase is registered.",
  abilities: [],
});

registerCardScript({
  name: "Piltovan Forge",
  text: "While you control this battlefield, the first friendly gear activated ability played each turn costs [1] less.",
  status: "partial",
  notes:
    "The one-shot discount is consumed on the next card play, not on an activated ability (layers/costs.ts `consumeOnceCostEffects`), and battlefield control is only a presence proxy (190); no modifier is registered.",
  abilities: [],
});

registerCardScript({
  name: "Risen Altar",
  text: "[Empower] costs of your units here cost [1] or [Rune] less.",
  status: "partial",
  notes:
    "An either/or discount (Energy or Power) cannot be expressed: cost adjustments are fixed amounts, with no player choice between components (356.4).",
  abilities: [],
});

registerCardScript({
  name: "Sandswept Tomb",
  text: "Each spell that chooses one or more units here that are friendly to it costs [Rune] less.",
  status: "partial",
  notes:
    "The discount depends on the spell's chosen targets, but the cost is planned before 355 choices are bound; a cost modifier cannot read the pending choices (`layers/costs.ts`).",
  abilities: [],
});
