/**
 * Play card / play location verdicts — rules 349–359, 420.1.a, 422, 811.
 *
 * `playIntentVerdict` is the one verdict for a `rules_play` intent, shared by the write path
 * and `explainIllegal`; `playCardVerdict` (R1 signature) is the same check for a bare play
 * (no choices, no optional costs, auto payment) used by `legalIntents`.
 */
import type { Room, RulesPlayIntent } from "@rift/protocol";
import type { CardInfo, RulesHost } from "../host";
import type { RulesFailure } from "../types";
import { planCardPlay, type CardPlayPlan } from "../play/process";
import { planHide, type HidePlan } from "../play/hidden";
import { chooseLocation } from "../play/locations";
import { printedCardKeywords } from "../play/keywords";
import { requestFromIntent } from "../play/request";

/** R1 shape (`located`, `info`, `location`) plus the full plan. */
export type PlayCardVerdictOk = CardPlayPlan;

export type PlayCardVerdict = PlayCardVerdictOk | RulesFailure;

/**
 * 355.2/355.2.a/358.5/359.2.d: choose a valid Location before any mutation. Units may enter the
 * controller's Base or a Battlefield the controller controls (Ambush: where they have Units);
 * Non-Unit Gear enters at the Base (Deploy: a battlefield). An invalid location cancels the play
 * (358.5), never silently falls back to Base.
 */
export function playLocationVerdict(
  room: Room,
  playerId: string,
  info: CardInfo | null,
  requested: unknown,
  host: RulesHost,
): { ok: true; location: string } | RulesFailure {
  const result = chooseLocation(
    room,
    host,
    { playerId, cardId: info?.objectId ?? "", info, keywords: printedCardKeywords(info) },
    requested,
  );
  return result.ok ? { ok: true, location: result.location } : result;
}

/** 420.1.a + timing + 355–357: the play verdict for a bare play (auto payment). */
export function playCardVerdict(
  room: Room,
  playerId: string,
  cardId: string,
  host: RulesHost,
  location?: unknown,
): PlayCardVerdict {
  return planCardPlay(room, playerId, cardId, { choices: {}, optionalCosts: [], ...(location !== undefined ? { location } : {}) }, host);
}

export type PlayIntentVerdict =
  | ({ kind: "play"; plan: CardPlayPlan } & { ok: true })
  | ({ kind: "hide"; plan: HidePlan } & { ok: true })
  | RulesFailure;

/** The full verdict for a `rules_play` intent (play or 811.1.b Hide). */
export function playIntentVerdict(room: Room, playerId: string, intent: RulesPlayIntent, host: RulesHost): PlayIntentVerdict {
  const request = requestFromIntent(intent);
  if (intent.hide === true) {
    const hide = planHide(room, playerId, intent.cardId, request, host);
    return hide.ok ? { ok: true, kind: "hide", plan: hide } : hide;
  }
  const plan = planCardPlay(room, playerId, intent.cardId, request, host);
  return plan.ok ? { ok: true, kind: "play", plan } : plan;
}
