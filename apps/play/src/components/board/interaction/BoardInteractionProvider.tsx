"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { buildAutoPayPaymentBatch, strictExplainIllegal, strictLegalIntents, strictWhoMayAct } from "@rift/engine";
import { getCard, getCardByName } from "@rift/cards";
import { createTranslator, rulesReasonText } from "@rift/i18n";
import type { CardInstance, Room, RoomPlayer, Verdict, WireAction, Zone } from "@rift/protocol";

import type { CardEvent } from "../card/types";
import {
  createDragOriginSession,
  beginDragOrigin,
  restoreDragOrigin,
  sweepDragOrigins,
  DRAG_PICKUP_DELAY_MS,
} from "../drag/drag-origin";
import { DragGhostLayer } from "../drag/DragGhostLayer";
import {
  DRAG_ORIGIN_PERSIST_ATTRIBUTE,
  dragEffectFor,
  readDragPayload,
  writeDragPayload,
  type DragKind,
  type DragPayload,
  type DragSession,
} from "../drag/drag-types";
import { buildDropIntent, defaultChainDestination, isChainAddable } from "../drag/drop-intents";
import { computeOrderedDropIndex, engineCanDrop, type DropRect } from "../drag/drop-legality";
import { HoverCardPreviewLayer } from "../hover/HoverCardPreviewLayer";
import { HOVER_PREVIEW_DELAY_MS, hoverPreviewSize } from "../hover/hover-metrics";
import { TargetArrowOverlay } from "../hover/TargetArrowOverlay";
import { BOARD_EMOTE_EVENT } from "../emotes/EmoteFlightLayer";
import { EmoteGlyph } from "../emotes/EmoteGlyph";
import { DEFAULT_EMOTE_WHEEL, EMOTE_BY_ID } from "../emotes/emote-catalog";
import { ContextMenu } from "../menus/ContextMenu";
import { CounterEditor } from "../menus/CounterEditor";
import { LabelEditor } from "../menus/LabelEditor";
import { LabelWheel } from "../menus/LabelWheel";
import { PileViewer } from "../menus/PileViewer";
import {
  LABEL_PRESETS,
  customLabelPreset,
  normalizeCardLabel,
  type LabelPreset,
} from "../menus/label-presets";
import {
  buildCardMenu,
  buildHandMenu,
  buildPileMenu,
  buildZoneMenu,
  type CardMenuId,
  type HandMenuId,
  type PileMenuId,
  type PileSlot,
} from "../menus/menu-builders";
import type { BoardSlotProps, GameActionIntent } from "../slot-types";
import { BoardInteractionContext } from "./context";
import { useLocalGameSettings } from "../settings/settings-values";
import { playBoardSound } from "./sfx";
import { StrictPlayDialog } from "../strict/StrictPlayDialog";
import {
  buildStrictCardMenu,
  buildStrictHandMenu,
  strictDropAttempt,
  strictViewFromLegal,
  strictManualWindowFor,
  strictEndTurnIntent,
  strictPlayIntent,
  type StrictBoardView,
  type StrictMenuContext,
  type StrictMenuEntry,
} from "../strict/strict-interaction";
import { isStrictRoom, strictActorFor } from "../strict/strict-model";
import type {
  ArmedAction,
  BoardInteractionValue,
  BoardMenuState,
  CounterEditorRequest,
  DragUiState,
  DropZoneHandlers,
  HoverPreviewState,
  LabelEditorRequest,
  MenuSectionDescriptor,
  PileViewerRequest,
  PreviewAnchorInput,
  ShowCardPreviewOptions,
} from "./types";

const t = createTranslator("en");

const EMPTY_SELECTION: ReadonlySet<string> = new Set();
const NON_ACTIVE_INPUT = /^(input|textarea|select)$/i;

export interface BoardInteractionProviderProps extends BoardSlotProps {
  children: ReactNode;
  /** Multi-seat local play: dispatch an intent as another controlled seat. */
  dispatchAs?: (playerId: string, intent: GameActionIntent) => void;
  /** Perspective switch callback (space+v / switch seat button). */
  onSwitchPerspective?: () => void;
  /** Publish a card ping to the opponent over realtime presence. */
  onCardPing?: (cardId: string) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    NON_ACTIVE_INPUT.test(target.tagName) ||
    target.isContentEditable ||
    !!target.closest("input, textarea, select, [contenteditable='true']")
  );
}

function platformModifierPressed(
  event: KeyboardEvent | React.KeyboardEvent | React.MouseEvent,
): boolean {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
  return isMac ? event.metaKey : event.ctrlKey;
}

function isUnit(card: CardInstance | null | undefined): boolean {
  return !!card?.type && /unit/i.test(card.type);
}

function isSpell(card: CardInstance | null | undefined): boolean {
  return !!card?.type && /spell/i.test(card.type);
}

function isGear(card: CardInstance | null | undefined): boolean {
  return !!card?.type && /gear/i.test(card.type);
}

function hasHiddenKeyword(card: CardInstance | null | undefined): boolean {
  return (card?.keywords ?? []).some((keyword) => keyword.toLowerCase() === "hidden");
}

function isBaron(card: CardInstance | null | undefined): boolean {
  return card?.name?.trim().toLowerCase() === "baron nashor";
}

function catalogCardInstance(name: string): CardInstance | null {
  const catalog = getCardByName(name);
  if (!catalog) return null;
  return {
    id: `catalog:${catalog.id}`,
    name: catalog.name,
    source:
      catalog.type === "Rune"
        ? "rune"
        : catalog.type === "Legend"
          ? "legend"
          : catalog.type === "Battlefield"
            ? "battlefield"
            : "mainDeck",
    exhausted: false,
    createdAt: 0,
    cardCode: catalog.id,
    type: catalog.type,
    text: catalog.text,
    energyCost: catalog.energyCost,
    powerCost: catalog.powerCost,
    might: catalog.might,
    domains: catalog.domains,
    keywords: catalog.keywords,
    rarity: catalog.rarity,
    set: catalog.set,
    isPlaceholder: false,
  };
}

function readCardSize(): { width: number; height: number } {
  if (typeof document === "undefined") return { width: 83, height: 116 };
  const board = document.querySelector<HTMLElement>(".gb-board");
  const rootRem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const style = board ? getComputedStyle(board) : null;
  const rawWidth = style?.getPropertyValue("--card-width").trim() || "5.2rem";
  const rawHeight = style?.getPropertyValue("--card-height").trim() || "7.243rem";
  const width = Number.parseFloat(rawWidth) * (rawWidth.endsWith("rem") ? rootRem : 1);
  const height = Number.parseFloat(rawHeight) * (rawHeight.endsWith("rem") ? rootRem : 1);
  return {
    width: Number.isFinite(width) && width > 0 ? width : 83,
    height: Number.isFinite(height) && height > 0 ? height : 116,
  };
}

function transparentDragImage(dataTransfer: DataTransfer): void {
  try {
    const image = new Image();
    image.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    image.style.position = "fixed";
    image.style.left = "0";
    image.style.top = "0";
    image.style.width = "1px";
    image.style.height = "1px";
    image.style.opacity = "0.01";
    document.body.appendChild(image);
    dataTransfer.setDragImage(image, 0, 0);
    window.setTimeout(() => image.remove(), 0);
  } catch {
    // setDragImage unsupported (some WebKit builds) — the custom ghost still renders.
  }
}

function rectFromAnchor(anchor: PreviewAnchorInput): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} | null {
  if (!anchor) return null;
  if (typeof HTMLElement !== "undefined" && anchor instanceof HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }
  if ("clientX" in anchor) {
    return {
      left: anchor.clientX,
      top: anchor.clientY,
      right: anchor.clientX,
      bottom: anchor.clientY,
      width: 0,
      height: 0,
    };
  }
  return anchor as {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
}

function zoneCards(room: Room, player: RoomPlayer | undefined, zone: Zone): CardInstance[] {
  if (!player?.board) return [];
  return (player.board[zone] as CardInstance[] | undefined) ?? [];
}

function opponentOf(room: Room, viewerId: string): RoomPlayer | undefined {
  return room.players.find((player) => player.id !== viewerId && !player.leftAt);
}

function settingsFor(room: Room, playerId: string) {
  return (
    room.boardSettingsByPlayerId?.[playerId] ?? {
      showLegendXpCounter: false,
      stopAtBeginningPhase: false,
      skipDrawPhase: false,
      autoScoreFromHold: true,
    }
  );
}

export function BoardInteractionProvider({
  state,
  viewerId,
  controlledPlayerIds,
  dispatch,
  mode,
  children,
  dispatchAs,
  onSwitchPerspective,
  actionClock,
  onBoardEmote,
  onCardPing,
}: BoardInteractionProviderProps) {
  const localSettings = useLocalGameSettings();
  const previewSizeScale = localSettings.previewSizePercent / 100;
  const viewer = useMemo(
    () => state.players.find((player) => player.id === viewerId) ?? state.players[0],
    [state.players, viewerId],
  );
  const opponent = useMemo(() => opponentOf(state, viewerId), [state, viewerId]);
  const viewerIndex = state.players.findIndex((player) => player.id === viewerId);

  const [preview, setPreview] = useState<HoverPreviewState | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [armedAction, setArmedActionState] = useState<ArmedAction>({ kind: "none" });
  const [labelSelection, setLabelSelection] = useState<LabelPreset | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<ReadonlySet<string>>(EMPTY_SELECTION);
  const [drag, setDrag] = useState<DragUiState>({
    active: false,
    kind: null,
    sourceZone: null,
    sourceOwner: null,
    sourceCardId: null,
    overZone: null,
    overOwner: null,
    toIndex: null,
  });
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const [menu, setMenu] = useState<BoardMenuState | null>(null);
  const [labelEditor, setLabelEditor] = useState<LabelEditorRequest | null>(null);
  const [counterEditor, setCounterEditor] = useState<CounterEditorRequest | null>(null);
  const [pileViewer, setPileViewer] = useState<PileViewerRequest | null>(null);
  const [pingedCardId, setPingedCardId] = useState<string | null>(null);
  const [emoteWheelOpen, setEmoteWheelOpen] = useState(false);
  const [diceWheelOpen, setDiceWheelOpen] = useState(false);
  const [strictPlay, setStrictPlay] = useState<{
    cardId: string;
    location?: string;
    hide?: boolean;
  } | null>(null);
  const [strictNotice, setStrictNotice] = useState<{
    text: string;
    code: string;
    rule?: string;
  } | null>(null);

  const previewTimerRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const dragSessionRef = useRef<DragSession | null>(null);
  const dragOriginRef = useRef(createDragOriginSession());
  const dragTargetElementRef = useRef<HTMLElement | null>(null);
  const dragUiRef = useRef(drag);
  const suppressClickUntilRef = useRef(0);
  const lastClickRef = useRef<{ cardId: string; at: number } | null>(null);
  const heldKeyboardModeRef = useRef<string | null>(null);
  const touchLongPressRef = useRef<{
    timer: number;
    fired: boolean;
    card: CardInstance;
    zone: Zone;
    owner: "self" | "opponent";
    startX: number;
    startY: number;
    startedDrag: boolean;
  } | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const strictNoticeTimerRef = useRef<number | null>(null);
  const zoneContextMenuHandlerRef = useRef<
    (zone: string, owner: "self" | "opponent", event: React.MouseEvent) => void
  >(() => {});

  const canAct = state.phase === "in_game";
  const viewerControlled = controlledPlayerIds.includes(viewerId);
  const interactive = canAct && viewerControlled;

  /* ------------------------------------------------------------- strict view */
  // Strict rooms drive every gameplay interaction from `legalIntents`. Sandbox rooms leave
  // `strictView` null, so every branch below falls through to the original behaviour.
  const controlled = useMemo(
    () => (controlledPlayerIds.length > 0 ? controlledPlayerIds : [viewerId]),
    [controlledPlayerIds, viewerId],
  );
  const strictWho = useMemo(() => strictWhoMayAct(state), [state]);
  const strictActor = useMemo(
    () => strictActorFor(strictWho, viewerId, controlled),
    [strictWho, viewerId, controlled],
  );
  const strictLegal = useMemo(
    () => (isStrictRoom(state) ? strictLegalIntents(state, strictActor) : null),
    [state, strictActor],
  );
  const strictView = useMemo<StrictBoardView | null>(
    () => (strictLegal ? strictViewFromLegal(strictActor, strictLegal) : null),
    [strictLegal, strictActor],
  );
  const strictManual = !!strictView && strictManualWindowFor(state, strictActor);
  /** True while strict routing owns the board (sandbox fallback stays for the §6.4 window). */
  const strictActive = !!strictView && !strictManual;

  const showStrictNotice = useCallback((code: string, rule: string | undefined, text?: string) => {
    if (strictNoticeTimerRef.current !== null) window.clearTimeout(strictNoticeTimerRef.current);
    setStrictNotice({
      text: text ?? rulesReasonText(t, code, rule),
      code,
      ...(rule ? { rule } : {}),
    });
    strictNoticeTimerRef.current = window.setTimeout(() => {
      strictNoticeTimerRef.current = null;
      setStrictNotice(null);
    }, 6000);
  }, []);

  const showStrictRejection = useCallback(
    (intent: WireAction) => {
      if (!strictView) return;
      let verdict: Verdict;
      try {
        verdict = strictExplainIllegal(state, strictView.actorId, intent);
      } catch {
        verdict = { ok: false, code: "illegal_action", rule: "contract:§5" };
      }
      if (verdict.ok) return;
      showStrictNotice(verdict.code, verdict.rule);
    },
    [state, strictView, showStrictNotice],
  );

  const showStrictModeAction = useCallback(
    (actionType: string) => {
      showStrictNotice(
        "strict_mode_action",
        "contract:§4",
        `${rulesReasonText(t, "strict_mode_action", "contract:§4")} (${actionType})`,
      );
    },
    [showStrictNotice],
  );

  const sendStrictIntent = useCallback(
    (intent: WireAction) => {
      if (!strictView) return;
      if (strictView.actorId !== viewerId && dispatchAs) {
        dispatchAs(strictView.actorId, intent);
        return;
      }
      dispatch(intent);
    },
    [strictView, viewerId, dispatchAs, dispatch],
  );

  useEffect(() => {
    dragUiRef.current = drag;
  }, [drag]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
      if (pingTimerRef.current !== null) window.clearTimeout(pingTimerRef.current);
      if (strictNoticeTimerRef.current !== null) window.clearTimeout(strictNoticeTimerRef.current);
      if (touchLongPressRef.current) window.clearTimeout(touchLongPressRef.current.timer);
    };
  }, []);

  const closeTransientUi = useCallback(() => {
    setMenu(null);
    setLabelEditor(null);
    setCounterEditor(null);
    setPileViewer(null);
    setEmoteWheelOpen(false);
    setDiceWheelOpen(false);
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setPreview(null);
    setHoveredCardId(null);
  }, []);

  const setArmedAction = useCallback((next: ArmedAction) => {
    setArmedActionState(next);
    setSelectedCardIds(
      next.kind === "target"
        ? new Set([next.sourceCardId])
        : next.kind === "equip"
          ? new Set([next.equipmentCardId])
          : EMPTY_SELECTION,
    );
    if (next.kind !== "label") setLabelSelection(null);
  }, []);

  const showCardPreview = useCallback(
    (card: CardInstance, anchor?: PreviewAnchorInput, options: ShowCardPreviewOptions = {}) => {
      const rect = rectFromAnchor(anchor);
      if (!rect) return;
      if (!options.allowMissingArt && card.isPlaceholder) return;
      if (card.source === "rune") return;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scale = options.scale ?? previewSizeScale;
      const landscape = options.landscape ?? false;
      const size = hoverPreviewSize({ viewportWidth, viewportHeight, landscape, scale });
      setPreview({
        card,
        anchor: rect,
        preferredSide: options.preferredSide,
        x: Math.max(8, Math.min(rect.right + 12, viewportWidth - size.outerWidth - 8)),
        y: Math.max(8, Math.min(rect.top, viewportHeight - size.outerHeight - 8)),
        landscape,
        rotationDeg: options.rotationDeg ?? 0,
        scale,
        ...size,
        rulesHeight: 0,
      });
    },
    [previewSizeScale],
  );

  const showCardPreviewByName = useCallback(
    (name: string, anchor?: PreviewAnchorInput, options?: ShowCardPreviewOptions) => {
      const card = catalogCardInstance(name);
      if (card) showCardPreview(card, anchor, options);
    },
    [showCardPreview],
  );

  const hideCardPreview = useCallback(() => {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setPreview(null);
    setHoveredCardId(null);
  }, []);

  const scheduleCardPreview = useCallback(
    (card: CardInstance, event: CardEvent, delay = HOVER_PREVIEW_DELAY_MS) => {
      if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
      setHoveredCardId(card.id);
      if (event.zone === "runeArea") return;
      const anchor =
        event.anchorRect ??
        (event.clientX !== undefined && event.clientY !== undefined
          ? {
              left: event.clientX,
              top: event.clientY,
              right: event.clientX,
              bottom: event.clientY,
              width: 0,
              height: 0,
            }
          : null);
      if (!anchor) return;
      previewTimerRef.current = window.setTimeout(() => {
        previewTimerRef.current = null;
        showCardPreview(card, anchor);
      }, delay);
    },
    [showCardPreview],
  );

  /** Dice, arrows/pings, card labels and board settings are the only sandbox actions strict allows. */
  const STRICT_COSMETIC_ACTIONS = useMemo<ReadonlySet<string>>(
    () =>
      new Set([
        "roll_die",
        "target_arrow_add",
        "target_arrow_remove",
        "target_arrow_remove_from_source",
        "target_arrow_clear_all",
        "set_show_legend_xp_counter",
        "set_stop_at_beginning_phase",
        "set_skip_draw_phase",
        "set_auto_score_from_hold",
        "set_battlefield_brush",
        "set_card_label",
      ]),
    [],
  );

  const sendIntent = useCallback(
    (intent: GameActionIntent, owner: "self" | "opponent" = "self") => {
      // Strict rooms: never put a sandbox gameplay action on the wire. Interactions that have a
      // strict equivalent branch before this; anything else is explained instead of failing
      // silently on the server (`strict_mode_action`).
      if (strictActive && !intent.type.startsWith("rules_") && !STRICT_COSMETIC_ACTIONS.has(intent.type)) {
        showStrictModeAction(intent.type);
        return;
      }
      if (owner === "opponent" && opponent && dispatchAs) {
        dispatchAs(opponent.id, intent);
        return;
      }
      dispatch(intent);
    },
    [dispatch, dispatchAs, opponent, strictActive, STRICT_COSMETIC_ACTIONS, showStrictModeAction],
  );

  const findCard = useCallback(
    (owner: "self" | "opponent", zone: Zone, cardId: string): CardInstance | null => {
      const player = owner === "self" ? viewer : opponent;
      return zoneCards(state, player, zone).find((card) => card.id === cardId) ?? null;
    },
    [state, viewer, opponent],
  );

  const resolveBoardCard = useCallback(
    (cardId: string): { card: CardInstance; zone: Zone; owner: "self" | "opponent" } | null => {
      for (const [owner, player] of [["self", viewer] as const, ["opponent", opponent] as const]) {
        if (!player?.board) continue;
        for (const zone of [
          "hand",
          "base",
          "battlefieldA",
          "battlefieldToken",
          "battlefieldB",
          "battlefieldC",
          "trash",
          "banished",
          "champion",
          "legend",
          "runeArea",
        ] as Zone[]) {
          const card = zoneCards(state, player, zone).find((candidate) => candidate.id === cardId);
          if (card) return { card, zone, owner };
        }
      }
      return null;
    },
    [state, viewer, opponent],
  );

  const handleEndTurn = useCallback(() => {
    if (!interactive) return;
    if (strictActive) {
      if (!strictView?.legal.canEndTurn) {
        showStrictRejection(strictEndTurnIntent());
        return;
      }
      playBoardSound("ui_click");
      sendStrictIntent(strictEndTurnIntent());
      return;
    }
    if (state.activeTurnPlayerId && !controlledPlayerIds.includes(state.activeTurnPlayerId)) return;
    const observed = {
      turnNumber: state.turnNumber ?? 0,
      activePlayerId: state.activeTurnPlayerId ?? viewerId,
      activeStep: state.activeTurnStep ?? "main",
    };
    playBoardSound("ui_click");
    dispatch(
      (state.activeTurnStep === "beginning"
        ? { type: "end_beginning_phase", observed }
        : { type: "end_turn", observed }) as GameActionIntent,
    );
  }, [
    interactive,
    strictActive,
    strictView,
    showStrictRejection,
    sendStrictIntent,
    state,
    controlledPlayerIds,
    viewerId,
    dispatch,
  ]);

  const handleSwitchPerspective = useCallback(() => {
    playBoardSound("ui_click");
    onSwitchPerspective?.();
  }, [onSwitchPerspective]);

  const triggerPing = useCallback(
    (cardId: string) => {
      setPingedCardId(cardId);
      playBoardSound("ping");
      if (pingTimerRef.current !== null) window.clearTimeout(pingTimerRef.current);
      pingTimerRef.current = window.setTimeout(() => setPingedCardId(null), 2400);
      onCardPing?.(cardId);
    },
    [onCardPing],
  );

  const pingCard = triggerPing;

  const openMenu = useCallback(
    (x: number, y: number, sections: MenuSectionDescriptor[], title?: string) => {
      setMenu({ x, y, sections: sections.filter((section) => section.items.length > 0), title });
    },
    [],
  );

  const buildSections = useCallback(
    (
      entries: Array<{
        group: number;
        label: string;
        hint?: string;
        disabled?: boolean;
        tone?: "default" | "danger" | "positive";
        id: string;
        onSelect: () => void;
      }>,
    ): MenuSectionDescriptor[] => {
      const groups = new Map<number, MenuSectionDescriptor>();
      for (const entry of entries) {
        let section = groups.get(entry.group);
        if (!section) {
          section = { items: [] };
          groups.set(entry.group, section);
        }
        section.items.push({
          id: entry.id,
          label: entry.label,
          hint: entry.hint,
          disabled: entry.disabled,
          tone: entry.tone,
          onSelect: entry.onSelect,
        });
      }
      return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, section]) => section);
    },
    [],
  );

  const dispatchMenuIntent = useCallback(
    (intent: GameActionIntent, owner: "self" | "opponent" = "self") => {
      playBoardSound("card_click");
      sendIntent(intent, owner);
    },
    [sendIntent],
  );

  const viewPile = useCallback(
    (slot: "trash" | "banished", owner: "self" | "opponent" = "self") => {
      setPileViewer({ slot, owner });
      setMenu(null);
    },
    [],
  );

  const playCard = useCallback(
    (zone: Zone, card: CardInstance, owner: "self" | "opponent") => {
      if (!interactive) return;
      const canActAsOwner = owner === "self" || (mode !== "multiplayer" && !!dispatchAs);
      if (!canActAsOwner) return;
      if (strictActive && strictView) {
        const detail = strictView.playableById.get(card.id);
        const hideable = strictView.hideableById.get(card.id);
        if (detail || hideable) {
          // Options dialog: Location (355.2), optional additional costs (355.1.a), explicit
          // payment plan (356/357) and Hide (811.1.b) all build one `rules_play`.
          setStrictPlay({ cardId: card.id });
          return;
        }
        playBoardSound("card_click");
        showStrictRejection(strictPlayIntent({ cardId: card.id }));
        return;
      }
      playBoardSound("card_play");
      if (zone === "hand") {
        if (isSpell(card)) {
          sendIntent(
            {
              type: "chain_add",
              from: "hand",
              cardId: card.id,
              clientEntryId: `chain-${owner === "self" ? viewerId : (opponent?.id ?? viewerId)}-${card.id}-${crypto.randomUUID?.() ?? `${Date.now()}`}`,
            } as GameActionIntent,
            owner,
          );
          return;
        }
        const to: Zone =
          isBaron(card) && isUnit(card) && state.sharedBattlefieldToken?.active
            ? "battlefieldToken"
            : "base";
        sendIntent(
          { type: "move_card", from: "hand", to, cardId: card.id } as GameActionIntent,
          owner,
        );
        return;
      }
      if (zone === "champion") {
        sendIntent(
          { type: "move_card", from: "champion", to: "base", cardId: card.id } as GameActionIntent,
          owner,
        );
        return;
      }
      if (zone === "deck") {
        sendIntent(
          { type: "take_card_from_deck", cardId: card.id, to: "base" } as GameActionIntent,
          owner,
        );
        return;
      }
      if (zone === "trash" || zone === "banished") {
        if (isSpell(card)) {
          sendIntent(
            {
              type: "chain_add",
              from: zone,
              cardId: card.id,
              clientEntryId: `chain-${viewerId}-${card.id}-${Date.now()}`,
            } as GameActionIntent,
            owner,
          );
        } else {
          sendIntent(
            { type: "move_card", from: zone, to: "base", cardId: card.id } as GameActionIntent,
            owner,
          );
        }
      }
    },
    [interactive, mode, dispatchAs, sendIntent, viewerId, opponent, state.sharedBattlefieldToken, strictActive, strictView, showStrictRejection],
  );

  const toggleExhausted = useCallback(
    (zone: Zone, card: CardInstance, owner: "self" | "opponent") => {
      playBoardSound("card_exhaust");
      sendIntent(
        {
          type: "toggle_exhausted",
          zone,
          cardId: card.id,
          expectedExhausted: !!card.exhausted,
        } as GameActionIntent,
        owner,
      );
    },
    [sendIntent],
  );

  const strictMenuContext = useMemo<StrictMenuContext | null>(() => {
    if (!strictView) return null;
    return {
      room: state,
      view: strictView,
      t,
      explain: (intent) => strictExplainIllegal(state, strictView.actorId, intent),
    };
  }, [state, strictView]);

  const strictEntryGroup = (entry: StrictMenuEntry): number => {
    if (entry.id === "ping") return 0;
    if (entry.id.startsWith("activate")) return 1;
    if (entry.id.startsWith("move")) return 2;
    if (entry.id.startsWith("hide")) return 3;
    return 0;
  };

  const openStrictMenu = useCallback(
    (event: CardEvent, entries: StrictMenuEntry[]) => {
      const sections = buildSections(
        entries.map((entry) => ({
          id: entry.id,
          group: strictEntryGroup(entry),
          label: entry.label,
          ...(entry.hint ? { hint: entry.hint } : {}),
          ...(entry.tone ? { tone: entry.tone } : {}),
          disabled: entry.disabled,
          onSelect: () => {
            if (entry.action === "ping") {
              triggerPing(event.card.id);
              return;
            }
            if (entry.openPlay) {
              setStrictPlay(entry.openPlay);
              return;
            }
            if (entry.intent) {
              playBoardSound("card_click");
              sendStrictIntent(entry.intent);
            }
          },
        })),
      );
      openMenu(
        event.clientX ?? pointerRef.current.x,
        event.clientY ?? pointerRef.current.y,
        sections,
        event.card.name,
      );
      playBoardSound("ui_click");
    },
    [buildSections, openMenu, triggerPing, sendStrictIntent],
  );

  const openCardMenu = useCallback(
    (event: CardEvent, owner: "self" | "opponent") => {
      if (!viewer) return;
      const isSelf = owner === "self";
      if (strictActive && strictMenuContext) {
        if (event.zone === "hand") {
          if (!isSelf) return;
          const entries = buildStrictHandMenu(strictMenuContext, event.card.id);
          if (entries.length === 0) {
            showStrictRejection(strictPlayIntent({ cardId: event.card.id }));
            return;
          }
          openStrictMenu(event, entries);
          return;
        }
        openStrictMenu(event, buildStrictCardMenu(strictMenuContext, event.card.id, event.zone));
        return;
      }
      if (isSelf && armedAction.kind === "counter") {
        sendIntent(
          {
            type: "adjust_card_counter",
            zone: event.zone,
            cardId: event.card.id,
            counter: armedAction.counter,
            delta: -1,
          } as GameActionIntent,
          owner,
        );
        setArmedAction({ kind: "none" });
        return;
      }
      if (isSelf && event.zone === "hand") {
        const autoPayAvailable = (() => {
          if (viewerIndex < 0) return false;
          return !!buildAutoPayPaymentBatch(state, viewerIndex, {
            purpose: "play",
            zone: "hand",
            cardId: event.card.id,
          });
        })();
        const entries = buildHandMenu({
          card: event.card,
          canAct: interactive,
          autoPayAvailable,
          revealAllowed: true,
        });
        const run = (id: HandMenuId) => {
          switch (id) {
            case "play":
              playCard("hand", event.card, owner);
              return;
            case "play-hidden":
              openPlayHiddenMenu("hand", event.card, owner);
              return;
            case "chain":
              dispatchMenuIntent(
                {
                  type: "chain_add",
                  from: "hand",
                  cardId: event.card.id,
                  clientEntryId: `chain-${viewerId}-${event.card.id}-${Date.now()}`,
                } as GameActionIntent,
                owner,
              );
              return;
            case "trash":
              dispatchMenuIntent(
                {
                  type: "move_card",
                  from: "hand",
                  to: "trash",
                  cardId: event.card.id,
                } as GameActionIntent,
                owner,
              );
              return;
            case "banish":
              dispatchMenuIntent(
                {
                  type: "move_card",
                  from: "hand",
                  to: "banished",
                  cardId: event.card.id,
                } as GameActionIntent,
                owner,
              );
              return;
            case "reveal":
              dispatchMenuIntent(
                {
                  type: "set_card_revealed_to_opponent",
                  zone: "hand",
                  cardId: event.card.id,
                  revealed: !event.card.revealedToOpponent,
                } as GameActionIntent,
                owner,
              );
              return;
            case "auto-pay": {
              const batch = buildAutoPayPaymentBatch(state, viewerIndex, {
                purpose: "play",
                zone: "hand",
                cardId: event.card.id,
              });
              if (batch) dispatchMenuIntent(batch as GameActionIntent, owner);
              return;
            }
          }
        };
        openMenu(
          event.clientX ?? pointerRef.current.x,
          event.clientY ?? pointerRef.current.y,
          buildSections(
            entries.map((entry) => ({
              ...entry,
              label: t(entry.labelKey) ?? entry.labelKey,
              onSelect: () => run(entry.id),
            })),
          ),
          event.card.name,
        );
        playBoardSound("ui_click");
        return;
      }
      const arrows = state.targetArrowsByPlayer?.[isSelf ? viewerId : (opponent?.id ?? "")] ?? [];
      const equipTargetAvailable = [
        viewer.board?.base ?? [],
        ...(viewer.board ? [viewer.board.battlefieldA] : []),
      ]
        .flat()
        .some((candidate) => !candidate.hidden && isUnit(candidate));
      const entries = buildCardMenu({
        zone: event.zone,
        card: event.card,
        isSelf,
        canAct: interactive && isSelf,
        targetingAvailable:
          isSelf &&
          (event.zone === "base" ||
            event.zone.startsWith("battlefield") ||
            event.zone === "champion" ||
            event.zone === "legend"),
        hasTargetArrows: arrows.some((arrow) => arrow.sourceCardId === event.card.id),
        equipTargetAvailable: equipTargetAvailable && isGear(event.card),
        empowerable:
          isUnit(event.card) && (event.zone === "base" || event.zone.startsWith("battlefield")),
        revealAllowed:
          isSelf &&
          (event.zone === "hand" || !!event.card.hidden || !!event.card.revealedToOpponent),
        isNeeko: /neeko/i.test(event.card.name),
        isOrianna: /^orianna$/i.test(event.card.name),
      });
      const run = (id: CardMenuId) => runCardMenu(id, event, owner);
      openMenu(
        event.clientX ?? pointerRef.current.x,
        event.clientY ?? pointerRef.current.y,
        buildSections(
          entries.map((entry) => ({
            ...entry,
            id: entry.id,
            label: t(entry.labelKey) ?? entry.labelKey,
            hint: entry.disabled ? undefined : entry.hint,
            onSelect: () => run(entry.id),
          })),
        ),
        event.card.name,
      );
      playBoardSound("ui_click");
    },
    [
      viewer,
      viewerIndex,
      state,
      viewerId,
      opponent,
      interactive,
      openMenu,
      buildSections,
      playCard,
      dispatchMenuIntent,
      playBoardSound,
      armedAction,
      sendIntent,
      setArmedAction,
      strictActive,
      strictMenuContext,
      openStrictMenu,
    ],
  );

  const runCardMenu = useCallback(
    (id: CardMenuId, event: CardEvent, owner: "self" | "opponent") => {
      const card = event.card;
      const zone = event.zone;
      switch (id) {
        case "ping": {
          triggerPing(card.id);
          return;
        }
        case "recycle":
          dispatchMenuIntent(
            { type: "send_rune_to_deck_bottom", cardId: card.id } as GameActionIntent,
            owner,
          );
          return;
        case "tap":
          playCard(zone, card, owner);
          return;
        case "play-hidden":
          openPlayHiddenMenu(zone, card, owner);
          return;
        case "chain":
          dispatchMenuIntent(
            {
              type: "chain_add",
              from: zone,
              cardId: card.id,
              clientEntryId: `chain-${viewerId}-${card.id}-${Date.now()}`,
            } as GameActionIntent,
            owner,
          );
          return;
        case "give-control": {
          const targets = state.players.filter(
            (player) => player.id !== viewerId && !player.leftAt,
          );
          if (targets.length <= 1) {
            dispatchMenuIntent(
              {
                type: "transfer_card_control",
                zone,
                cardId: card.id,
                ...(targets[0] ? { targetPlayerId: targets[0].id } : {}),
              } as GameActionIntent,
              owner,
            );
          } else {
            openMenu(pointerRef.current.x, pointerRef.current.y, [
              {
                title: t("sim.tablet.giveControl") ?? "Give control",
                items: targets.map((target) => ({
                  id: target.id,
                  label: target.name,
                  onSelect: () =>
                    dispatchMenuIntent(
                      {
                        type: "transfer_card_control",
                        zone,
                        cardId: card.id,
                        targetPlayerId: target.id,
                      } as GameActionIntent,
                      owner,
                    ),
                })),
              },
            ]);
          }
          return;
        }
        case "trash":
          dispatchMenuIntent(
            { type: "move_card", from: zone, to: "trash", cardId: card.id } as GameActionIntent,
            owner,
          );
          return;
        case "banish":
          dispatchMenuIntent(
            { type: "move_card", from: zone, to: "banished", cardId: card.id } as GameActionIntent,
            owner,
          );
          return;
        case "target":
          setArmedAction({
            kind: "target",
            sourceCardId: card.id,
            sourceCardName: card.name,
            sourceAnchor: "board",
          });
          return;
        case "clear-targets":
          dispatchMenuIntent(
            {
              type: "target_arrow_remove_from_source",
              sourceCardId: card.id,
              sourceAnchor: "board",
            } as GameActionIntent,
            owner,
          );
          return;
        case "equip":
          setArmedAction({ kind: "equip", equipmentCardId: card.id });
          return;
        case "animate-gear":
          dispatchMenuIntent(
            {
              type: "animate_orianna_gear",
              legendId: card.id,
              zone,
              cardId: card.id,
            } as GameActionIntent,
            owner,
          );
          return;
        case "choose-neeko-legend":
          dispatchMenuIntent(
            {
              type: "choose_neeko_legend",
              neekoCardId: card.id,
              zone,
              legendId: null,
            } as GameActionIntent,
            owner,
          );
          return;
        case "empower":
          dispatchMenuIntent(
            { type: "adjust_card_might", zone, cardId: card.id, delta: 1 } as GameActionIntent,
            owner,
          );
          return;
        case "disempower":
          dispatchMenuIntent(
            { type: "adjust_card_might", zone, cardId: card.id, delta: -1 } as GameActionIntent,
            owner,
          );
          return;
        case "reveal":
          dispatchMenuIntent(
            {
              type: "set_card_revealed_to_opponent",
              zone,
              cardId: card.id,
              revealed: !card.revealedToOpponent,
            } as GameActionIntent,
            owner,
          );
          return;
        case "remove-buff":
          dispatchMenuIntent(
            { type: "adjust_card_might", zone, cardId: card.id, delta: -1 } as GameActionIntent,
            owner,
          );
          return;
      }
    },
    [dispatchMenuIntent, openMenu, playCard, setArmedAction, state, viewerId, triggerPing],
  );

  const openPlayHiddenMenu = useCallback(
    (zone: Zone, card: CardInstance, owner: "self" | "opponent") => {
      const zones: Array<{ zone: Zone; label: string }> = [
        { zone: "battlefieldA", label: t("sim.tablet.battlefieldA") ?? "Battlefield A" },
        { zone: "battlefieldB", label: t("sim.tablet.battlefieldB") ?? "Battlefield B" },
      ];
      if (state.gameVariant && state.gameVariant !== "duel") {
        zones.push({
          zone: "battlefieldC",
          label: t("sim.tablet.battlefieldC") ?? "Battlefield C",
        });
      }
      if (state.sharedBattlefieldToken?.active) {
        zones.push({
          zone: "battlefieldToken",
          label: t("sim.tablet.battlefieldToken") ?? "Baron Pit",
        });
      }
      openMenu(pointerRef.current.x, pointerRef.current.y, [
        {
          title: t("sim.tablet.chooseHiddenBattlefield") ?? "Choose battlefield!",
          items: zones.map((entry) => ({
            id: entry.zone,
            label: entry.label,
            onSelect: () =>
              dispatchMenuIntent(
                {
                  type: "move_card",
                  from: zone,
                  to: entry.zone,
                  cardId: card.id,
                  asHidden: true,
                } as GameActionIntent,
                owner,
              ),
          })),
        },
      ]);
    },
    [dispatchMenuIntent, openMenu, state.gameVariant, state.sharedBattlefieldToken],
  );

  const completeTarget = useCallback(
    (target: CardInstance, zone: Zone, owner: "self" | "opponent") => {
      if (armedAction.kind !== "target") return;
      const sourceId = armedAction.sourceCardId;
      if (sourceId === target.id) return;
      const sourceAnchor = armedAction.sourceAnchor;
      const targetAnchor: "board" | "chain" = owner === "self" ? "board" : "board";
      const arrows = state.targetArrowsByPlayer?.[viewerId] ?? [];
      const existing = arrows.find(
        (arrow) =>
          arrow.sourceCardId === sourceId &&
          arrow.targetCardId === target.id &&
          arrow.sourceAnchor === sourceAnchor &&
          arrow.targetAnchor === targetAnchor,
      );
      playBoardSound("card_click");
      sendIntent(
        existing
          ? ({
              type: "target_arrow_remove",
              sourceCardId: sourceId,
              targetCardId: target.id,
              sourceAnchor,
              targetAnchor,
            } as GameActionIntent)
          : ({
              type: "target_arrow_add",
              sourceCardId: sourceId,
              targetCardId: target.id,
              sourceAnchor,
              targetAnchor,
            } as GameActionIntent),
      );
    },
    [armedAction, state.targetArrowsByPlayer, viewerId, sendIntent],
  );

  const handleCardClick = useCallback(
    (event: CardEvent) => {
      if (Date.now() < suppressClickUntilRef.current) return;
      const owner = event.owner;
      const card = event.card;
      const zone = event.zone;
      const isSelf = owner === "self";
      const canActAsOwner = interactive && (isSelf || (mode !== "multiplayer" && !!dispatchAs));

      if (
        event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        canActAsOwner &&
        !strictActive &&
        isChainAddable(zone, card) &&
        !card.hidden
      ) {
        playBoardSound("card_click");
        sendIntent(
          {
            type: "chain_add",
            from: zone,
            cardId: card.id,
            clientEntryId: `chain-${viewerId}-${card.id}-${Date.now()}`,
          } as GameActionIntent,
          owner,
        );
        return;
      }

      if (armedAction.kind === "target") {
        completeTarget(card, zone, owner);
        return;
      }
      if (armedAction.kind === "counter" && canActAsOwner && !strictActive) {
        const isUnitCard = isUnit(card);
        sendIntent(
          {
            type: "adjust_card_counter",
            zone,
            cardId: card.id,
            counter: armedAction.counter,
            delta: 1,
            ...(armedAction.counter === "white" && isUnitCard && !card.whiteCounter
              ? { initializeAtUnitMight: true }
              : {}),
          } as GameActionIntent,
          owner,
        );
        playBoardSound("card_click");
        setArmedAction({ kind: "none" });
        return;
      }
      if (armedAction.kind === "buff" && canActAsOwner && !strictActive) {
        if (isUnit(card) && (zone === "base" || zone.startsWith("battlefield"))) {
          sendIntent(
            { type: "adjust_card_might", zone, cardId: card.id, delta: 1 } as GameActionIntent,
            owner,
          );
          playBoardSound("card_click");
        }
        setArmedAction({ kind: "none" });
        return;
      }
      if (armedAction.kind === "duplicate" && canActAsOwner && !strictActive) {
        sendIntent({ type: "duplicate_card", zone, cardId: card.id } as GameActionIntent, owner);
        setArmedAction({ kind: "none" });
        return;
      }
      if (armedAction.kind === "transfer_control" && canActAsOwner && !strictActive) {
        const target = opponent;
        if (target) {
          sendIntent(
            {
              type: "transfer_card_control",
              zone,
              cardId: card.id,
              targetPlayerId: target.id,
            } as GameActionIntent,
            owner,
          );
        }
        setArmedAction({ kind: "none" });
        return;
      }
      if (armedAction.kind === "equip" && canActAsOwner && !strictActive) {
        if (isUnit(card)) {
          sendIntent(
            {
              type: "equip_card",
              equipmentCardId: armedAction.equipmentCardId,
              unitCardId: card.id,
            } as GameActionIntent,
            owner,
          );
          setArmedAction({ kind: "none" });
        }
        return;
      }
      if (armedAction.kind === "label" && canActAsOwner) {
        if (!labelSelection) return;
        const preset = labelSelection;
        const used = (card.customLabels ?? []).map((label) => label.toLowerCase());
        let slot: 0 | 1 | 2 = 0;
        const free = [0, 1, 2].find((index) => !(card.customLabels ?? [])[index]) as
          0 | 1 | 2 | undefined;
        if (free !== undefined) slot = free;
        else slot = 2;
        const existing = (card.customLabels ?? [])[slot];
        const counted =
          preset.id !== "buff" && !!existing?.toLowerCase().startsWith(preset.label.toLowerCase());
        sendIntent(
          {
            type: "set_card_label",
            zone,
            cardId: card.id,
            slot,
            label: counted
              ? `${preset.label} ${(Number.parseInt((existing ?? "").split(" ").at(-1) ?? "0", 10) || 0) + 1}`
              : preset.label,
            ...(counted ? { countDelta: 1 as const } : {}),
          } as GameActionIntent,
          owner,
        );
        void used;
        setArmedAction({ kind: "none" });
        return;
      }
      if (armedAction.kind === "ping" && canActAsOwner) {
        triggerPing(card.id);
        setArmedAction({ kind: "none" });
        return;
      }
      if (strictActive) {
        if (!canActAsOwner) {
          if (isSelf && interactive) scheduleCardPreview(card, event, 0);
          return;
        }
        if (zone === "hand" || zone === "champion") {
          playCard(zone, card, owner);
          return;
        }
        if (zone === "trash" || zone === "banished") {
          viewPile(zone, owner);
          return;
        }
        if (zone === "base" || zone.startsWith("battlefield") || zone === "legend") {
          // Left click opens the strict menu (Activate / Move / Hide); the menu item sends the
          // exact `rules_*` intent. Right click uses the same builder.
          openCardMenu(event, owner);
          return;
        }
        if (zone === "runeArea") {
          openCardMenu(event, owner);
          return;
        }
        showStrictModeAction("move_card");
        return;
      }
      if (!canActAsOwner) {
        if (isSelf && interactive) {
          // Self but the phase is not in_game: preview only.
          scheduleCardPreview(card, event, 0);
        }
        return;
      }

      if (zone === "hand") {
        playCard(zone, card, owner);
        return;
      }
      if (zone === "champion") {
        playCard(zone, card, owner);
        return;
      }
      if (zone === "trash" || zone === "banished") {
        viewPile(zone, owner);
        return;
      }
      if (zone === "legend") {
        if (isSpell(card)) {
          sendIntent(
            {
              type: "chain_add",
              from: "legend",
              cardId: card.id,
              clientEntryId: `chain-${viewerId}-${card.id}-${Date.now()}`,
            } as GameActionIntent,
            owner,
          );
        }
        return;
      }
      if (zone === "runeArea") {
        toggleExhausted(zone, card, owner);
        return;
      }
      if (zone === "base" || zone.startsWith("battlefield")) {
        if (card.hidden) {
          if (isSpell(card)) {
            sendIntent(
              {
                type: "chain_add",
                from: zone,
                cardId: card.id,
                clientEntryId: `chain-${viewerId}-${card.id}-${Date.now()}`,
              } as GameActionIntent,
              owner,
            );
          } else {
            sendIntent(
              { type: "set_card_hidden", zone, cardId: card.id, hidden: false } as GameActionIntent,
              owner,
            );
          }
          return;
        }
        toggleExhausted(zone, card, owner);
      }
    },
    [
      interactive,
      mode,
      dispatchAs,
      armedAction,
      completeTarget,
      sendIntent,
      labelSelection,
      playCard,
      viewPile,
      toggleExhausted,
      scheduleCardPreview,
      viewerId,
      triggerPing,
      strictActive,
      openCardMenu,
      showStrictModeAction,
    ],
  );

  const handleCardDoubleClick = useCallback(
    (event: CardEvent) => {
      if (!interactive) return;
      if (event.owner !== "self" && !dispatchAs) return;
      if (event.zone === "hand") {
        playCard("hand", event.card, event.owner);
        return;
      }
    },
    [interactive, dispatchAs, playCard],
  );

  const handleCardEvent = useCallback(
    (event: CardEvent) => {
      if (event.type === "hover") {
        if (event.pointerType && event.pointerType !== "mouse") return;
        if (event.zone === "runeArea") {
          setHoveredCardId(event.card.id);
          return;
        }
        scheduleCardPreview(event.card, event);
        if (event.zone === "hand") playBoardSound("card_hover");
        return;
      }
      if (event.type === "hoverEnd") {
        hideCardPreview();
        return;
      }
      if (event.type === "context") {
        if (event.shiftKey) return;
        if ((event.ctrlKey || event.metaKey) && event.owner === "self" && interactive) {
          if (
            event.zone === "hand" ||
            event.zone === "base" ||
            event.zone.startsWith("battlefield")
          ) {
            if (strictActive) {
              showStrictModeAction("move_card");
              return;
            }
            sendIntent({
              type: "move_card",
              from: event.zone,
              to: "banished",
              cardId: event.card.id,
            } as GameActionIntent);
            return;
          }
        }
        openCardMenu(event, event.owner);
        return;
      }
      if (event.type === "doubleClick") {
        handleCardDoubleClick(event);
        return;
      }
      if (event.type === "select") {
        const now = Date.now();
        const last = lastClickRef.current;
        lastClickRef.current = { cardId: event.card.id, at: now };
        if (last && last.cardId === event.card.id && now - last.at < 260) {
          handleCardDoubleClick(event);
          return;
        }
        if (event.longPress) return;
        handleCardClick(event);
      }
    },
    [
      scheduleCardPreview,
      hideCardPreview,
      openCardMenu,
      handleCardDoubleClick,
      handleCardClick,
      interactive,
      sendIntent,
      strictActive,
      showStrictModeAction,
    ],
  );

  const handleTouchLongPress = useCallback(
    (event: CardEvent) => {
      if (event.owner !== "self" && mode === "multiplayer") return;
      suppressClickUntilRef.current = Date.now() + 500;
      showCardPreview(
        event.card,
        event.anchorRect ?? {
          clientX: event.clientX ?? pointerRef.current.x,
          clientY: event.clientY ?? pointerRef.current.y,
        },
      );
      setHoveredCardId(event.card.id);
      window.setTimeout(() => {
        openCardMenu(
          {
            ...event,
            clientX: event.clientX ?? pointerRef.current.x,
            clientY: event.clientY ?? pointerRef.current.y,
          },
          event.owner,
        );
      }, 180);
    },
    [mode, showCardPreview, openCardMenu],
  );

  /* ------------------------------------------------------------ drag & drop */

  const setDropTargetElement = useCallback((element: HTMLElement | null) => {
    if (dragTargetElementRef.current && dragTargetElementRef.current !== element) {
      dragTargetElementRef.current.classList.remove("dragDropTarget");
      dragTargetElementRef.current.removeAttribute("data-drag-over");
    }
    dragTargetElementRef.current = element;
    if (element) {
      element.classList.add("dragDropTarget");
      element.setAttribute("data-drag-over", "true");
    }
  }, []);

  const clearDropTarget = useCallback(() => {
    setDropTargetElement(null);
  }, [setDropTargetElement]);

  const beginDragSession = useCallback(
    (input: {
      kind: DragKind;
      payload: DragPayload;
      card: CardInstance | null;
      owner: "self" | "opponent";
      event: {
        clientX: number;
        clientY: number;
        timeStamp: number;
        dataTransfer?: DataTransfer | null;
      };
      originElement: HTMLElement | null;
    }) => {
      const { width, height } = readCardSize();
      const session: DragSession = {
        kind: input.kind,
        payload: input.payload,
        card: input.card,
        owner: input.owner,
        originElement: input.originElement,
        cardWidthPx: width,
        cardHeightPx: height,
        startX: input.event.clientX,
        startY: input.event.clientY,
        startTimestamp: input.event.timeStamp,
      };
      dragSessionRef.current = session;
      if (input.event.dataTransfer) {
        writeDragPayload(input.event.dataTransfer, input.kind, input.payload);
        input.event.dataTransfer.effectAllowed = "copyMove";
        transparentDragImage(input.event.dataTransfer);
      }
      // The original mounts the ghost one rAF later (`startTransition`), so the
      // drag source is not mutated synchronously inside `dragstart` (mutating it
      // makes Chromium's drag loop stall).
      window.requestAnimationFrame(() => {
        if (dragSessionRef.current !== session) return;
        setDragSession(session);
        setDrag({
          active: true,
          kind: input.kind,
          sourceZone: "zone" in input.payload ? (input.payload.zone as string) : null,
          sourceOwner: input.owner,
          sourceCardId: "cardId" in input.payload ? (input.payload.cardId ?? null) : null,
          overZone: null,
          overOwner: null,
          toIndex: null,
        });
        dragOriginRef.current.token += 1;
        beginDragOrigin(dragOriginRef.current, input.originElement, DRAG_PICKUP_DELAY_MS);
        document.querySelector(".gb-board")?.setAttribute("data-board-dragging", "true");
        playBoardSound("ui_click");
      });
    },
    [],
  );

  const endDragSession = useCallback(() => {
    const session = dragSessionRef.current;
    if (session) {
      restoreDragOrigin(dragOriginRef.current, { revealOriginOnNextFrame: true });
      if (session.originElement) {
        session.originElement.removeAttribute(DRAG_ORIGIN_PERSIST_ATTRIBUTE);
      }
    }
    dragSessionRef.current = null;
    setDragSession(null);
    setDrag({
      active: false,
      kind: null,
      sourceZone: null,
      sourceOwner: null,
      sourceCardId: null,
      overZone: null,
      overOwner: null,
      toIndex: null,
    });
    clearDropTarget();
    document.querySelector(".gb-board")?.setAttribute("data-board-dragging", "false");
    sweepDragOrigins(document);
  }, [clearDropTarget]);

  const handleCardDragStart = useCallback(
    (event: CardEvent, native: React.DragEvent<HTMLElement>) => {
      const owner = event.owner;
      if (owner === "opponent" && !dispatchAs) {
        native.preventDefault();
        return;
      }
      if (event.zone === "legend") {
        native.preventDefault();
        return;
      }
      native.dataTransfer.effectAllowed = "copyMove";
      beginDragSession({
        kind: "boardCard",
        payload: {
          zone: event.zone,
          cardId: event.card.id,
          exhausted: !!event.exhausted,
          hidden: !!event.faceDown,
          hiddenBattlefieldDropKind:
            !event.faceDown && hasHiddenKeyword(event.card)
              ? isSpell(event.card)
                ? "spell"
                : isGear(event.card)
                  ? "gear"
                  : "unit"
              : undefined,
        },
        card: event.card,
        owner,
        event: native,
        originElement: native.currentTarget instanceof HTMLElement ? native.currentTarget : null,
      });
    },
    [beginDragSession, dispatchAs],
  );

  const handlePileDragStart = useCallback(
    (
      slot: "mainDeck" | "runeDeck",
      owner: "self" | "opponent",
      card: CardInstance | null,
      event: React.DragEvent,
    ) => {
      if (!card) {
        event.preventDefault();
        return;
      }
      beginDragSession({
        kind: "mainDeckCard",
        payload: { cardId: card.id, zone: slot === "runeDeck" ? "runeDeck" : "deck" },
        card,
        owner,
        event,
        originElement: event.currentTarget instanceof HTMLElement ? event.currentTarget : null,
      });
    },
    [beginDragSession],
  );

  const handleBattlefieldMarkerDragStart = useCallback(
    (zone: Zone, owner: "self" | "opponent", event: React.DragEvent<HTMLElement>) => {
      beginDragSession({
        kind: "battlefieldMarker",
        payload: { zone, cardId: `battlefield-marker:${zone}` },
        card: null,
        owner,
        event,
        originElement: event.currentTarget instanceof HTMLElement ? event.currentTarget : null,
      });
    },
    [beginDragSession],
  );

  const zoneFromElement = useCallback(
    (element: HTMLElement | null): { zone: string; owner: "self" | "opponent" } | null => {
      if (!element) return null;
      const zoneElement = element.closest<HTMLElement>("[data-drop-zone-root], [data-pile-slot]");
      if (!zoneElement) return null;
      const pile = zoneElement.dataset.pileSlot;
      const zone = pile ?? zoneElement.dataset.dropZoneRoot ?? "";
      if (!zone) return null;
      const ownerRaw =
        zoneElement.dataset.zoneOwner ??
        element.closest<HTMLElement>("[data-zone-owner]")?.dataset.zoneOwner;
      const owner: "self" | "opponent" = ownerRaw === "opponent" ? "opponent" : "self";
      return { zone, owner };
    },
    [],
  );

  const orderedRects = useCallback((zoneElement: HTMLElement): DropRect[] => {
    const cards = [
      ...zoneElement.querySelectorAll<HTMLElement>("button[data-card-id][data-drop-zone]"),
    ].filter(
      (element) => element.closest("[data-drop-zone-root], [data-pile-slot]") === zoneElement,
    );
    return cards.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    });
  }, []);

  const cardUnderPointer = useCallback(
    (clientX: number, clientY: number): CardInstance | null => {
      if (typeof document === "undefined") return null;
      const element = document.elementFromPoint(clientX, clientY);
      const cardElement = element?.closest<HTMLElement>("[data-card-id][data-drop-zone]");
      const cardId = cardElement?.dataset.cardId;
      if (!cardId) return null;
      return resolveBoardCard(cardId)?.card ?? null;
    },
    [resolveBoardCard],
  );

  const strictDropForSession = useCallback(
    (
      session: DragSession,
      targetZone: string,
      targetOwner: "self" | "opponent",
    ): ReturnType<typeof strictDropAttempt> => {
      if (!strictView || session.kind !== "boardCard") return null;
      const payload = session.payload as { zone: Zone; cardId: string };
      return strictDropAttempt({
        view: strictView,
        sourceZone: payload.zone,
        cardId: payload.cardId,
        targetZone,
        targetOwner,
      });
    },
    [strictView],
  );

  const updateDragOver = useCallback(
    (zone: string, owner: "self" | "opponent", event: React.DragEvent<HTMLElement>) => {
      const session = dragSessionRef.current;
      if (!session) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = dragEffectFor(session.kind, session.payload);
      }
      const target = event.currentTarget;
      let toIndex: number | null = null;
      if (
        [
          "hand",
          "base",
          "battlefieldA",
          "battlefieldB",
          "battlefieldC",
          "battlefieldToken",
          "runeArea",
        ].includes(zone)
      ) {
        const rects = orderedRects(target);
        if (rects.length > 0) {
          toIndex = computeOrderedDropIndex(rects, event.clientX, event.clientY, "horizontal");
        } else {
          toIndex = 0;
        }
      }
      const strictAttempt = strictActive ? strictDropForSession(session, zone, owner) : null;
      const intent = strictActive
        ? (strictAttempt?.intent ?? null)
        : buildDropIntent({
            source: { kind: session.kind, payload: session.payload, card: session.card },
            targetZone: zone as Parameters<typeof buildDropIntent>[0]["targetZone"],
            targetOwner: owner,
            viewerId,
            actorPlayerId: owner === "self" ? viewerId : (opponent?.id ?? viewerId),
            toIndex: toIndex ?? undefined,
            shiftKey: event.shiftKey,
            asHidden:
              armedAction.kind === "play_hidden" && session.card
                ? armedAction.cardId === session.card.id
                : false,
            targetCard: cardUnderPointer(event.clientX, event.clientY),
          });
      const legal = strictActive
        ? !!strictAttempt?.legal
        : intent
          ? engineCanDrop(state, owner === "self" ? viewerId : (opponent?.id ?? viewerId), intent)
          : false;
      if (legal) setDropTargetElement(target);
      else clearDropTarget();
      if (!legal && session.kind === "boardCard") {
        // Keep the ghost alive but do not highlight an illegal destination.
      }
      setDrag({
        active: true,
        kind: session.kind,
        sourceZone: "zone" in session.payload ? (session.payload.zone as string) : null,
        sourceOwner: session.owner,
        sourceCardId: "cardId" in session.payload ? (session.payload.cardId ?? null) : null,
        overZone: intent ? zone : null,
        overOwner: intent ? owner : null,
        toIndex: intent ? toIndex : null,
      });
    },
    [
      orderedRects,
      setDropTargetElement,
      clearDropTarget,
      viewerId,
      opponent,
      armedAction,
      state,
      cardUnderPointer,
      strictActive,
      strictDropForSession,
    ],
  );

  const completeDrop = useCallback(
    (input: {
      zone: string;
      owner: "self" | "opponent";
      toIndex: number | null;
      shiftKey: boolean;
      clientX: number;
      clientY: number;
    }) => {
      const session = dragSessionRef.current;
      if (!session) return;
      if (strictActive) {
        const attempt = strictDropForSession(session, input.zone, input.owner);
        if (attempt?.legal) {
          if (input.zone === "base" || input.zone.startsWith("battlefield")) {
            playBoardSound("card_play");
          } else {
            playBoardSound("card_click");
          }
          sendStrictIntent(attempt.intent);
        } else if (attempt?.reason) {
          showStrictNotice(attempt.reason.code, attempt.reason.rule);
        } else if (attempt) {
          showStrictRejection(attempt.intent);
        } else {
          showStrictModeAction(session.kind === "boardCard" ? "move_card" : "take_card_from_deck");
        }
        endDragSession();
        return;
      }
      const source = {
        kind: session.kind,
        payload: session.payload,
        card: session.card,
      };
      const card = session.card;
      const asHidden =
        armedAction.kind === "play_hidden" && card ? armedAction.cardId === card.id : false;
      const intent = buildDropIntent({
        source,
        targetZone: input.zone as Parameters<typeof buildDropIntent>[0]["targetZone"],
        targetOwner: input.owner,
        viewerId,
        actorPlayerId: input.owner === "self" ? viewerId : (opponent?.id ?? viewerId),
        toIndex: input.toIndex ?? undefined,
        shiftKey: input.shiftKey,
        asHidden,
        targetCard: cardUnderPointer(input.clientX, input.clientY),
      });
      if (intent) {
        const actorId = input.owner === "self" ? viewerId : (opponent?.id ?? viewerId);
        if (!engineCanDrop(state, actorId, intent)) {
          endDragSession();
          return;
        }
        const targetIsPlayZone = input.zone === "base" || input.zone.startsWith("battlefield");
        if (targetIsPlayZone) playBoardSound("card_play");
        else if (input.zone === "trash" || input.zone === "banished")
          playBoardSound("card_discard");
        else if (input.zone === "mainDeck" || input.zone === "runeDeck")
          playBoardSound("card_recycle");
        else playBoardSound("card_click");
        sendIntent(intent, input.owner);
      }
      endDragSession();
    },
    [
      armedAction,
      viewerId,
      opponent,
      sendIntent,
      endDragSession,
      state,
      cardUnderPointer,
      strictActive,
      strictDropForSession,
      sendStrictIntent,
      showStrictRejection,
      showStrictModeAction,
      showStrictNotice,
    ],
  );

  const getDropZoneHandlers = useCallback(
    (zone: string, owner: "self" | "opponent"): DropZoneHandlers => ({
      onDragEnter: (event) => updateDragOver(zone, owner, event),
      onDragOver: (event) => updateDragOver(zone, owner, event),
      onDragLeave: (event) => {
        const current = event.currentTarget;
        const related = event.relatedTarget;
        if (related instanceof Node && current.contains(related)) return;
        clearDropTarget();
        setDrag((previous) =>
          previous.overZone === zone && previous.overOwner === owner
            ? { ...previous, overZone: null, overOwner: null, toIndex: null }
            : previous,
        );
      },
      onDrop: (event) => {
        event.preventDefault();
        event.stopPropagation();
        const toIndex = dragUiRef.current.overZone === zone ? dragUiRef.current.toIndex : null;
        completeDrop({
          zone,
          owner,
          toIndex,
          shiftKey: event.shiftKey,
          clientX: event.clientX,
          clientY: event.clientY,
        });
      },
      onContextMenu: (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) return;
        zoneContextMenuHandlerRef.current(zone, owner, event);
      },
    }),
    [updateDragOver, clearDropTarget, completeDrop],
  );

  const handlePilePress = useCallback(
    (slot: PileSlot, owner: "self" | "opponent", event: React.MouseEvent) => {
      if (owner !== "self" || !interactive) return;
      const board = viewer?.board;
      if (!board) return;
      if (strictActive) {
        if (slot === "trash") {
          viewPile("trash", owner);
          return;
        }
        if (slot === "banished") {
          viewPile("banished", owner);
          return;
        }
        showStrictModeAction(slot === "mainDeck" ? "draw_cards" : "draw_rune");
        return;
      }
      if (slot === "mainDeck") {
        if (board.deck.length === 0) return;
        playBoardSound("card_draw");
        sendIntent({ type: "draw_cards", count: 1, to: "hand" } as GameActionIntent);
        return;
      }
      if (slot === "runeDeck") {
        if (board.runeDeck.length === 0) return;
        playBoardSound("card_draw");
        sendIntent({
          type: "draw_rune",
          exhausted: !(event.ctrlKey || event.metaKey),
        } as GameActionIntent);
        return;
      }
      if (slot === "trash") {
        viewPile("trash", owner);
        return;
      }
      viewPile("banished", owner);
    },
    [viewer, interactive, sendIntent, viewPile, strictActive, showStrictModeAction],
  );

  const handlePileContextMenu = useCallback(
    (slot: PileSlot, owner: "self" | "opponent", event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) return;
      if (strictActive) {
        if (slot === "trash") {
          viewPile("trash", owner);
          return;
        }
        if (slot === "banished") {
          viewPile("banished", owner);
          return;
        }
        showStrictModeAction(slot === "mainDeck" ? "draw_cards" : "draw_rune");
        return;
      }
      if (slot === "mainDeck" && (event.ctrlKey || event.metaKey)) {
        if (owner === "self" && interactive) {
          const count = viewer?.board?.deck.length ?? 0;
          if (count > 0) {
            playBoardSound("card_discard");
            sendIntent({ type: "draw_cards", count: 1, to: "trash" } as GameActionIntent);
          }
        }
        return;
      }
      const count =
        slot === "mainDeck"
          ? (viewer?.board?.deck.length ?? 0)
          : slot === "runeDeck"
            ? (viewer?.board?.runeDeck.length ?? 0)
            : slot === "trash"
              ? (viewer?.board?.trash.length ?? 0)
              : (viewer?.board?.banished.length ?? 0);
      const entries = buildPileMenu({
        slot,
        owner,
        count,
        recycledBottomCount: viewer?.board?.recycledDeckBottomCount ?? 0,
        canAct: interactive,
        ctrlKey: event.ctrlKey,
      });
      const run = (id: PileMenuId) => {
        switch (id) {
          case "press":
          case "draw_main_deck":
            playBoardSound("card_draw");
            sendIntent({ type: "draw_cards", count: 1, to: "hand" } as GameActionIntent, owner);
            return;
          case "look":
          case "look_main_deck":
          case "context_rune_deck_look":
            playBoardSound("card_click");
            sendIntent(
              {
                type: "peek_deck_top",
                count: 1,
                ...(id === "context_rune_deck_look" ? { zone: "runeDeck" as const } : {}),
              } as GameActionIntent,
              owner,
            );
            return;
          case "burn":
          case "context_burn_main_deck":
            playBoardSound("card_discard");
            sendIntent({ type: "draw_cards", count: 1, to: "trash" } as GameActionIntent, owner);
            return;
          case "look_bottom":
            sendIntent({ type: "peek_deck_bottom" } as GameActionIntent, owner);
            return;
          case "search_deck":
            playBoardSound("card_click");
            sendIntent({ type: "peek_deck_top", count: 12 } as GameActionIntent, owner);
            return;
          case "shuffle_deck":
            sendIntent({ type: "shuffle_deck" } as GameActionIntent, owner);
            return;
          case "shuffle_unrecycled":
            sendIntent(
              { type: "shuffle_deck", preserveRecycledBottom: true } as GameActionIntent,
              owner,
            );
            return;
          case "channel_rune_deck":
          case "context_channel_rune_deck":
            playBoardSound("card_draw");
            sendIntent({ type: "draw_rune", exhausted: true } as GameActionIntent, owner);
            return;
          case "ready":
            playBoardSound("card_draw");
            sendIntent({ type: "draw_rune", exhausted: false } as GameActionIntent, owner);
            return;
          case "show_trash":
            viewPile("trash", owner);
            return;
          case "show_banished":
            viewPile("banished", owner);
            return;
          case "recycle_all":
            sendIntent({ type: "recycle_all_trash_to_deck" } as GameActionIntent, owner);
            return;
        }
      };
      openMenu(
        event.clientX,
        event.clientY,
        buildSections(
          entries.map((entry) => ({
            ...entry,
            label: t(entry.labelKey) ?? entry.labelKey,
            onSelect: () => run(entry.id),
          })),
        ),
        slot === "mainDeck"
          ? (t("sim.mainDeck") ?? "Main Deck")
          : slot === "runeDeck"
            ? (t("sim.runeDeck") ?? "Rune Deck")
            : slot === "trash"
              ? (t("sim.trash") ?? "Trash")
              : (t("sim.tablet.banishedCaption") ?? "Banished"),
      );
      playBoardSound("ui_click");
    },
    [interactive, viewer, sendIntent, viewPile, openMenu, buildSections, strictActive, showStrictModeAction],
  );

  const handleZoneContextMenuInternal = useCallback(
    (zone: string, owner: "self" | "opponent", event: React.MouseEvent) => {
      if (strictActive) {
        if (zone === "trash" || zone === "banished") {
          viewPile(zone, owner);
          return;
        }
        if (zone === "hand") {
          showStrictModeAction("set_hand_reveal");
          return;
        }
        if (zone === "runeArea") {
          showStrictModeAction("draw_rune");
          return;
        }
      }
      if (zone === "hand") {
        const entries = buildZoneMenu("hand", {
          owner,
          canAct: interactive,
          handRevealed: owner === "self" ? !!viewer?.board?.handRevealToOpponent : false,
        });
        openMenu(
          event.clientX,
          event.clientY,
          buildSections(
            entries.map((entry) => ({
              ...entry,
              label: t(entry.labelKey) ?? entry.labelKey,
              onSelect: () => {
                if (entry.id === "hand_reveal") {
                  sendIntent(
                    {
                      type: "set_hand_reveal",
                      reveal: !viewer?.board?.handRevealToOpponent,
                    } as GameActionIntent,
                    owner,
                  );
                } else if (entry.id === "hand_draw") {
                  sendIntent(
                    { type: "draw_cards", count: 1, to: "hand" } as GameActionIntent,
                    owner,
                  );
                }
              },
            })),
          ),
          t("sim.hand") ?? "Hand",
        );
        return;
      }
      if (zone === "runeArea") {
        const hasRune = (viewer?.board?.runeArea?.length ?? 0) > 0;
        const entries = buildZoneMenu("runeArea", { owner, canAct: interactive, hasRune });
        openMenu(
          event.clientX,
          event.clientY,
          buildSections(
            entries.map((entry) => ({
              ...entry,
              label: t(entry.labelKey) ?? entry.labelKey,
              onSelect: () => {
                if (entry.id === "channel_rune_deck") {
                  sendIntent({ type: "draw_rune", exhausted: true } as GameActionIntent, owner);
                }
              },
            })),
          ),
          t("sim.runes") ?? "Runes",
        );
        return;
      }
      if (zone === "trash") {
        handlePileContextMenu("trash", owner, event);
        return;
      }
      if (zone === "banished") {
        handlePileContextMenu("banished", owner, event);
        return;
      }
    },
    [interactive, viewer, openMenu, buildSections, sendIntent, handlePileContextMenu, strictActive, viewPile, showStrictModeAction],
  );

  const handleZoneContextMenu = useCallback(
    (zone: string, owner: "self" | "opponent", event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) return;
      handleZoneContextMenuInternal(zone, owner, event);
    },
    [handleZoneContextMenuInternal],
  );
  zoneContextMenuHandlerRef.current = handleZoneContextMenuInternal;

  const handleBattlefieldMarkerPress = useCallback(
    (zone: Zone, owner: "self" | "opponent", event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (armedAction.kind === "target") {
        completeTarget(
          {
            id: `battlefield-marker:${zone}`,
            name:
              state.players
                .map((player) => player.selectedBattlefield)
                .find((value): value is string => !!value?.trim()) ?? "Battlefield",
            source: "battlefield",
            exhausted: false,
            createdAt: 0,
            type: "Battlefield",
          },
          zone,
          owner,
        );
        return;
      }
      if (event.shiftKey && interactive) {
        if (strictActive) {
          showStrictModeAction("chain_add");
          return;
        }
        sendIntent(
          {
            type: "chain_add",
            from: "battlefieldMarker",
            cardId: `battlefield-marker:${zone}`,
            battlefieldZone: zone,
            clientEntryId: `chain-${viewerId}-${zone}-${Date.now()}`,
          } as GameActionIntent,
          owner,
        );
        return;
      }
      const selected = state.players
        .map((player) => player.selectedBattlefield)
        .find((value): value is string => !!value?.trim());
      openMenu(
        event.clientX,
        event.clientY,
        [
          {
            items: [
              {
                id: "ping",
                label: t("sim.compactPing") ?? "Ping",
                onSelect: () => {
                  triggerPing(`battlefield-marker:${zone}`);
                },
              },
              {
                id: "chain",
                label: t("sim.tablet.addToChain") ?? "Add to Chain",
                disabled: !interactive || strictActive,
                ...(strictActive ? { hint: t("rules.ui.illegal") ?? "Not allowed" } : {}),
                onSelect: () =>
                  sendIntent(
                    {
                      type: "chain_add",
                      from: "battlefieldMarker",
                      cardId: `battlefield-marker:${zone}`,
                      battlefieldZone: zone,
                      clientEntryId: `chain-${viewerId}-${zone}-${Date.now()}`,
                    } as GameActionIntent,
                    owner,
                  ),
              },
            ],
          },
        ],
        selected ?? t("sim.battlefield") ?? "Battlefield",
      );
    },
    [interactive, sendIntent, viewerId, state.players, openMenu, armedAction, completeTarget, triggerPing, strictActive, showStrictModeAction],
  );

  const handleBoardContextMenu = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-chat-panel-root="true"]')) return;
      if (event.shiftKey) return;
      event.preventDefault();
      closeTransientUi();
    },
    [closeTransientUi],
  );

  const handleBoardPointerDown = useCallback((event: React.PointerEvent) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  /* --------------------------------------------------------- pointer fallback */

  const findDropAt = useCallback(
    (
      x: number,
      y: number,
    ): { zone: string; owner: "self" | "opponent"; toIndex: number | null } | null => {
      if (typeof document === "undefined") return null;
      const element = document.elementFromPoint(x, y);
      if (!(element instanceof HTMLElement)) return null;
      const target = zoneFromElement(element);
      if (!target) return null;
      const zoneElement = element.closest<HTMLElement>("[data-drop-zone-root], [data-pile-slot]");
      let toIndex: number | null = null;
      if (
        zoneElement &&
        [
          "hand",
          "base",
          "battlefieldA",
          "battlefieldB",
          "battlefieldC",
          "battlefieldToken",
          "runeArea",
        ].includes(target.zone)
      ) {
        const rects = orderedRects(zoneElement);
        toIndex = rects.length > 0 ? computeOrderedDropIndex(rects, x, y, "horizontal") : 0;
      }
      return { ...target, toIndex };
    },
    [zoneFromElement, orderedRects],
  );

  const handleCardPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>, cardEvent: CardEvent) => {
      if (event.pointerType !== "touch" || event.button !== 0) return;
      if (cardEvent.owner === "opponent" && !dispatchAs) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const origin = event.currentTarget;
      const timer = window.setTimeout(() => {
        const gesture = touchLongPressRef.current;
        if (!gesture) return;
        gesture.fired = true;
        suppressClickUntilRef.current = Date.now() + 800;
        handleTouchLongPress({
          ...cardEvent,
          clientX: startX,
          clientY: startY,
          pointerType: "touch",
        });
      }, 480);
      touchLongPressRef.current = {
        timer,
        fired: false,
        card: cardEvent.card,
        zone: cardEvent.zone,
        owner: cardEvent.owner,
        startX,
        startY,
        startedDrag: false,
      };

      const onMove = (moveEvent: PointerEvent) => {
        const gesture = touchLongPressRef.current;
        if (!gesture) return;
        const distance = Math.hypot(
          moveEvent.clientX - gesture.startX,
          moveEvent.clientY - gesture.startY,
        );
        if (!gesture.startedDrag && distance > 10 && !gesture.fired) {
          window.clearTimeout(gesture.timer);
          gesture.startedDrag = true;
          suppressClickUntilRef.current = Date.now() + 1000;
          hideCardPreview();
          beginDragSession({
            kind: "boardCard",
            payload: {
              zone: gesture.zone,
              cardId: gesture.card.id,
              exhausted: gesture.card.exhausted,
              hidden: !!gesture.card.hidden,
            },
            card: gesture.card,
            owner: gesture.owner,
            event: {
              clientX: gesture.startX,
              clientY: gesture.startY,
              timeStamp: moveEvent.timeStamp,
            },
            originElement: origin,
          });
        }
        if (gesture.startedDrag && dragSessionRef.current) {
          const drop = findDropAt(moveEvent.clientX, moveEvent.clientY);
          if (drop) {
            const element = document
              .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
              ?.closest<HTMLElement>("[data-drop-zone-root], [data-pile-slot]");
            if (element) setDropTargetElement(element);
            setDrag({
              active: true,
              kind: dragSessionRef.current.kind,
              sourceZone: gesture.zone,
              sourceOwner: gesture.owner,
              sourceCardId: gesture.card.id,
              overZone: drop.zone,
              overOwner: drop.owner,
              toIndex: drop.toIndex,
            });
          } else {
            clearDropTarget();
          }
        }
      };
      const onUp = (upEvent: PointerEvent) => {
        const gesture = touchLongPressRef.current;
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onUp, true);
        if (!gesture) return;
        window.clearTimeout(gesture.timer);
        if (gesture.startedDrag) {
          const drop = findDropAt(upEvent.clientX, upEvent.clientY);
          if (drop) {
            completeDrop({
              zone: drop.zone,
              owner: drop.owner,
              toIndex: drop.toIndex,
              shiftKey: upEvent.shiftKey,
              clientX: upEvent.clientX,
              clientY: upEvent.clientY,
            });
          } else {
            endDragSession();
          }
        } else if (gesture.fired) {
          hideCardPreview();
        }
        touchLongPressRef.current = null;
      };
      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onUp, true);
    },
    [
      dispatchAs,
      handleTouchLongPress,
      hideCardPreview,
      beginDragSession,
      findDropAt,
      setDropTargetElement,
      clearDropTarget,
      completeDrop,
      endDragSession,
    ],
  );

  /* ------------------------------------------------------------------ editors */

  const openLabelEditor = useCallback((request: LabelEditorRequest) => {
    setLabelEditor(request);
    setMenu(null);
  }, []);

  const openCounterEditor = useCallback((request: CounterEditorRequest) => {
    setCounterEditor(request);
    setMenu(null);
  }, []);

  const openPileViewer = useCallback((request: PileViewerRequest) => {
    setPileViewer(request);
    setMenu(null);
  }, []);

  /* -------------------------------------------------------------- keyboard */

  const armLabelPreset = useCallback(
    (preset: LabelPreset) => {
      setArmedAction({ kind: "label" });
      setLabelSelection(preset);
    },
    [setArmedAction],
  );

  useEffect(() => {
    if (!interactive) return;
    const entry = state.chainEntries[state.chainEntries.length - 1];
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || isEditableTarget(event.target)) return;
      const key = event.key;
      const lower = key.toLowerCase();
      const command = platformModifierPressed(event);

      if (key === "Escape" || key === "Esc") {
        event.preventDefault();
        closeTransientUi();
        setArmedAction({ kind: "none" });
        return;
      }
      if (event.repeat) return;

      if (strictActive && !command && !event.altKey && (lower === "b" || lower === "c")) {
        event.preventDefault();
        showStrictModeAction(lower === "b" ? "adjust_card_might" : "adjust_card_counter");
        return;
      }

      // Shift+C duplicate (press) — must be checked before the "c" hold.
      if (event.shiftKey && lower === "c" && !command && !event.altKey) {
        event.preventDefault();
        setArmedAction(armedAction.kind === "duplicate" ? { kind: "none" } : { kind: "duplicate" });
        return;
      }
      if (event.shiftKey && lower === "r" && !command && !event.altKey) {
        event.preventDefault();
        setDiceWheelOpen(true);
        heldKeyboardModeRef.current = "dice";
        return;
      }
      if (event.shiftKey && event.code === "Space") {
        event.preventDefault();
        handleSwitchPerspective();
        return;
      }
      if (event.code === "Space" && !event.shiftKey && !command && !event.altKey) {
        event.preventDefault();
        handleEndTurn();
        return;
      }
      if (strictActive) {
        const blocked =
          event.code === "Backspace" ||
          (!event.shiftKey &&
            !command &&
            !event.altKey &&
            ["d", "r", "a", "s", "q", "w"].includes(lower));
        if (blocked) {
          event.preventDefault();
          showStrictModeAction(lower === "d" ? "draw_cards" : lower === "r" ? "rewind_last_action" : "chain_resolve");
          return;
        }
      }
      if (event.code === "Backspace" && event.shiftKey && !command) {
        event.preventDefault();
        sendIntent({ type: "rewind_last_action" } as GameActionIntent);
        return;
      }
      if (event.code === "Backspace" && command) {
        event.preventDefault();
        sendIntent({ type: "forward_last_rewind" } as GameActionIntent);
        return;
      }
      if (command || event.altKey) return;
      if (event.shiftKey) return;
      if (lower === "r" && !event.shiftKey) {
        event.preventDefault();
        sendIntent({ type: "rewind_last_action" } as GameActionIntent);
        return;
      }
      if (lower === "d") {
        event.preventDefault();
        playBoardSound("card_draw");
        sendIntent({ type: "draw_cards", count: 1, to: "hand" } as GameActionIntent);
        return;
      }
      if (lower === "v") {
        event.preventDefault();
        handleSwitchPerspective();
        return;
      }
      if (lower === "q") {
        const assist = state.pendingBattlefieldConquerAssist;
        if (!assist) return;
        event.preventDefault();
        sendIntent({ type: "battlefield_conquer_confirm", zone: assist.zone } as GameActionIntent);
        return;
      }
      if (lower === "w") {
        const assist = state.pendingBattlefieldConquerAssist;
        if (!assist) return;
        event.preventDefault();
        if (assist.stage === "defender_response") {
          sendIntent({
            type: "battlefield_conquer_pass_response",
            zone: assist.zone,
          } as GameActionIntent);
        } else {
          sendIntent({
            type: "battlefield_conquer_pass_focus",
            zone: assist.zone,
          } as GameActionIntent);
        }
        return;
      }
      if (lower === "a") {
        if (!entry) return;
        event.preventDefault();
        const already = state.chainResolveVotes?.includes(viewerId);
        sendIntent({
          type: "chain_set_resolve_vote",
          entryId: entry.id,
          approved: !already,
        } as GameActionIntent);
        return;
      }
      if (lower === "s") {
        if (!entry) return;
        event.preventDefault();
        sendIntent({
          type: "chain_resolve",
          entryId: entry.id,
          to: defaultChainDestination(entry),
        } as GameActionIntent);
        return;
      }
      if (lower === "t" && !event.shiftKey) {
        event.preventDefault();
        if (armedAction.kind === "target") {
          setArmedAction({ kind: "none" });
        } else if (entry) {
          setArmedAction({
            kind: "target",
            sourceCardId: entry.card.id,
            sourceCardName: entry.card.name,
            sourceAnchor: "chain",
          });
        }
        heldKeyboardModeRef.current = "target";
        return;
      }
      if (lower === "c" && !event.shiftKey) {
        event.preventDefault();
        setArmedAction(
          armedAction.kind === "counter" ? { kind: "none" } : { kind: "counter", counter: "white" },
        );
        heldKeyboardModeRef.current = "counter";
        return;
      }
      if (lower === "b" && !event.shiftKey) {
        event.preventDefault();
        setArmedAction(armedAction.kind === "buff" ? { kind: "none" } : { kind: "buff" });
        heldKeyboardModeRef.current = "buff";
        return;
      }
      if (lower === "l" && !event.shiftKey) {
        event.preventDefault();
        setArmedAction(armedAction.kind === "label" ? { kind: "none" } : { kind: "label" });
        heldKeyboardModeRef.current = "label";
        return;
      }
      if (lower === "e" && !event.shiftKey) {
        event.preventDefault();
        setEmoteWheelOpen(true);
        heldKeyboardModeRef.current = "emote";
        return;
      }
      if (lower === "p" && !event.shiftKey) {
        event.preventDefault();
        setArmedAction(armedAction.kind === "ping" ? { kind: "none" } : { kind: "ping" });
        heldKeyboardModeRef.current = "ping";
        return;
      }
      if (lower === "=" || lower === "-" || /^[0-9]$/.test(lower)) {
        const preset = LABEL_PRESETS.find((candidate) => candidate.hotkey === lower);
        if (!preset) return;
        event.preventDefault();
        armLabelPreset(preset);
        return;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.isComposing || isEditableTarget(event.target)) return;
      const modeHeld = heldKeyboardModeRef.current;
      if (!modeHeld) return;
      const key = event.key.toLowerCase();
      const shouldClear =
        (modeHeld === "counter" && key === "c") ||
        (modeHeld === "buff" && key === "b") ||
        (modeHeld === "target" && key === "t") ||
        (modeHeld === "label" && key === "l") ||
        (modeHeld === "emote" && key === "e") ||
        (modeHeld === "ping" && key === "p") ||
        (modeHeld === "dice" && key === "r");
      if (!shouldClear) return;
      heldKeyboardModeRef.current = null;
      if (modeHeld === "emote") setEmoteWheelOpen(false);
      if (modeHeld === "dice") setDiceWheelOpen(false);
      if (
        modeHeld === "counter" ||
        modeHeld === "buff" ||
        modeHeld === "target" ||
        modeHeld === "label" ||
        modeHeld === "ping"
      ) {
        setArmedAction({ kind: "none" });
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [
    interactive,
    state,
    viewerId,
    armedAction,
    closeTransientUi,
    setArmedAction,
    handleEndTurn,
    handleSwitchPerspective,
    sendIntent,
    armLabelPreset,
    playBoardSound,
    strictActive,
    showStrictModeAction,
  ]);

  /* --------------------------------------------------------------- derived */

  const targetableCardIds = useMemo<ReadonlySet<string>>(() => {
    if (armedAction.kind !== "target") return EMPTY_SELECTION;
    const ids = new Set<string>();
    for (const player of [viewer, opponent]) {
      if (!player) continue;
      for (const zone of [
        "base",
        "battlefieldA",
        "battlefieldToken",
        "battlefieldB",
        "battlefieldC",
        "champion",
        "legend",
      ] as Zone[]) {
        for (const card of zoneCards(state, player, zone)) {
          if (card.id !== armedAction.sourceCardId) ids.add(card.id);
        }
      }
    }
    return ids;
  }, [armedAction, state, viewer, opponent]);

  const selectedPlusSource = selectedCardIds;

  const pileCards = useMemo(() => {
    if (!pileViewer) return [];
    const player = pileViewer.owner === "self" ? viewer : opponent;
    return zoneCards(state, player, pileViewer.slot);
  }, [pileViewer, viewer, opponent, state]);

  const emoteList = DEFAULT_EMOTE_WHEEL;

  const value: BoardInteractionValue = {
    slotProps: {
      state,
      viewerId,
      controlledPlayerIds,
      dispatch,
      mode,
      ...(dispatchAs ? { dispatchAs } : {}),
      actionClock,
      ...(onBoardEmote ? { onBoardEmote } : {}),
    },
    viewerId,
    mode,
    canAct: interactive,
    strictView,
    strictManual,
    showCardPreview,
    showCardPreviewByName,
    hideCardPreview,
    hoveredCardId,
    selectedCardIds: selectedPlusSource,
    targetableCardIds,
    armedAction,
    setArmedAction,
    labelSelection,
    drag,
    handleCardEvent,
    handleTouchLongPress,
    handleCardDragStart,
    handleCardDragEnd: endDragSession,
    handleCardPointerDown,
    pingedCardId,
    pingCard,
    getDropZoneHandlers,
    handleZoneContextMenu,
    handlePilePress,
    handlePileContextMenu,
    handlePileDragStart,
    handlePileDragEnd: endDragSession,
    handleBattlefieldMarkerPress,
    handleBattlefieldMarkerDragStart,
    handleBoardContextMenu,
    handleBoardPointerDown,
    handleEndTurn,
    handleSwitchPerspective,
    openLabelEditor,
    openCounterEditor,
    openPileViewer,
    sendIntent,
    playCard,
  };

  return (
    <BoardInteractionContext.Provider value={value}>
      <style>{`
        .dragDropTarget {
          outline: 1px solid rgba(126, 216, 255, 0.72) !important;
          outline-offset: -2px;
          box-shadow: inset 0 0 0 1px rgba(126,216,255,0.28), 0 0 16px rgba(64,164,220,0.28) !important;
        }
        .dragOriginPickup { opacity: .14; transition: opacity 90ms ease-out; }
        .dragOriginHidden { pointer-events: none; opacity: 0 !important; }
        [data-strict-playable="true"] {
          outline: 1px solid rgba(126, 222, 174, 0.78) !important;
          outline-offset: -1px;
          box-shadow: inset 0 0 0 1px rgba(126,222,174,0.3), 0 0 14px rgba(64,210,150,0.34) !important;
        }
        [data-card-drag-ghost] [data-card-drop-index] { display: none; }
      `}</style>
      {children}
      {strictPlay && strictView ? (
        <StrictPlayDialog
          key={strictPlay.cardId}
          room={state}
          actorId={strictView.actorId}
          cardId={strictPlay.cardId}
          {...(strictView.playableById.get(strictPlay.cardId)
            ? { detail: strictView.playableById.get(strictPlay.cardId)! }
            : {})}
          hideLocations={strictView.hideableById.get(strictPlay.cardId) ?? []}
          t={t}
          {...(strictPlay.location ? { initialLocation: strictPlay.location } : {})}
          initialHide={strictPlay.hide === true}
          explain={(intent) => strictExplainIllegal(state, strictView.actorId, intent)}
          onIntent={(intent) => {
            sendStrictIntent(intent);
            setStrictPlay(null);
          }}
          onClose={() => setStrictPlay(null)}
        />
      ) : null}
      {strictNotice ? (
        <div
          className="pointer-events-none fixed left-1/2 top-[4.5rem] z-[156] w-[min(26rem,calc(100%-1rem))] -translate-x-1/2 rounded-[0.28rem] border border-[rgba(242,138,138,0.55)] bg-[rgba(52,18,24,0.96)] px-[0.55rem] py-[0.34rem] text-center text-[0.68rem] font-semibold leading-[1.25] text-[#ffd5d5] shadow-[0_10px_24px_rgba(2,7,18,0.55)]"
          role="status"
          data-testid="strict-rejection"
          data-strict-code={strictNotice.code}
          data-strict-rule={strictNotice.rule ?? ""}
        >
          {strictNotice.text}
        </div>
      ) : null}
      <HoverCardPreviewLayer preview={preview} />
      <DragGhostLayer
        session={dragSession}
        deckPositionActive={drag.overZone === "mainDeck" || drag.overZone === "runeDeck"}
      />
      <TargetArrowOverlay state={state} viewerId={viewerId} live={drag.active} />
      {armedAction.kind === "target" ? (
        <div
          data-target-selection-overlay="true"
          data-selection-kind="target"
          className="pointer-events-none fixed bottom-[4.2rem] left-1/2 z-150 inline-flex -translate-x-1/2 items-center gap-[0.4rem] rounded-[0.24rem] border border-[rgba(125,218,237,0.42)] bg-[rgba(9,25,45,0.94)] px-[0.6rem] py-[0.28rem] text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-[#d7f6fb] shadow-[0_10px_24px_rgba(2,7,18,0.5)]"
        >
          <span>{t("sim.tablet.target") ?? "Target"}</span>
          <span className="text-[#8fb3d4]">{armedAction.sourceCardName}</span>
          <kbd className="rounded-[0.1rem] border border-white/20 bg-black/25 px-[0.18rem] py-[0.02rem] text-[0.5rem]">
            Esc
          </kbd>
        </div>
      ) : null}
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
      <LabelWheel
        open={armedAction.kind === "label"}
        selected={labelSelection}
        anchorX={pointerRef.current.x}
        anchorY={pointerRef.current.y}
        onSelect={(preset) => setLabelSelection(preset)}
        onCustom={(label) => setLabelSelection(customLabelPreset(label))}
        onClose={() => setArmedAction({ kind: "none" })}
      />
      {labelEditor ? (
        <LabelEditor
          card={labelEditor.card}
          open
          initialSlot={labelEditor.slot}
          onApply={(label, slot) => {
            dispatchMenuIntent(
              {
                type: "set_card_label",
                zone: labelEditor.zone,
                cardId: labelEditor.card.id,
                slot,
                label,
              } as GameActionIntent,
              labelEditor.owner,
            );
          }}
          onRemove={(slot) => {
            dispatchMenuIntent(
              {
                type: "set_card_label",
                zone: labelEditor.zone,
                cardId: labelEditor.card.id,
                slot,
                label: "",
              } as GameActionIntent,
              labelEditor.owner,
            );
          }}
          onClose={() => setLabelEditor(null)}
        />
      ) : null}
      {counterEditor ? (
        <CounterEditor
          card={counterEditor.card}
          open
          onAdjust={(counter, delta) => {
            const card = counterEditor.card;
            dispatchMenuIntent(
              {
                type: "adjust_card_counter",
                zone: counterEditor.zone,
                cardId: card.id,
                counter,
                delta,
                ...(counter === "white" && isUnit(card) && !card.whiteCounter && delta > 0
                  ? { initializeAtUnitMight: true }
                  : {}),
              } as GameActionIntent,
              counterEditor.owner,
            );
          }}
          onClear={(counter) => {
            dispatchMenuIntent(
              {
                type: "clear_card_counter",
                zone: counterEditor.zone,
                cardId: counterEditor.card.id,
                counter,
              } as GameActionIntent,
              counterEditor.owner,
            );
          }}
          onClose={() => setCounterEditor(null)}
        />
      ) : null}
      <PileViewer
        open={!!pileViewer}
        slot={pileViewer?.slot ?? "trash"}
        owner={pileViewer?.owner ?? "self"}
        cards={pileCards}
        onPlay={(card) => {
          if (!pileViewer) return;
          playCard(pileViewer.slot, card, pileViewer.owner);
        }}
        onToHand={(card) => {
          if (!pileViewer) return;
          dispatchMenuIntent(
            {
              type: "move_card",
              from: pileViewer.slot,
              to: "hand",
              cardId: card.id,
            } as GameActionIntent,
            pileViewer.owner,
          );
        }}
        onRecycle={(card) => {
          if (!pileViewer) return;
          dispatchMenuIntent(
            {
              type: "send_to_deck",
              from: pileViewer.slot,
              cardId: card.id,
              position: "bottom",
            } as GameActionIntent,
            pileViewer.owner,
          );
        }}
        onSwap={(card) => {
          if (!pileViewer) return;
          dispatchMenuIntent(
            {
              type: "move_card",
              from: pileViewer.slot,
              to: pileViewer.slot === "trash" ? "banished" : "trash",
              cardId: card.id,
            } as GameActionIntent,
            pileViewer.owner,
          );
        }}
        onRecycleAll={() => {
          if (!pileViewer) return;
          dispatchMenuIntent(
            { type: "recycle_all_trash_to_deck" } as GameActionIntent,
            pileViewer.owner,
          );
        }}
        onClose={() => setPileViewer(null)}
      />
      {emoteWheelOpen ? (
        <div className="fixed left-1/2 top-1/2 z-180 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(208,222,248,0.16)] bg-[rgba(10,16,28,0.82)] p-[0.4rem] shadow-[0_18px_40px_rgba(2,6,18,0.55)] backdrop-blur-md">
          <div className="grid grid-cols-3 gap-[0.3rem]">
            {emoteList.map((emoteId) => {
              const emote = EMOTE_BY_ID.get(emoteId);
              if (!emote) return null;
              return (
                <button
                  key={emoteId}
                  type="button"
                  aria-label={emote.label}
                  title={emote.label}
                  className="grid h-[2.6rem] w-[2.6rem] place-items-center rounded-full border border-[rgba(190,208,239,0.22)] bg-[rgba(31,44,66,0.6)] text-[1.35rem] hover:bg-[rgba(48,68,98,0.8)]"
                  onClick={() => {
                    onBoardEmote?.(emoteId);
                    window.dispatchEvent(
                      new CustomEvent(BOARD_EMOTE_EVENT, { detail: { emoteId } }),
                    );
                    setEmoteWheelOpen(false);
                  }}
                >
                  <EmoteGlyph id={emoteId} animated />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {diceWheelOpen ? (
        <div className="fixed left-1/2 top-1/2 z-180 -translate-x-1/2 -translate-y-1/2 rounded-[0.4rem] border border-[rgba(208,222,248,0.16)] bg-[rgba(10,16,28,0.92)] p-[0.5rem] shadow-[0_18px_40px_rgba(2,6,18,0.55)]">
          <div className="flex gap-[0.3rem]">
            {([4, 6, 8, 10, 12, 20] as const).map((sides) => (
              <button
                key={sides}
                type="button"
                className="rounded-[0.3rem] border border-[rgba(190,208,239,0.24)] bg-[rgba(31,44,66,0.7)] px-[0.5rem] py-[0.4rem] text-[0.7rem] font-bold text-[#eef6ff] hover:bg-[rgba(48,68,98,0.86)]"
                onClick={() => {
                  sendIntent({ type: "roll_die", sides } as GameActionIntent);
                  setDiceWheelOpen(false);
                }}
              >
                d{sides}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </BoardInteractionContext.Provider>
  );
}
