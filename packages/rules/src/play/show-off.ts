/**
 * Show Off — rules 832.1.b, 832.1.c, 832.1.c.1–832.1.c.4, 832.1.d, 832.1.d.1, 832.3.
 *
 * "[Show Off] [Object]" is short for "As you play this, you may reveal [Object] from your hand
 * and/or pick [Object] from among friendly game objects on the board" (832.1.c). A script
 * declares it as a passive custom modifier (built with `showOff()` in `cards/dsl.ts`):
 *
 *   { kind: "passive", modifier: { kind: "custom", id: "show-off", params: { selector, count? } } }
 *
 * - The decision is a play-time choice made while the card is finalized (832.1.c.2 / 355): key
 *   `"showOff"`, `choose-card`, 0..count options from the controller's hand (the card being
 *   played excluded) and friendly board objects matching `selector`. Not a Target (no 758/809).
 * - When the item finalizes the shown-off information is noted (832.1.d.1: later changes are not
 *   considered) on `choices.$showOff` and, for permanents, on `objects[id].showOff`, so linked
 *   instructions read it: condition `custom("showed-off")`, amount `{ kind: "shown-off" }`.
 * - 832.1.c.4: shown-off objects that later leave their zone do not stop the finalization.
 *
 * Pure except `noteShowOff` (draft-only, called from the 337.1 afterFinalize hook).
 */
import type { ChainItem, ChoiceRecord, Room, Selector } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { getCardScript } from "../cards/registry";
import type { ChoiceSpec } from "../effects/choices";
import { idsOf, makeEnv } from "../effects/env";
import { matchesSelector, mightOf } from "../effects/evaluate";
import { costsOf, locationZones, nameOf } from "../effects/objects";
import { optionFor } from "../effects/targets";

export const SHOW_OFF_KEY = "showOff";
export const SHOW_OFF_INFO_KEY = "$showOff";

export interface ShowOffSpec {
  selector: Selector;
  count: number;
}

/** The Show Off instances printed on a card's script (832.2: treated separately; we use the first). */
export function showOffSpecs(cardName: string | undefined): ShowOffSpec[] {
  const script = getCardScript(cardName);
  if (!script) return [];
  const out: ShowOffSpec[] = [];
  for (const ability of script.abilities) {
    if (ability.kind !== "passive") continue;
    const modifier = ability.modifier;
    if (modifier.kind !== "custom" || modifier.id !== "show-off") continue;
    const params = modifier.params ?? {};
    const selector = (params.selector ?? {}) as Selector;
    const count = typeof params.count === "number" && params.count > 0 ? Math.trunc(params.count) : 1;
    out.push({ selector, count });
  }
  return out;
}

/** 832.1.c: cards in the controller's hand and friendly board objects that can be shown off. */
export function showOffCandidates(
  room: Room,
  host: RulesHost,
  playerId: string,
  cardId: string,
  spec: ShowOffSpec,
): string[] {
  const ctx = { room, host, env: makeEnv({ controller: playerId, sourceObjectId: cardId }) };
  const out: string[] = [];
  const consider = (id: string, zone: Selector["zone"]) => {
    if (id === cardId || out.includes(id)) return;
    const selector: Selector = { ...spec.selector, zone, controller: "self" };
    delete selector.chosen;
    delete selector.targetRef;
    if (matchesSelector(ctx, selector, id)) out.push(id);
  };
  for (const card of host.zoneCards(room, playerId, "hand")) consider(card.id, "hand");
  for (const zone of locationZones(room, host)) {
    for (const card of host.zoneCards(room, playerId, zone)) {
      if (card.hidden) continue; // 107.3: a facedown card is not a friendly unit/gear to pick.
      consider(card.id, zone as Selector["zone"]);
    }
  }
  return out;
}

/** The `showOff` play-time choice of a card (empty when it has no Show Off). */
export function showOffChoiceSpecs(room: Room, host: RulesHost, playerId: string, cardId: string): ChoiceSpec[] {
  const info = host.cardInfo(room, cardId);
  const [spec] = showOffSpecs(info?.name);
  if (!spec) return [];
  const ctx = { room, host, env: makeEnv({ controller: playerId, sourceObjectId: cardId }) };
  const options = showOffCandidates(room, host, playerId, cardId, spec).map((id) => optionFor(ctx, id));
  return [
    {
      key: SHOW_OFF_KEY,
      kind: "choose-card",
      min: 0,
      max: spec.count,
      targeted: false,
      options,
      rule: "832.1.c",
      label: "rules.prompt.showOff",
      data: { showOff: true, count: spec.count },
    },
  ];
}

/**
 * 832.1.d.1: note what was shown off as the item finalizes (Might, costs); reveal hand cards
 * (832.1.c / 425). Draft-only.
 */
export function noteShowOff(room: Room, item: ChainItem, step: RulesStepContext): void {
  const rules = room.rules;
  const card = item.cardSnapshot;
  if (!rules || item.kind !== "card" || !card) return;
  const ids = idsOf(item.choices?.[SHOW_OFF_KEY]);
  if (ids.length === 0) return;
  const host = step.host;
  const ctx = { room, host, env: makeEnv({ controller: item.controller, sourceObjectId: card.id }) };
  const first = ids[0]!;
  const might = mightOf(ctx, first);
  const costs = costsOf(room, host, first);
  const info: ChoiceRecord = {
    ids: [...ids],
    ...(might !== null ? { might } : {}),
    ...(costs ? { energy: costs.energy, power: costs.power } : {}),
  };
  item.choices = { ...item.choices, [SHOW_OFF_INFO_KEY]: info };
  if (!(host.cardInfo(room, card.id)?.type ?? "").toLowerCase().includes("spell")) {
    (rules.objects[card.id] ??= {}).showOff = {
      ids: [...ids],
      ...(might !== null ? { might } : {}),
      ...(costs ? { energy: costs.energy, power: costs.power } : {}),
    };
  }
  for (const id of ids) {
    const located = host.findCard(room, id);
    pushEvent(step.events, {
      type: located?.zone === "hand" ? "reveal" : "show_off",
      cardId: id,
      playerId: item.controller,
      ...(nameOf(room, host, id) ? { cardName: nameOf(room, host, id)! } : {}),
      data: { showOff: true, sourceCardId: card.id, rule: "832.1.c" },
    });
  }
}
