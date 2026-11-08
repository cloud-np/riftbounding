/**
 * Board layout metrics — verbatim port of the original board-chunk math
 * (`0xawjzm3yjpr1.js:47925-47990`, `439rnwycqsxxv.js` module 929289 and module
 * 701010 `H`). Card size is the master scale: every zone derives from it.
 */

export const CARD_ASPECT = 1.392857;
export const BASE_CARD_WIDTH_REM = 5.2;

export interface BoardRect {
  widthPx: number;
  heightPx: number;
}

export interface BoardMetrics {
  boardScale: number;
  boardRightSafetyGutterRem: number;
  cardWidthRem: number;
  cardHeightRem: number;
  battlefieldOverlapRem: number;
  chainLaneWidthRem: number;
  identityTotemWidthRem: number;
  identityTrackGapRem: number;
  identityRailPadRem: number;
  identityRailVPadRem: number;
  scoreTrackSafeBottomRem: number;
  trackNodeSizeRem: number;
  trackPlayerNudgeRem: number;
  trackOpponentNudgeRem: number;
  trackOpponentTopRem: number;
  turnControlBottomRem: number;
}

export type BoardMode = "desktop" | "touch";
export type BoardDensity = "narrow" | "regular";
export type BoardArrangement = "standard" | "phone-portrait";

export interface BoardComposition {
  arrangement: BoardArrangement;
  density: BoardDensity;
  short: boolean;
  tightRail: boolean;
  identity: "raised" | "corner";
  handControls: "above" | "beside";
  reserveHandEnd: boolean;
}

export interface BoardLayout {
  metrics: BoardMetrics & { fieldHeightRem: number };
  composition: BoardComposition;
}

export interface LayoutInput {
  board: BoardRect;
  field: BoardRect;
  mode?: BoardMode;
  cardSizeScale?: number;
  usesCompactOpponentRail?: boolean;
  rootRemPx?: number;
  phonePortrait?: boolean;
  cardHeightRem?: number;
}

const FALLBACK_BOARD: BoardRect = { widthPx: 1450, heightPx: 670 };
const SCORE_SAFE_CLEARANCE = 3.58;
const SCORE_SAFE_MIN_GAP = 0.36;
const SCORE_SAFE_BOTTOM = 0.72;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function rem(value: number, scale: number): number {
  return round3(value * scale);
}

function safeDimension(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** `p0` — score-track safe bottom (rem). */
export function scoreTrackSafeBottomRem(
  fieldHeightRem: number,
  handReserveRem: number,
  short = false,
): number {
  return Math.max(
    0,
    fieldHeightRem -
      Math.max(0, handReserveRem - SCORE_SAFE_MIN_GAP) -
      (short ? 2.75 : SCORE_SAFE_CLEARANCE) -
      (short ? 0.35 : SCORE_SAFE_BOTTOM),
  );
}

/** `H` (module 600) — phone-portrait arrangement test. */
export function isPhonePortrait(
  board: BoardRect & { layoutHeightPx?: number },
  mode: BoardMode,
): boolean {
  return (
    mode === "touch" &&
    !(board.heightPx <= board.widthPx) &&
    (board.widthPx <= 600 ||
      (!(board.widthPx > 1000) &&
        Math.max(board.heightPx, board.layoutHeightPx ?? 0) >= 1.72 * board.widthPx))
  );
}

export interface CompositionInput extends LayoutInput {
  cardHeightRem: number;
}

/** `929289 f` — arrangement/density composition. */
export function computeComposition({
  board,
  field,
  mode = "desktop",
  cardHeightRem,
  cardSizeScale = 1,
  rootRemPx = 16,
  usesCompactOpponentRail = false,
  phonePortrait,
}: CompositionInput): BoardComposition {
  const touch = mode === "touch";
  const portrait = phonePortrait ?? isPhonePortrait(board, mode);
  const narrow = board.widthPx <= 850 || portrait;
  const raisedIdentity = touch && board.widthPx <= 1000 && board.heightPx >= board.widthPx;
  const cardHeightPx = cardHeightRem * cardSizeScale * rootRemPx;
  const handBudget = 2.12 * cardHeightPx + 4 * rootRemPx;
  const fieldRemaining =
    field.heightPx - handBudget - (usesCompactOpponentRail ? 0.3 * field.heightPx : handBudget);
  const handControlsAbove = touch && field.widthPx <= 1000 && fieldRemaining >= 1.5 * cardHeightPx;

  return {
    arrangement: portrait ? "phone-portrait" : "standard",
    density: narrow ? "narrow" : "regular",
    short: board.heightPx <= 580,
    tightRail: board.heightPx <= 420,
    identity: raisedIdentity ? "raised" : "corner",
    handControls: handControlsAbove ? "above" : "beside",
    reserveHandEnd: touch && (board.widthPx >= 1000 || raisedIdentity),
  };
}

/** `ff` — metrics + composition for a measured board. */
export function computeBoardLayout(input: LayoutInput): BoardLayout {
  const board: BoardRect = {
    widthPx: safeDimension(input.board?.widthPx, FALLBACK_BOARD.widthPx),
    heightPx: safeDimension(input.board?.heightPx, FALLBACK_BOARD.heightPx),
  };
  const field: BoardRect = {
    widthPx: safeDimension(input.field?.widthPx, FALLBACK_BOARD.widthPx),
    heightPx: safeDimension(input.field?.heightPx, FALLBACK_BOARD.heightPx),
  };
  const rootRemPx = input.rootRemPx ?? 16;
  const touch = input.mode === "touch";
  const cardSizeScale = input.cardSizeScale;

  const widthPx = safeDimension(board.widthPx, FALLBACK_BOARD.widthPx);
  const heightPx = safeDimension(board.heightPx, FALLBACK_BOARD.heightPx);
  const heightRatio = heightPx / 670;
  const fit = Math.min(widthPx / 1450, heightRatio);
  const smoothT = clamp((heightRatio - 1.75) / (2.15 - 1.75), 0, 1);
  const smooth = smoothT * smoothT * (3 - 2 * smoothT);
  const blended = fit + (heightRatio - fit) * smooth;
  const capped = clamp(blended, 1, 3.1);
  const cardScaleBase =
    blended < 1
      ? Math.max(0.9, 1 + (blended - 1) * 0.35)
      : 1 + (capped - 1) * (0.58 + 0.17 * smooth);

  const phonePortrait = input.phonePortrait ?? isPhonePortrait(board, input.mode ?? "desktop");
  const layoutDensity =
    typeof cardSizeScale === "number"
      ? Math.min(
          0.65 * Math.max(1, widthPx / 1.12),
          (widthPx - 9.3 * rootRemPx) / (5.4 * BASE_CARD_WIDTH_REM * rootRemPx),
          (heightPx - 190) / 1200,
        )
      : Math.min((widthPx - 64) / 900, (heightPx - 48) / 680);
  const verticalFit =
    (heightPx - 7 * rootRemPx) / (4.8 * BASE_CARD_WIDTH_REM * CARD_ASPECT * rootRemPx);
  const boardScale = Number(
    Math.max(0.35, Math.min(cardScaleBase, touch ? layoutDensity : verticalFit)).toFixed(4),
  );
  const safetyScale = clamp(1 + (boardScale - 1) * 0.52, 1, 1.24);
  const identityScale =
    !touch && boardScale < 1
      ? boardScale
      : clamp(1 + (boardScale - 1) * 0.48, touch ? 0.7 : 1, 1.24);

  const cardWidthRem = rem(BASE_CARD_WIDTH_REM, boardScale);
  const battlefieldOverlapRem = rem(3.2, boardScale);
  const fieldHeightRem = field.heightPx / rootRemPx;
  const rawBottom = Math.max(0, 0.4 * fieldHeightRem - battlefieldOverlapRem);
  const safeBottom = Math.max(0, rawBottom - SCORE_SAFE_MIN_GAP);

  const metrics: BoardMetrics = {
    boardScale,
    boardRightSafetyGutterRem: rem(1.5, safetyScale),
    cardWidthRem,
    cardHeightRem: Number((cardWidthRem * CARD_ASPECT).toFixed(3)),
    battlefieldOverlapRem,
    chainLaneWidthRem: rem(15.5, safetyScale),
    identityTotemWidthRem: rem(1.86, identityScale),
    identityTrackGapRem: rem(0.22, identityScale),
    identityRailPadRem: rem(0.64, identityScale),
    identityRailVPadRem: rem(0.62, identityScale),
    scoreTrackSafeBottomRem: Number(safeBottom.toFixed(3)),
    trackNodeSizeRem: rem(2.7, identityScale * (touch ? 0.88 : 1)),
    trackPlayerNudgeRem: rem(0.48, identityScale),
    trackOpponentNudgeRem: rem(0.4, identityScale),
    trackOpponentTopRem: rem(0.62, identityScale),
    turnControlBottomRem: Number(safeBottom.toFixed(3)),
  };

  const composition = computeComposition({
    ...input,
    board,
    field,
    mode: input.mode ?? "desktop",
    cardHeightRem: metrics.cardHeightRem,
    cardSizeScale,
    rootRemPx,
    usesCompactOpponentRail: input.usesCompactOpponentRail ?? false,
    phonePortrait,
  });

  return {
    metrics: { ...metrics, fieldHeightRem },
    composition,
  };
}

/* ------------------------------------------------------------ score track */

export interface ScoreTrackLayout {
  playerValues: number[];
  opponentValues: number[];
  nodeCount: number;
  rowCount: number;
  trackNodeSize: string;
  trackColumnGap: string;
  trackRailWidth: string;
  trackRowSize: string;
  trackHeight: string;
  trackRailHeight: string;
}

function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return "1";
  return Number(value.toFixed(4)).toString();
}

/** `272907 w` — score-track sizing/values (0..victory score zig-zag rail). */
export function computeScoreTrack(input: {
  maxValue: number;
  baseTrackNodeSize: string;
  baseTrackNodeSizeRem?: number;
  maxTrackStackBottomRem?: number;
  trackStaticTopOffsetRem?: number;
}): ScoreTrackLayout {
  const maxValue = Number.isFinite(input.maxValue)
    ? Math.max(0, Math.trunc(input.maxValue))
    : 0;
  const playerValues = Array.from({ length: maxValue + 1 }, (_, index) => maxValue - index);
  const opponentValues = Array.from({ length: maxValue + 1 }, (_, index) => index);
  const nodeCount = playerValues.length;
  const rowCount = 1 + Math.ceil(Math.max(0, nodeCount - 1) / 2);

  const scaleForCount = (() => {
    const over = Math.max(0, Math.trunc(nodeCount) - 9);
    if (over === 0) return { nodeSizeScale: 1, rowSizeScale: 1 };
    return {
      nodeSizeScale: Math.max(0.9, 1 - 0.05 * over),
      rowSizeScale: Math.max(0.86, 1 - 0.06 * over),
    };
  })();

  let fitScale = 1;
  if (
    typeof input.baseTrackNodeSizeRem === "number" &&
    Number.isFinite(input.baseTrackNodeSizeRem) &&
    input.baseTrackNodeSizeRem > 0 &&
    typeof input.maxTrackStackBottomRem === "number" &&
    Number.isFinite(input.maxTrackStackBottomRem) &&
    typeof input.trackStaticTopOffsetRem === "number" &&
    Number.isFinite(input.trackStaticTopOffsetRem)
  ) {
    const available = input.maxTrackStackBottomRem - input.trackStaticTopOffsetRem;
    const needed =
      input.baseTrackNodeSizeRem *
      scaleForCount.nodeSizeScale *
      (1.42 * rowCount * scaleForCount.rowSizeScale + 0.5);
    if (available > 0 && needed > 0) fitScale = Math.min(1, available / needed);
  }

  const nodeScale = scaleForCount.nodeSizeScale * fitScale;
  const rowScale = 1.42 * nodeScale * scaleForCount.rowSizeScale;

  return {
    playerValues,
    opponentValues,
    nodeCount,
    rowCount,
    trackNodeSize: `calc(${input.baseTrackNodeSize} * ${compactNumber(nodeScale)})`,
    trackColumnGap: `calc(${input.baseTrackNodeSize} * ${compactNumber(0.34 * nodeScale)})`,
    trackRailWidth: "calc(var(--track-node-size) * 2 + var(--score-track-column-gap))",
    trackRowSize: `calc(${input.baseTrackNodeSize} * ${compactNumber(rowScale)})`,
    trackHeight: `calc(var(--track-row-size) * ${rowCount})`,
    trackRailHeight: `calc(var(--track-row-size) * ${rowCount} + var(--identity-rail-vpad) * 2)`,
  };
}

/* --------------------------------------------------------------- hand fan */

export interface HandFanCard {
  id: string;
}

export interface HandFanSlot {
  card: HandFanCard;
  sourceIndex: number;
  fanRotationDeg: number;
  isLayoutHoldingCard: boolean;
  isHiddenSourceCard: boolean;
  virtualIndex: number;
  style: Record<string, string | number | undefined>;
}

export interface HandFanLayout {
  dropMidpointsRem: number[];
  railStyle: Record<string, string>;
  cardWidthRem: number;
  cardHeightRem: number;
  slots: HandFanSlot[];
  gapStyle: Record<string, string | number> | null;
}

/** `H` (module 701010) — natural spread step for `count` cards. */
export function naturalSpreadStep(count: number, cardWidthRem: number): number {
  if (count <= 1) return cardWidthRem;
  const stepFor = (n: number) =>
    Math.min(
      cardWidthRem - 0.28,
      5.6 - (5.6 - 0.95) * Math.max(0, Math.min(1, (n - 5) / 22)),
    );
  let bestTotal = cardWidthRem;
  let step = stepFor(2);
  for (let n = 2; n <= count; n += 1) {
    const candidate = stepFor(n);
    const total = cardWidthRem + candidate * (n - 1);
    if (total >= bestTotal) {
      step = candidate;
      bestTotal = total;
      continue;
    }
    step = (bestTotal - cardWidthRem) / (n - 1);
  }
  return step;
}

/** `793143 l` — the complete hand-fan geometry. */
export function computeHandFan(input: {
  cards: HandFanCard[];
  fanPresentation?: "standard" | "compact";
  suppressedCardIds?: Set<string>;
  previewGapIndex?: number;
  layoutHoldingCardId?: string;
  hiddenSourceCardId?: string;
  layoutCardWidthRem?: number;
  railWidthRem?: number;
  maxRailWidthRem?: number;
  remoteHoveredCardId?: string | null;
  handEntryAnimations?: Set<string>;
}): HandFanLayout {
  const {
    cards,
    fanPresentation = "standard",
    suppressedCardIds,
    previewGapIndex,
    layoutHoldingCardId: holdingId,
    hiddenSourceCardId: hiddenId,
    layoutCardWidthRem = BASE_CARD_WIDTH_REM,
    railWidthRem,
    maxRailWidthRem,
    remoteHoveredCardId = null,
    handEntryAnimations,
  } = input;

  const visible = suppressedCardIds
    ? cards.filter((card) => !suppressedCardIds.has(card.id))
    : cards;
  const hasGap = typeof previewGapIndex === "number";
  const holdingIndex = hasGap && holdingId
    ? visible.findIndex((card) => card.id === holdingId)
    : -1;
  const withoutHolding = holdingIndex >= 0
    ? visible.filter((card) => card.id !== holdingId)
    : visible;
  const gapIndex = hasGap
    ? Math.max(0, Math.min(previewGapIndex ?? 0, withoutHolding.length))
    : -1;
  const packedCount = hasGap ? withoutHolding.length + 1 : visible.length;
  const centre = (packedCount - 1) / 2;
  const cardWidth =
    layoutCardWidthRem -
    (railWidthRem == null || maxRailWidthRem == null
      ? 0
      : Math.max(0, Math.min(1, (maxRailWidthRem - railWidthRem - 0.1) / 8))) *
      ((layoutCardWidthRem / 5.2) * 0.28);
  const cardHeight = CARD_ASPECT * cardWidth;

  const stepFor = (count: number) => {
    const natural = naturalSpreadStep(count, cardWidth);
    if (railWidthRem == null || count <= 1) return natural;
    const packed = Math.max(
      (layoutCardWidthRem / 5.2) * 0.58,
      (Math.max(cardWidth, railWidthRem - 0.7) - cardWidth) / (count - 1),
    );
    return Math.min(natural, packed);
  };
  const step = stepFor(packedCount);
  const compact = fanPresentation === "compact";
  const maxRotation = (count: number) =>
    compact ? 0.7 : count <= 3 ? 2.6 : Math.max(1.9, 7.2 - 0.2 * count);
  const rotationLimit = maxRotation(packedCount);
  const arcDepth = packedCount <= 3 ? 4.2 : Math.max(2.6, 10.4 - 0.24 * packedCount);
  const depth = compact ? 0.15 : arcDepth;
  const baseOffset = compact ? 0.4 : 16;
  const gapAngleFactor = hasGap && centre > 0 ? (gapIndex - centre) / centre : 0;

  const slots = visible.map((card, sourceIndex) => {
    const isHolding = card.id === holdingId;
    const isHidden = card.id === hiddenId;
    let virtualIndex = sourceIndex;
    if (hasGap && isHolding) virtualIndex = gapIndex;
    else if (hasGap) {
      const withoutHoldingIndex =
        holdingIndex >= 0 && sourceIndex > holdingIndex ? sourceIndex - 1 : sourceIndex;
      virtualIndex = withoutHoldingIndex >= gapIndex ? withoutHoldingIndex + 1 : withoutHoldingIndex;
    }
    const offset = virtualIndex - centre;
    const angleFactor = centre > 0 ? offset / centre : 0;
    const rotation = angleFactor * rotationLimit;
    return {
      card,
      sourceIndex,
      fanRotationDeg: rotation,
      isLayoutHoldingCard: isHolding,
      isHiddenSourceCard: isHidden,
      virtualIndex,
      style: {
        "--fan-offset-x": `${offset * step}rem`,
        zIndex: isHidden ? 0 : handEntryAnimations?.has(card.id) ? 200 : virtualIndex + 1,
        "--fan-translate-y": `${baseOffset + angleFactor * angleFactor * depth}px`,
        "--fan-rotate": `${rotation}deg`,
        "--fan-hover-raise":
          remoteHoveredCardId === card.id ? (compact ? "0px" : "-12px") : undefined,
        visibility: isHidden ? "hidden" : undefined,
        pointerEvents: isHidden ? "none" : undefined,
      },
    };
  });

  const gapStyle = hasGap
    ? {
        "--fan-offset-x": `${(gapIndex - centre) * step}rem`,
        zIndex: 0,
        "--fan-translate-y": `${baseOffset + gapAngleFactor * gapAngleFactor * depth}px`,
        "--fan-rotate": `${gapAngleFactor * rotationLimit}deg`,
      }
    : null;

  const bottomOverflow =
    baseOffset + depth + (Math.sin((rotationLimit * Math.PI) / 180) * cardWidth * 16) / 2;

  return {
    dropMidpointsRem: visible.map((_, index) => {
      const offset = index - (visible.length - 1) / 2;
      const rotation = maxRotation(visible.length);
      return (
        offset * stepFor(visible.length) +
        (Math.sin(((visible.length > 1 ? (offset / ((visible.length - 1) / 2)) * rotation : 0) * Math.PI) / 180) *
          cardHeight) /
          2
      );
    }),
    railStyle: {
      "--hand-fan-bottom-overflow": `${bottomOverflow}px`,
      "--card-width": `${cardWidth}rem`,
      "--card-height": `${cardHeight}rem`,
    },
    cardWidthRem: cardWidth,
    cardHeightRem: cardHeight,
    slots,
    gapStyle,
  };
}
