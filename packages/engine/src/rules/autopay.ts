/**
 * Auto-pay planner — original modules 888811 / 324758 (35_5a-hj_uv52.js:1208-1717).
 *
 * The planner is pure: it looks at the board, the card's cost (printed fields, text or an
 * ability-cost line), domain requirements, and available sources, and returns the exact
 * `payment_batch` operations the server would expand `autoPay` into.
 */
import type { BattlefieldZone, CardInstance, PlayerBoard, Room, Zone } from "@rift/protocol";
import {
  battlefieldZones,
  fieldZones,
  zoneList,
} from "../state/board";
import {
  cardForInstance,
  getCard,
  getCardByCode,
  hasEmpower,
  isSpellCardType,
  isGearCardType,
  isUnitCardType,
  normalizeCardName,
} from "../catalog";
import { battlefieldCount } from "../state/selectors";
import { battlefieldOwnerByZone } from "./victory";

export type PaymentOperation =
  | { type: "toggle_exhausted"; zone: Zone; cardId: string; expectedExhausted: boolean }
  | { type: "adjust_floating_resource"; resource: "energy" | "power"; delta: number }
  | { type: "send_rune_to_deck_bottom"; cardId: string }
  | { type: "recycle_rune_for_floating_energy"; cardId: string }
  | { type: "set_card_label"; zone: Zone; cardId: string; slot: 0 | 1 | 2; label: string };

export interface PaymentBatch {
  type: "payment_batch";
  operations: PaymentOperation[];
  paymentGroupOrigin: "auto_pay_button";
}

interface CostSpec {
  energyCost: number;
  powerCost: number;
  domains: string[];
  cardCode?: string;
  name: string;
  type?: string;
}

function finiteOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

interface CostSource {
  zone: Zone;
  cardId: string;
}

export interface AutoPayPlan {
  canAutoPay: boolean;
  energyFromFloating: number;
  energyConduitCardActions: CostSource[];
  energyRuneCardIds: string[];
  energyAndPowerCardActions: CostSource[];
  powerFromFloating: number;
  powerSealCardActions: CostSource[];
  powerLegendCardActions: CostSource[];
  powerGoldCardActions: CostSource[];
  powerRuneCardIds: string[];
  powerRuneCardIdsGrantingFloatingEnergy: string[];
}

const EMPOWERED_LABEL = "Empowered";
const VALID_DOMAINS = new Set(["body", "calm", "chaos", "fury", "mind", "order"]);
const IGNORED_DOMAINS = new Set(["unknown", "neutral"]);

function clamp99(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(99, Math.trunc(value))) : 0;
}

function normalizeDomain(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDomains(...groups: Array<string[] | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    if (!group) continue;
    for (const raw of group) {
      const domain = normalizeDomain(raw);
      if (!domain || seen.has(domain) || IGNORED_DOMAINS.has(domain)) continue;
      seen.add(domain);
      out.push(domain);
    }
  }
  return out;
}

function cardDomains(card: Partial<CardInstance>): string[] {
  const own = normalizeDomains(card.domains);
  if (own.length > 0) return own;
  const catalog = getCard(card.cardCode, card.name);
  const catalogDomains = normalizeDomains(catalog?.domains);
  if (catalogDomains.length > 0) return catalogDomains;
  const match = card.name?.match(/^([a-z]+)\s+rune$/i);
  const runeDomain = normalizeDomain(match?.[1]);
  return runeDomain ? [runeDomain] : [];
}

function cardDomain(card: Partial<CardInstance>): string | undefined {
  return cardDomains(card)[0];
}

function firstFiniteNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

/** 888811 `x` / `l`: normalize the effective cost of a card. */
export function normalizeCost(card: CardInstance): CostSpec {
  const record = getCard(card.cardCode, card.name);
  return {
    energyCost: finiteOrZero(firstFiniteNumber(card.energyCost, record?.energyCost)),
    powerCost: finiteOrZero(firstFiniteNumber(card.powerCost, record?.powerCost)),
    domains: normalizeDomains(card.domains, record?.domains),
    cardCode: card.cardCode ?? record?.id,
    name: card.name ?? record?.name ?? "",
    type: card.type ?? record?.type,
  };
}

/** 872901 `a`: lowercased resolved name. */
function resolvedName(card: Partial<CardInstance>): string {
  return (getCard(card.cardCode, card.name)?.name ?? card.name ?? "").trim().toLowerCase();
}

function isGoldToken(card: CardInstance): boolean {
  return card.source === "token" && /gold/i.test(card.name.replace(/[^a-z0-9]+/gi, "").toLowerCase());
}

function isEnergyConduit(card: CardInstance): boolean {
  return resolvedName(card) === "energy conduit";
}

function isSeal(card: CardInstance): boolean {
  return resolvedName(card).startsWith("seal of ");
}

function isHoneyfruit(card: CardInstance): boolean {
  return resolvedName(card) === "honeyfruit";
}

function isSpendableLegend(card: CardInstance, needed: "spell" | "gear"): boolean {
  if (card.type?.toLowerCase() !== "legend" && getCard(card.cardCode, card.name)?.type?.toLowerCase() !== "legend") {
    return false;
  }
  const record = getCard(card.cardCode, card.name);
  const text = (record?.text ?? card.text ?? "").trim().toLowerCase();
  return needed === "spell"
    ? text.includes("use only to play spells")
    : text.includes("use only to play gear or use gear abilities");
}

function effectiveCostForAbility(card: CardInstance, room: Room): { cost: CostSpec; isBanishedDockside: boolean } {
  const base = normalizeCost(card);
  if (card.banishedByCardId) {
    const source = findLinkedSource(room, card.banishedByCardId);
    if (source && /banish the top card[^.]*\.\s*you may play it, ignoring its energy cost/i.test(source.text ?? "")) {
      return { cost: { ...base, energyCost: 0 }, isBanishedDockside: true };
    }
  }
  return { cost: base, isBanishedDockside: false };
}

function findLinkedSource(room: Room, sourceId: string): CardInstance | undefined {
  for (const player of room.players) {
    const board = player.board;
    if (!board) continue;
    for (const zone of ["base", "champion", "legend", "battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken", "trash"] as const) {
      const found = zoneList(board, zone).find((card) => card.id === sourceId);
      if (found) return found;
    }
  }
  return undefined;
}

/** 888811 `S` / `b`: Risen Altar discount applies at a battlefield. */
export function risenAltarDiscount(room: Room, zone: Zone, card: CardInstance): boolean {
  if (!isBattlefieldZone(zone) || !isUnitCardType(card) || room.battlefieldBrushByZone?.[zone]) return false;
  const owner = battlefieldOwnerByZone(room).find((entry) => entry.zone === zone);
  const name =
    zone === "battlefieldToken" ? room.sharedBattlefieldToken?.title : owner?.player.selectedBattlefield;
  return (name ?? "").trim().toLowerCase() === "risen altar";
}

function isBattlefieldZone(zone: string): zone is BattlefieldZone {
  return ["battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"].includes(zone);
}

/** 888811 `y` / `q`: build a payment plan for a card cost. */
export function planPayment(
  board: PlayerBoard,
  cost: CostSpec,
  options: { normalBattlefieldCount?: number } = {},
): AutoPayPlan | null {
  const energyCost = clamp99(cost.energyCost);
  const powerCost = clamp99(cost.powerCost);
  if (energyCost === 0 && powerCost === 0) return null;
  const floatingEnergy = clamp99(board.floatingEnergy);
  const floatingPower = clamp99(board.floatingPower);
  const energyFromFloating = Math.min(energyCost, floatingEnergy);
  const energyRemaining = Math.max(0, energyCost - energyFromFloating);
  const powerRemaining = Math.max(0, powerCost - floatingPower);
  const domains = normalizeDomains(cost.domains);
  const domainSet = new Set(domains);
  const isSpell = isSpellCardType({ type: cost.type, name: cost.name, cardCode: cost.cardCode } as CardInstance);
  const isGear = isGearCardType({ type: cost.type, name: cost.name, cardCode: cost.cardCode } as CardInstance);
  const goldTokens: CostSource[] = [];
  const energyConduits: CostSource[] = [];
  const seals: CostSource[] = [];
  const honeyfruits: CostSource[] = [];
  const powerLegends: CostSource[] = [];

  for (const zone of fieldZones(options.normalBattlefieldCount ?? 2)) {
    for (const card of zoneList(board, zone)) {
      if (card.exhausted || card.attachedToCardId) continue;
      if (isGoldToken(card)) goldTokens.push({ zone, cardId: card.id });
      if (isEnergyConduit(card)) energyConduits.push({ zone, cardId: card.id });
      if (isSeal(card)) {
        const domain = cardDomain(card);
        if (domainSet.size === 0 || (domain && domainSet.has(domain))) {
          seals.push({ zone, cardId: card.id });
        }
      }
      if (isHoneyfruit(card)) honeyfruits.push({ zone, cardId: card.id });
    }
  }
  for (const card of board.legend) {
    if (card.exhausted || card.attachedToCardId) continue;
    const record = getCard(card.cardCode, card.name);
    const isLegend = (record?.type ?? card.type ?? "").trim().toLowerCase() === "legend";
    if (!isLegend) continue;
    if (isSpell && isSpendableLegend(card, "spell")) powerLegends.push({ zone: "legend", cardId: card.id });
    else if (isGear && isSpendableLegend(card, "gear")) powerLegends.push({ zone: "legend", cardId: card.id });
  }

  const upgradedHoneyfruits = honeyfruits.filter((source) => {
    const card = cardById(board, source.cardId);
    return !!card && isHoneyfruit(card) && (board.legendXp ?? 0) >= 6;
  });
  const honeyUsed = Math.min(energyRemaining, powerRemaining, upgradedHoneyfruits.length);
  const energyAfterHoney = energyRemaining - honeyUsed;
  const conduitUse = Math.min(energyAfterHoney, energyConduits.length);
  const energyConduitCardActions = energyConduits.slice(0, conduitUse).map(({ zone, cardId }) => ({ zone, cardId }));
  const energyAfterConduits = Math.max(0, energyAfterHoney - conduitUse);

  const readyRunes = board.runeArea.filter((rune) => !rune.exhausted);
  const matchingPowerRunes =
    powerRemaining - honeyUsed > 0 && domainSet.size > 0
      ? readyRunes.filter((rune) => {
          const domain = cardDomain(rune);
          return !!domain && domainSet.has(domain);
        })
      : [];
  const matchingIds = new Set(matchingPowerRunes.map((rune) => rune.id));
  const energyRunes = [...matchingPowerRunes, ...readyRunes.filter((rune) => !matchingIds.has(rune.id))].slice(
    0,
    energyAfterConduits,
  );
  const energyStillMissing = Math.max(0, energyAfterConduits - energyRunes.length);
  const extraHoneyfruits = Math.min(energyStillMissing, upgradedHoneyfruits.length - honeyUsed);
  const usedHoneyfruits = upgradedHoneyfruits.slice(0, honeyUsed + extraHoneyfruits);
  const energyAndPowerCardActions = usedHoneyfruits.map(({ zone, cardId }) => ({ zone, cardId }));
  const usedHoneyIds = new Set(usedHoneyfruits.map(({ cardId }) => cardId));
  const energyRuneCardIds = energyRunes.map((rune) => rune.id);
  const energyRunesSet = new Set(energyRuneCardIds);

  const runesForPower = [
    ...board.runeArea.filter((rune) => rune.exhausted && !energyRunesSet.has(rune.id)),
    ...energyRunes,
    ...board.runeArea.filter((rune) => !rune.exhausted && !energyRunesSet.has(rune.id)),
  ];
  const matchingPowerPool =
    domains.length > 0
      ? runesForPower.filter((rune) => {
          const domain = cardDomain(rune);
          return !!domain && domainSet.has(domain);
        })
      : runesForPower;

  const powerLegendCardActions = powerLegends.slice(
    0,
    Math.min(Math.max(0, powerRemaining - usedHoneyfruits.length), powerLegends.length),
  );
  let powerAfterLegends = Math.max(
    0,
    powerRemaining - usedHoneyfruits.length - powerLegendCardActions.length,
  );

  const sealCandidates = [
    ...seals,
    ...honeyfruits.filter(({ cardId }) => !usedHoneyIds.has(cardId)),
  ];
  const powerSealCardActions = sealCandidates.slice(
    0,
    Math.min(powerAfterLegends, sealCandidates.length),
  );
  powerAfterLegends = Math.max(0, powerAfterLegends - powerSealCardActions.length);

  const powerGoldCardActions = goldTokens.slice(
    0,
    Math.min(powerAfterLegends, goldTokens.length),
  );
  powerAfterLegends = Math.max(0, powerAfterLegends - powerGoldCardActions.length);

  const powerRuneCards = matchingPowerPool.slice(0, powerAfterLegends);
  const powerRuneCardIds = powerRuneCards.map((rune) => rune.id);
  const powerStillMissing = Math.max(0, powerAfterLegends - powerRuneCardIds.length);
  // 888811 `V` / `eu`: ready runes that were not already used for energy.
  const readyIds = new Set(
    readyRunes.filter((rune) => !energyRunesSet.has(rune.id)).map((rune) => rune.id),
  );
  const powerRuneCardIdsGrantingFloatingEnergy = powerRuneCardIds.filter((id) => readyIds.has(id));

  return {
    canAutoPay: energyStillMissing - extraHoneyfruits === 0 && powerStillMissing === 0,
    energyFromFloating,
    energyConduitCardActions,
    energyRuneCardIds,
    energyAndPowerCardActions,
    powerFromFloating: Math.min(powerCost, floatingPower),
    powerSealCardActions,
    powerLegendCardActions,
    powerGoldCardActions,
    powerRuneCardIds,
    powerRuneCardIdsGrantingFloatingEnergy,
  };
}

function cardById(board: PlayerBoard, id: string): CardInstance | undefined {
  for (const zone of fieldZones(3)) {
    const found = zoneList(board, zone).find((card) => card.id === id);
    if (found) return found;
  }
  return undefined;
}

/** 888811 `w` / `Y`: plan → operations (original order). */
export function planToOperations(plan: AutoPayPlan): PaymentOperation[] {
  const ops: PaymentOperation[] = [];
  if (plan.energyFromFloating > 0) {
    ops.push({ type: "adjust_floating_resource", resource: "energy", delta: -plan.energyFromFloating });
  }
  for (const source of plan.energyConduitCardActions) {
    ops.push({ type: "toggle_exhausted", zone: source.zone, cardId: source.cardId, expectedExhausted: false });
  }
  for (const source of plan.energyAndPowerCardActions) {
    ops.push({ type: "toggle_exhausted", zone: source.zone, cardId: source.cardId, expectedExhausted: false });
  }
  for (const cardId of plan.energyRuneCardIds) {
    ops.push({ type: "toggle_exhausted", zone: "runeArea", cardId, expectedExhausted: false });
  }
  for (const source of plan.powerSealCardActions) {
    ops.push({ type: "toggle_exhausted", zone: source.zone, cardId: source.cardId, expectedExhausted: false });
  }
  for (const source of plan.powerLegendCardActions) {
    ops.push({ type: "toggle_exhausted", zone: source.zone, cardId: source.cardId, expectedExhausted: false });
  }
  for (const source of plan.powerGoldCardActions) {
    ops.push({ type: "toggle_exhausted", zone: source.zone, cardId: source.cardId, expectedExhausted: false });
  }
  if (plan.powerFromFloating > 0) {
    ops.push({ type: "adjust_floating_resource", resource: "power", delta: -plan.powerFromFloating });
  }
  const recycling = new Set(plan.powerRuneCardIdsGrantingFloatingEnergy);
  for (const cardId of plan.powerRuneCardIds) {
    ops.push(
      recycling.has(cardId)
        ? { type: "recycle_rune_for_floating_energy", cardId }
        : { type: "send_rune_to_deck_bottom", cardId },
    );
  }
  return ops;
}

/* ------------------------------------------------------------------ ability-cost text */

const EMPOWER_COST = /\[empower(?:\s+(\d+))?\]/i;

function parseCostExpression(expression: string): { energyCost: number; powerRequirements: Array<string | null> } | null {
  let energyCost = 0;
  const powerRequirements: Array<string | null> = [];
  for (const match of expression.matchAll(/\[([^\]]+)\]/g)) {
    const token = match[1]?.trim().toLowerCase() ?? "";
    if (/^\d+$/.test(token)) {
      energyCost += Number.parseInt(token, 10);
      continue;
    }
    if (token === "rune") {
      powerRequirements.push(null);
      continue;
    }
    if (VALID_DOMAINS.has(token)) {
      powerRequirements.push(token);
      continue;
    }
    return null;
  }
  const leftovers = expression.replace(/\[[^\]]+\]/g, "").replace(/[\s,]/g, "");
  return leftovers.length > 0 || (energyCost === 0 && powerRequirements.length === 0)
    ? null
    : { energyCost, powerRequirements };
}

function parseAbilityCost(card: CardInstance): { headerLine: string; costs: Array<{ energyCost: number; powerRequirements: Array<string | null> }> } | null {
  const record = getCard(card.cardCode, card.name);
  const text = record?.text ?? card.text ?? "";
  let header: { line: string; inlineEnergyCost: number | null; costExpression: string } | null = null;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(EMPOWER_COST);
    if (!match || match.index === undefined) continue;
    const rest = line.slice(match.index + match[0].length);
    const dashed = /^\s*[-—]/u.test(rest);
    const expression = rest.replace(/^\s*(?:[-—]\s*)?/u, "");
    const inline = match[1] ? Number.parseInt(match[1], 10) : null;
    const bracket = expression.startsWith("[");
    const word = dashed && /^\p{L}/u.test(expression);
    if (inline !== null || bracket || word) {
      header = { line, inlineEnergyCost: inline, costExpression: bracket ? (expression.split(/[.(]/u, 1)[0] ?? "") : "" };
      break;
    }
  }
  if (!header) return null;
  if (header.inlineEnergyCost !== null) {
    return { headerLine: header.line, costs: [{ energyCost: header.inlineEnergyCost, powerRequirements: [] }] };
  }
  const costs = header.costExpression
    .split(/\s+or\s+/i)
    .map(parseCostExpression)
    .filter((cost): cost is { energyCost: number; powerRequirements: Array<string | null> } => cost !== null);
  return { headerLine: header.line, costs };
}

function applyCostDiscounts(
  cost: { energyCost: number; powerRequirements: Array<string | null> },
  headerLine: string,
  runeCount: number,
): { energyCost: number; powerRequirements: Array<string | null> } {
  const fewer = headerLine.match(
    /ability\s+costs\s+\[(\d+)\]\s+less\s+if\s+you\s+control\s+(\d+)\s+or\s+fewer\s+runes/i,
  );
  if (fewer) {
    const amount = Number.parseInt(fewer[1] ?? "0", 10);
    const threshold = Number.parseInt(fewer[2] ?? "0", 10);
    return { ...cost, energyCost: Math.max(0, cost.energyCost - (runeCount <= threshold ? amount : 0)) };
  }
  const each = headerLine.match(
    /ability\s+costs\s+\[(\d+)\]\s+less\s+for\s+each\s+rune\s+you\s+control/i,
  );
  if (each) {
    const amount = Number.parseInt(each[1] ?? "0", 10);
    return { ...cost, energyCost: Math.max(0, cost.energyCost - amount * runeCount) };
  }
  return cost;
}

function risenAltarVariants(cost: { energyCost: number; powerRequirements: Array<string | null> }) {
  const variants: Array<{ energyCost: number; powerRequirements: Array<string | null> }> = [];
  if (cost.energyCost > 0) {
    variants.push({
      energyCost: cost.energyCost - 1,
      powerRequirements: [...cost.powerRequirements],
    });
  }
  for (let index = 0; index < cost.powerRequirements.length; index += 1) {
    variants.push({
      energyCost: cost.energyCost,
      powerRequirements: cost.powerRequirements.filter((_, i) => i !== index),
    });
  }
  return variants;
}

function planComparator(a: AutoPayPlan, b: AutoPayPlan): number {
  const power = (plan: AutoPayPlan) => plan.powerRuneCardIds.length + plan.powerGoldCardActions.length;
  const sources = (plan: AutoPayPlan) =>
    plan.energyRuneCardIds.length +
    plan.powerRuneCardIdsGrantingFloatingEnergy.length +
    plan.energyConduitCardActions.length +
    plan.energyAndPowerCardActions.length +
    plan.powerSealCardActions.length +
    plan.powerLegendCardActions.length;
  return power(a) - power(b) || sources(a) - sources(b);
}

/** 888811 `p` / `b`: plan an ability cost parsed from the card text. */
export function planAbilityPayment(
  board: PlayerBoard,
  card: CardInstance,
  options: { normalBattlefieldCount?: number; risenAltarDiscount?: boolean } = {},
): AutoPayPlan | null {
  const parsed = parseAbilityCost(card);
  if (!parsed || parsed.costs.length === 0) return null;
  const record = getCard(card.cardCode, card.name);
  for (const raw of parsed.costs) {
    const discounted = applyCostDiscounts(raw, parsed.headerLine, board.runeArea.length);
    const variants = options.risenAltarDiscount ? risenAltarVariants(discounted) : [discounted];
    let bestForCost: AutoPayPlan | null = null;
    for (const variant of variants) {
      if (variant.energyCost === 0 && variant.powerRequirements.length === 0) return null;
      const usesRune = variant.powerRequirements.some((domain) => domain === null);
      const cost: CostSpec = {
        energyCost: variant.energyCost,
        powerCost: variant.powerRequirements.length,
        domains: usesRune
          ? []
          : normalizeDomains(variant.powerRequirements.filter((d): d is string => d !== null)),
        cardCode: card.cardCode ?? record?.id,
        name: card.name || record?.name || "",
        type: card.type ?? record?.type,
      };
      const plan = planPayment(board, cost, options);
      if (plan?.canAutoPay && (!bestForCost || planComparator(plan, bestForCost) < 0)) {
        bestForCost = plan;
      }
    }
    // Original `b` returns the first cost option that has a viable plan.
    if (bestForCost) return bestForCost;
  }
  return null;
}

/** 552379 `b` / `e`: Empowered label helpers. */
export function empoweredLabel(card: CardInstance): string {
  return EMPOWERED_LABEL;
}

export function empoweredSlot(card: CardInstance): 0 | 1 | 2 | null {
  if (!hasEmpower(card)) return null;
  const labels = (card.customLabels ?? [])
    .map((label) => (typeof label === "string" ? label.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean)
    .slice(0, 3);
  if (labels.length >= 3 || labels.some((label) => label.toLowerCase() === EMPOWERED_LABEL.toLowerCase())) {
    return null;
  }
  return labels.length as 0 | 1 | 2;
}

/** 888811 `M`: expand an autoPay spec into a `payment_batch` (or null). */
export function buildAutoPayPaymentBatch(
  room: Room,
  playerIndex: number,
  autoPay: { purpose: "play" | "empower"; zone: Zone; cardId: string },
): PaymentBatch | null {
  const board = room.players[playerIndex]?.board;
  if (!board) return null;
  const count = battlefieldCount(room);
  if (isBattlefieldZone(autoPay.zone) && !battlefieldZones(room.sharedBattlefieldToken, count).includes(autoPay.zone)) {
    return null;
  }
  const card = zoneList(board, autoPay.zone).find((candidate) => candidate.id === autoPay.cardId);
  if (!card || card.hidden) return null;
  const effective = autoPay.zone === "banished" ? effectiveCostForAbility(card, room).cost : normalizeCost(card);
  const plan =
    autoPay.purpose === "play"
      ? planPayment(board, effective, { normalBattlefieldCount: count })
      : planAbilityPayment(board, card, {
          normalBattlefieldCount: count,
          risenAltarDiscount: risenAltarDiscount(room, autoPay.zone, card),
        });
  if (!plan?.canAutoPay) return null;
  const operations = planToOperations(plan);
  if (autoPay.purpose === "empower") {
    const slot = empoweredSlot(card);
    if (slot === null) return null;
    operations.push({
      type: "set_card_label",
      zone: autoPay.zone,
      cardId: card.id,
      slot,
      label: EMPOWERED_LABEL,
    });
  }
  return operations.length > 0
    ? { type: "payment_batch", operations, paymentGroupOrigin: "auto_pay_button" }
    : null;
}

export { normalizeCardName };
