/**
 * Strict-rules board interactions (R4-strict-ui) — pure mapping from board gestures and context
 * menus to `rules_*` intents.
 *
 * Sandbox rooms never reach this module: every caller gates on `strictViewFor` (or
 * `isStrictRoom`), so the original sandbox mapping (`drop-intents.ts`, `menu-builders.ts`) stays
 * byte-for-byte in charge there.
 */
import { strictLegalIntents } from "@rift/engine";
import { rulesReasonText } from "@rift/i18n";
import type { Translator } from "@rift/i18n";
import type {
  LegalIntents,
  LegalMove,
  PaymentPlanWire,
  PlayableCardDetail,
  Room,
  RulesDomain,
  Verdict,
  WireAction,
  Zone,
  ZoneSelector,
} from "@rift/protocol";

import { isStrictRoom, zoneLabel } from "./strict-model";

const BATTLEFIELD_ZONES: ReadonlySet<string> = new Set([
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
]);

const SOURCE_PLAY_ZONES: ReadonlySet<string> = new Set(["hand", "champion"]);
const BOARD_MOVE_ZONES: ReadonlySet<string> = new Set([
  "base",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
]);

export function isBattlefieldZoneName(zone: string): boolean {
  return BATTLEFIELD_ZONES.has(zone);
}

export function isBoardMoveZone(zone: string): boolean {
  return BOARD_MOVE_ZONES.has(zone);
}

function isPlayZone(zone: string): boolean {
  return zone === "base" || BATTLEFIELD_ZONES.has(zone);
}

/* ------------------------------------------------------------------ legal view */

/** The strict read side, indexed for board lookups (playable / hideable / activatable / moves). */
export interface StrictBoardView {
  actorId: string;
  legal: LegalIntents;
  playableById: ReadonlyMap<string, PlayableCardDetail>;
  playableCardIds: ReadonlySet<string>;
  hideableById: ReadonlyMap<string, readonly string[]>;
  activatableById: ReadonlyMap<string, readonly string[]>;
  moves: readonly LegalMove[];
}

export function strictViewFromLegal(actorId: string, legal: LegalIntents): StrictBoardView {
  const playableById = new Map<string, PlayableCardDetail>();
  for (const detail of legal.playable ?? []) playableById.set(detail.cardId, detail);
  const hideableById = new Map<string, string[]>();
  for (const entry of legal.hideable ?? []) hideableById.set(entry.cardId, [...entry.locations]);
  const activatableById = new Map<string, string[]>();
  for (const entry of legal.activatable) {
    const list = activatableById.get(entry.objectId) ?? [];
    if (!list.includes(entry.ability)) list.push(entry.ability);
    activatableById.set(entry.objectId, list);
  }
  return {
    actorId,
    legal,
    playableById,
    playableCardIds: new Set(playableById.keys()),
    hideableById,
    activatableById,
    moves: legal.moves,
  };
}

/** `legalIntents` for one seat, or null outside a strict in-game room. */
export function strictViewFor(
  room: Room | null | undefined,
  actorId: string,
): StrictBoardView | null {
  if (!isStrictRoom(room)) return null;
  const legal = strictLegalIntents(room, actorId);
  return legal ? strictViewFromLegal(actorId, legal) : null;
}

/** True when the §6.4 manual window is open for `actorId` (sandbox board actions stay legal). */
export function strictManualWindowFor(room: Room | null | undefined, actorId: string): boolean {
  return !!room?.rules?.manual && room.rules.manual.player === actorId;
}

/* ------------------------------------------------------------------ intents */

export interface StrictPlayOptions {
  cardId: string;
  location?: string;
  optionalCosts?: readonly string[];
  payment?: PaymentPlanWire;
  hide?: boolean;
  hold?: boolean;
}

/** `rules_play` with the client's chosen location / costs / payment / Hide (811.1.b). */
export function strictPlayIntent(options: StrictPlayOptions): WireAction {
  const location = options.location as ZoneSelector | undefined;
  return {
    type: "rules_play",
    cardId: options.cardId,
    ...(location ? { location } : {}),
    ...(options.optionalCosts && options.optionalCosts.length > 0
      ? { optionalCosts: [...options.optionalCosts] }
      : {}),
    ...(options.payment ? { plan: options.payment } : {}),
    ...(options.hide ? { hide: true } : {}),
    ...(options.hold ? { hold: true } : {}),
  };
}

export function strictActivateIntent(objectId: string, ability: string): WireAction {
  return { type: "rules_activate", objectId, ability };
}

export function strictMoveIntent(unitIds: readonly string[], to: string): WireAction {
  return { type: "rules_move", unitIds: [...unitIds], to: to as ZoneSelector };
}

export function strictPassIntent(): WireAction {
  return { type: "rules_pass" };
}

export function strictEndTurnIntent(): WireAction {
  return { type: "rules_end_turn" };
}

/* ------------------------------------------------------------------ drops */

export interface StrictDropInput {
  view: StrictBoardView;
  /** Dragged card's current zone. */
  sourceZone: Zone;
  cardId: string;
  targetZone: string;
  targetOwner: "self" | "opponent";
  /** Multi-selected units dragged together (defaults to the dragged card). */
  unitIds?: readonly string[];
}

export interface StrictDropAttempt {
  intent: WireAction;
  legal: boolean;
  /** A drop-target rejection that is not visible from the intent shape alone. */
  reason?: { code: string; rule?: string };
}

/**
 * Map one board drop to its strict intent. The returned intent is the attempt (the same shape a
 * click sends); `legal` is decided from the strict `LegalIntents` view, and a caller can pass the
 * attempt to `strictExplainIllegal` for the engine's rejection code/rule when it is false.
 */
export function strictDropAttempt(input: StrictDropInput): StrictDropAttempt | null {
  const { view, sourceZone, cardId, targetZone, targetOwner } = input;
  const ownerOk = targetZone === "base" ? targetOwner === "self" : true;

  if (SOURCE_PLAY_ZONES.has(sourceZone)) {
    const detail = view.playableById.get(cardId);
    const locations = detail?.locations ?? [];
    const targetIsPlayZone = isPlayZone(targetZone);
    // Spells have no Location (355.2): any play zone drop means "play the spell".
    const spellLike = !!detail && locations.length === 0 && targetIsPlayZone;
    const legal =
      ownerOk &&
      targetIsPlayZone &&
      !!detail &&
      (spellLike || locations.includes(targetZone));
    const reason = !targetIsPlayZone
      ? { code: "invalid_location", rule: "355.2" }
      : !ownerOk
        ? { code: "invalid_location", rule: "355.2" }
        : undefined;
    return {
      intent: strictPlayIntent({
        cardId,
        ...(spellLike || !targetIsPlayZone
          ? {}
          : { location: targetZone }),
      }),
      legal,
      ...(reason ? { reason } : {}),
    };
  }

  if (BOARD_MOVE_ZONES.has(sourceZone)) {
    const detail = view.playableById.get(cardId);
    // 811.1.b: a facedown card may be played from its battlefield instead of moved.
    if (detail?.fromFacedown && isPlayZone(targetZone)) {
      const legal = ownerOk && detail.locations.includes(targetZone);
      return {
        intent: strictPlayIntent({ cardId, location: targetZone }),
        legal,
        ...(!legal ? { reason: { code: "invalid_location", rule: "811.1.d.1" } } : {}),
      };
    }
    if (!isBoardMoveZone(targetZone) || !ownerOk) {
      return {
        intent: strictMoveIntent([cardId], targetZone),
        legal: false,
        reason: { code: "invalid_location", rule: "449.2" },
      };
    }
    const unitIds =
      input.unitIds && input.unitIds.length > 0 ? [...input.unitIds] : [cardId];
    const legal = view.moves.some(
      (move) => move.to === targetZone && unitIds.every((id) => move.unitIds.includes(id)),
    );
    return { intent: strictMoveIntent(unitIds, targetZone), legal };
  }

  return null;
}

/* ------------------------------------------------------------------ payment plan */

export interface StrictPaymentDraft {
  /** Omit `payment` and let the engine plan the cost (default). */
  auto: boolean;
  exhaustRunes: readonly string[];
  recycleRunes: readonly string[];
  poolEnergy: number;
  poolPower: number;
}

export function emptyPaymentDraft(): StrictPaymentDraft {
  return { auto: true, exhaustRunes: [], recycleRunes: [], poolEnergy: 0, poolPower: 0 };
}

/** Explicit 356/357 payment plan; `undefined` keeps the engine's auto-plan. */
export function strictPaymentPlan(draft: StrictPaymentDraft): PaymentPlanWire | undefined {
  if (draft.auto) return undefined;
  const poolPower: Partial<Record<RulesDomain | "any", number>> = {};
  if (draft.poolPower > 0) poolPower.any = draft.poolPower;
  return {
    ...(draft.poolEnergy > 0 ? { poolEnergy: draft.poolEnergy } : {}),
    ...(draft.exhaustRunes.length > 0 ? { exhaustRunes: [...draft.exhaustRunes] } : {}),
    ...(draft.recycleRunes.length > 0 ? { recycleRunes: [...draft.recycleRunes] } : {}),
    ...(Object.keys(poolPower).length > 0 ? { poolPower } : {}),
  };
}

export interface StrictRuneChoice {
  id: string;
  name: string;
  domain: string;
  available: boolean;
}

/** Ready runes usable for an explicit plan (164.2.a exhaust / 164.2.b recycle). */
export function strictRuneChoices(room: Room, actorId: string): StrictRuneChoice[] {
  const player = room.players.find((candidate) => candidate.id === actorId);
  const runes = player?.board?.runeArea ?? [];
  return runes.map((rune) => ({
    id: rune.id,
    name: rune.name,
    domain: rune.domains?.[0] ?? "any",
    available: !rune.exhausted,
  }));
}

/* ------------------------------------------------------------------ context menus */

export interface StrictMenuEntry {
  id: string;
  label: string;
  hint?: string;
  tone?: "default" | "danger" | "positive";
  disabled?: boolean;
  /** Direct wire intent (Play / Activate / Move / Hide). */
  intent?: WireAction;
  /** Opens the play-options dialog (payment / optional costs / location). */
  openPlay?: { cardId: string; location?: string; hide?: boolean };
  /** Client-local cosmetic action. */
  action?: "ping";
}

export interface StrictMenuContext {
  room: Room;
  view: StrictBoardView;
  t: Translator;
  /** `strictExplainIllegal` for the acting seat (`{ ok: true }` when legal). */
  explain: (intent: WireAction) => Verdict;
}

function disabledHint(ctx: StrictMenuContext, intent: WireAction): string | undefined {
  const verdict = ctx.explain(intent);
  if (verdict.ok) return undefined;
  return rulesReasonText(ctx.t, verdict.code, verdict.rule);
}

function cardLabelName(ctx: StrictMenuContext, cardId: string): string {
  const name = ctx.room.players
    .flatMap((player) => (player.board ? Object.values(player.board) : []))
    .flatMap((value) => (Array.isArray(value) ? (value as Array<{ id?: string; name?: string }>) : []))
    .find((card) => card?.id === cardId)?.name;
  return name ?? cardId;
}

function playLabel(ctx: StrictMenuContext, cardId: string): string {
  return `${ctx.t("rules.ui.play") ?? "Play"} ${cardLabelName(ctx, cardId)}`;
}

function hideLabel(ctx: StrictMenuContext, cardId: string, zone: string): string {
  return `${ctx.t("rules.ui.hide") ?? "Hide"} ${cardLabelName(ctx, cardId)} → ${zoneLabel(ctx.t, zone)}`;
}

function playEntries(ctx: StrictMenuContext, cardId: string): StrictMenuEntry[] {
  const entries: StrictMenuEntry[] = [];
  const detail = ctx.view.playableById.get(cardId);
  const locations = detail?.locations ?? [];
  if (detail) {
    if (locations.length > 1) {
      for (const location of locations) {
        const intent = strictPlayIntent({ cardId, location });
        entries.push({
          id: `play:${location}`,
          label: `${playLabel(ctx, cardId)} → ${zoneLabel(ctx.t, location)}`,
          intent,
          disabled: !ctx.explain(intent).ok,
          ...(disabledHint(ctx, intent) ? { hint: disabledHint(ctx, intent) } : {}),
        });
      }
    } else {
      const intent = strictPlayIntent({
        cardId,
        ...(locations[0] ? { location: locations[0] } : {}),
      });
      entries.push({
        id: "play",
        label: playLabel(ctx, cardId),
        intent,
        disabled: !ctx.explain(intent).ok,
        ...(disabledHint(ctx, intent) ? { hint: disabledHint(ctx, intent) } : {}),
      });
    }
    if (detail.optionalCosts.length > 0) {
      entries.push({
        id: "play-options",
        label: ctx.t("rules.ui.playWithOptions") ?? "Play with options…",
        openPlay: { cardId },
      });
    }
  } else {
    const intent = strictPlayIntent({ cardId });
    entries.push({
      id: "play",
      label: playLabel(ctx, cardId),
      intent,
      disabled: true,
      ...(disabledHint(ctx, intent) ? { hint: disabledHint(ctx, intent) } : {}),
    });
  }
  return entries;
}

function hideEntries(ctx: StrictMenuContext, cardId: string): StrictMenuEntry[] {
  const locations = ctx.view.hideableById.get(cardId) ?? [];
  if (locations.length === 1) {
    return [
      {
        id: "hide",
        label: hideLabel(ctx, cardId, locations[0]!),
        intent: strictPlayIntent({ cardId, hide: true, location: locations[0] }),
      },
    ];
  }
  return locations.map((location) => ({
    id: `hide:${location}`,
    label: hideLabel(ctx, cardId, location),
    intent: strictPlayIntent({ cardId, hide: true, location }),
  }));
}

/** Hand card menu in a strict room: Play (per Location, 355.2), Hide (811.1.b), options. */
export function buildStrictHandMenu(ctx: StrictMenuContext, cardId: string): StrictMenuEntry[] {
  const entries = [...playEntries(ctx, cardId), ...hideEntries(ctx, cardId)];
  if (entries.length === 0) return [];
  return entries;
}

/** Board card menu: Activate (incl. `manual:<n>`), Standard Move and Hide; Ping stays local. */
export function buildStrictCardMenu(
  ctx: StrictMenuContext,
  cardId: string,
  zone: Zone,
): StrictMenuEntry[] {
  const entries: StrictMenuEntry[] = [
    { id: "ping", label: ctx.t("sim.compactPing") ?? "Ping", action: "ping" },
  ];
  const abilities = ctx.view.activatableById.get(cardId) ?? [];
  for (const ability of abilities) {
    const verb = ability.startsWith("manual:")
      ? (ctx.t("rules.ui.activateManual") ?? "Activate (manual)")
      : (ctx.t("rules.ui.activate") ?? "Activate");
    const intent = strictActivateIntent(cardId, ability);
    entries.push({
      id: `activate:${ability}`,
      label: `${verb}: ${cardLabelName(ctx, cardId)}`,
      intent,
      disabled: !ctx.explain(intent).ok,
      ...(disabledHint(ctx, intent) ? { hint: disabledHint(ctx, intent) } : {}),
    });
  }
  if (SOURCE_PLAY_ZONES.has(zone) || ctx.view.playableById.get(cardId)?.fromFacedown) {
    entries.push(...playEntries(ctx, cardId));
  }
  if (isBoardMoveZone(zone)) {
    for (const move of ctx.view.moves) {
      if (!move.unitIds.includes(cardId)) continue;
      const intent = strictMoveIntent([cardId], move.to);
      entries.push({
        id: `move:${move.to}`,
        label: ctx.t("rules.ui.moveTo", { zone: zoneLabel(ctx.t, move.to) }) ?? `Move to ${zoneLabel(ctx.t, move.to)}`,
        intent,
        disabled: !ctx.explain(intent).ok,
        ...(disabledHint(ctx, intent) ? { hint: disabledHint(ctx, intent) } : {}),
      });
    }
    entries.push(...hideEntries(ctx, cardId));
  }
  return entries;
}

/** Short label used by tests and the board ("manual:<n>" → "Activate (manual)"). */
export function strictAbilityIsManual(ability: string): boolean {
  return ability.startsWith("manual:");
}
