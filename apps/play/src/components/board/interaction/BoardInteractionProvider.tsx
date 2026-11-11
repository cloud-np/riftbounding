"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { applyGameAction, buildAutoPayPaymentBatch, strictLegalIntents, strictWhoMayAct } from "@rift/engine";
import { getCard, getCardByName } from "@rift/cards";
import { createTranslator, promptTitle, rulesReasonText, rulesRejectionText } from "@rift/i18n";
import type { CardInstance, PromptOption, Room, RoomPlayer, Zone } from "@rift/protocol";

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
import { buildDropIntent, defaultChainDestination, dropActorOwner, isChainAddable } from "../drag/drop-intents";
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
import { smallBlueButton, smallNeutralButton } from "@/components/ui/buttonStyles";
import { BoardInteractionContext } from "./context";
import { useLocalGameSettings } from "../settings/settings-values";
import { playBoardSound } from "./sfx";
import {
  canConfirmPromptSelection,
  nextPromptOptionAnchor,
  parseAmbiguousDetail,
  promptAutoConfirms,
  promptChooseIntent,
  promptHasBoardTargets,
  promptIsObjectPrompt,
  promptNeedsAccumulation,
  promptOptionAnchor,
  promptOptionForAction,
  promptOptionForPlayer,
  promptOptionMatchIds,
  promptSelectionBounds,
  strictManualWindowFor,
  strictPromptClick,
  strictUseGesture,
  strictViewFromLegal,
  togglePromptSelection,
  withGestureAbility,
  type StrictBoardView,
} from "../strict/strict-interaction";
import { PROMPT_PRIMARY_BUTTON, PROMPT_SECONDARY_BUTTON } from "../strict/StrictPromptDialog";
import { RulesText } from "../text/RulesText";
import { findCard as findStrictCard, isStrictRoom, promptForClient, promptInstruction, promptSourceAnchor, promptSourceName, strictActorFor } from "../strict/strict-model";
import { autoPassPrefsFor, autoPassSeat, passUntilIntent } from "../strict/strict-auto-pass";
import {
  cachedStrictDragLegality,
  strictDropAllowed,
  strictDropTargetCard,
  type StrictDragLegality,
} from "../strict/strict-drop-legality";
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
  const [strictPromptSelection, setStrictPromptSelection] = useState<string[]>([]);
  const [strictPromptHoverId, setStrictPromptHoverId] = useState<string | null>(null);
  const [strictAmbiguous, setStrictAmbiguous] = useState<{
    action: GameActionIntent;
    owner: "self" | "opponent";
    choice: NonNullable<ReturnType<typeof parseAmbiguousDetail>>;
  } | null>(null);
  const [strictSelectedUnitIds, setStrictSelectedUnitIds] = useState<ReadonlySet<string>>(
    EMPTY_SELECTION,
  );
  const [strictNotice, setStrictNotice] = useState<{
    text: string;
    code: string;
    rule?: string;
  } | null>(null);

  const previewTimerRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const dragSessionRef = useRef<DragSession | null>(null);
  const strictDragLegalityRef = useRef<StrictDragLegality | null>(null);
  /** Last card under the pointer during this drag (resolved once per dragover). */
  const dragHoverCardRef = useRef<CardInstance | null>(null);
  const dragOriginRef = useRef(createDragOriginSession());
  const dragTargetElementRef = useRef<HTMLElement | null>(null);
  const dragCardTargetElementRef = useRef<HTMLElement | null>(null);
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
  const strictPrompt = useMemo(
    () => (strictView ? promptForClient(state, controlled) : null),
    [state, controlled, strictView],
  );
  const strictPromptOnBoard = !!strictPrompt && promptHasBoardTargets(state, strictPrompt);
  const strictPromptMulti =
    !!strictPrompt && strictPromptOnBoard && promptNeedsAccumulation(strictPrompt);
  const strictPromptOptionIds = useMemo(
    () => (strictPrompt ? promptOptionMatchIds(strictPrompt) : EMPTY_SELECTION),
    [strictPrompt],
  );
  const strictPromptSource = useMemo(
    () => (strictPrompt ? promptSourceName(state, strictPrompt) : null),
    [strictPrompt, state],
  );
  const strictPromptInstruction = useMemo(
    () =>
      strictPrompt
        ? promptIsObjectPrompt(strictPrompt)
          ? (t("rules.ui.targetAimInstruction") ??
            "Choose a target: drag the arrow to a highlighted unit")
          : promptInstruction(t, strictPrompt)
        : null,
    [strictPrompt],
  );
  const strictPromptTitle = useMemo(() => {
    if (!strictPrompt) return "";
    const instruction = strictPromptInstruction ?? promptTitle(t, strictPrompt);
    return strictPromptSource
      ? (t("rules.ui.promptFromSource", {
          source: strictPromptSource,
          prompt: instruction,
        }) ?? `${strictPromptSource} — ${instruction}`)
      : instruction;
  }, [strictPrompt, strictPromptInstruction, strictPromptSource]);
  // A new prompt starts a fresh accumulate-then-confirm selection.
  useEffect(() => {
    setStrictPromptSelection([]);
    setStrictPromptHoverId(null);
  }, [strictPrompt?.id]);

  /**
   * 312/313/338.1.b/347.2: the holder's own response window. The banner is rendered only for a
   * controlled seat, and its instruction is identical with or without legal responses (the
   * "no playable responses" hint is local to this viewer).
   */
  const strictResponse = useMemo(() => {
    if (!strictView || !strictWho || strictWho.kind === "none" || strictPrompt) return null;
    if (!controlled.includes(strictWho.player)) return null;
    const battlefieldLabel = (zone: string): string => {
      if (zone === "battlefieldToken") return state.sharedBattlefieldToken?.title ?? zone;
      const player =
        zone === "battlefieldA"
          ? viewer
          : zone === "battlefieldB"
            ? opponent
            : state.players[zone === "battlefieldC" ? 2 : viewerIndex];
      return player?.selectedBattlefield?.trim() || zone;
    };
    const hasLegalResponses =
      strictView.legal.playableCardIds.length > 0 || strictView.legal.activatable.length > 0;
    if (strictWho.kind === "focus") {
      const showdown = state.rules?.showdown;
      const zone = showdown?.battlefield ?? state.rules?.combat?.battlefield;
      if (!zone) return null;
      const combat = showdown?.kind === "combat" || state.rules?.combat?.step === "showdown";
      const battlefield = battlefieldLabel(zone);
      return {
        kind: combat ? ("combat" as const) : ("showdown" as const),
        window: "focus" as const,
        player: strictWho.player,
        title: combat
          ? (t("rules.ui.combatAt", { battlefield }) ?? `Combat at ${battlefield}`)
          : (t("rules.ui.showdownAt", { battlefield }) ?? `Showdown at ${battlefield}`),
        instruction:
          t("rules.ui.focusInstruction") ??
          "You have focus: play an Action or Reaction, or Pass",
        hasLegalResponses,
      };
    }
    if (strictWho.kind === "priority" && strictWho.window === "chain") {
      const top = state.rules?.chain.at(-1);
      const card = top?.cardName ?? top?.abilityRef ?? (t("sim.chain") ?? "the chain");
      return {
        kind: "chain" as const,
        window: "priority" as const,
        player: strictWho.player,
        title: t("rules.ui.respondTo", { card }) ?? `Respond to ${card}`,
        instruction:
          t("rules.ui.priorityInstruction") ??
          "You have priority: play an Action or Reaction, or Pass",
        hasLegalResponses,
      };
    }
    return null;
  }, [controlled, opponent, state, strictPrompt, strictView, strictWho, viewer, viewerIndex]);

  const strictAim = useMemo(() => {
    if (!strictPrompt || !strictPromptOnBoard || !promptIsObjectPrompt(strictPrompt)) return null;
    const source = promptSourceAnchor(state, strictPrompt);
    if (!source) return null;
    return {
      active: true,
      sourceId: source.id,
      sourceAnchor: source.anchor,
      optionIds: strictPromptOptionIds,
      pinned: strictPromptSelection.map((id, index) => {
        const option = (strictPrompt.options ?? []).find((entry) => entry.id === id);
        return { targetId: option ? promptOptionAnchor(option) : id, index };
      }),
    };
  }, [state, strictPrompt, strictPromptOnBoard, strictPromptOptionIds, strictPromptSelection]);

  const strictDragAim = useMemo(() => {
    if (!strictActive || !drag.active || !drag.sourceCardId) return null;
    const legality = strictDragLegalityRef.current;
    if (!legality) return null;
    const optionIds = new Set<string>([...legality.targetIds, ...legality.targetZones]);
    if (optionIds.size === 0) return null;
    return {
      active: true,
      sourceId: drag.sourceCardId,
      sourceAnchor: "board" as const,
      optionIds,
      pinned: [],
    };
  }, [drag.active, drag.sourceCardId, state, strictActive]);

  const strictAimArrow = strictAim ?? strictDragAim;

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

  const previewGesture = useCallback(
    (action: GameActionIntent, actorId: string) => {
      try {
        return applyGameAction(state, actorId, action, {
          now: state.updatedAt && state.updatedAt > 0 ? state.updatedAt : 1_700_000_000_000,
          rng: () => 0.5,
          mode: state.roomMode ?? "multiplayer",
        });
      } catch {
        return null;
      }
    },
    [state],
  );

  const sendAsActor = useCallback(
    (action: GameActionIntent, actorId: string) => {
      if (actorId !== viewerId && dispatchAs) {
        dispatchAs(actorId, action);
        return;
      }
      dispatch(action);
    },
    [dispatch, dispatchAs, viewerId],
  );

  /** 338.1.b / 347.2: the banner's Pass is the existing `rules_pass` intent. */
  const passStrictResponse = useCallback(() => {
    if (!strictResponse) return;
    playBoardSound("ui_click");
    sendAsActor({ type: "rules_pass" }, strictResponse.player);
  }, [sendAsActor, strictResponse]);

  /**
   * Auto-pass (docs/rules/auto-pass.md): "pass until end of turn" (Shift+W) for the seat that
   * may act (or the viewer); pressing it again cancels the override.
   */
  const toggleStrictPassUntilEndOfTurn = useCallback(() => {
    if (!strictActive || state.phase !== "in_game") return;
    const seat = autoPassSeat(state, viewerId, controlled);
    const prefs = autoPassPrefsFor(state, seat);
    playBoardSound("ui_click");
    sendAsActor(passUntilIntent(state, prefs, "end_of_turn"), seat);
  }, [controlled, sendAsActor, state, strictActive, viewerId]);

  const chooseStrictPromptOption = useCallback(
    (option: PromptOption) => {
      if (!strictPrompt) return;
      if (strictPromptMulti) {
        setStrictPromptSelection((current) =>
          togglePromptSelection(strictPrompt, current, option.id),
        );
        return;
      }
      playBoardSound("card_click");
      sendAsActor(promptChooseIntent(strictPrompt, [option.id]), strictPrompt.playerId);
    },
    [sendAsActor, strictPrompt, strictPromptMulti],
  );

  /** Esc / right-click: clear a multi selection, or Skip an optional prompt. */
  const cancelStrictAim = useCallback(() => {
    if (!strictPrompt) return;
    setStrictPromptHoverId(null);
    if (strictPromptMulti && strictPromptSelection.length > 0) {
      setStrictPromptSelection([]);
      return;
    }
    if (promptSelectionBounds(strictPrompt).min === 0) {
      setStrictPromptSelection([]);
      sendAsActor(promptChooseIntent(strictPrompt, []), strictPrompt.playerId);
    }
  }, [sendAsActor, strictPrompt, strictPromptMulti, strictPromptSelection]);

  /** Tab / arrow keys cycle the highlighted target; Enter locks it. */
  const cycleStrictTarget = useCallback(
    (delta: number) => {
      if (!strictPrompt || !strictPromptOnBoard) return;
      const next = nextPromptOptionAnchor(strictPrompt, strictPromptHoverId, delta);
      if (next === null) return;
      setStrictPromptHoverId(next);
      playBoardSound("ui_click");
    },
    [strictPrompt, strictPromptHoverId, strictPromptOnBoard],
  );

  const sendStrictGesture = useCallback(
    (action: GameActionIntent, owner: "self" | "opponent" = "self") => {
      if (!strictView) return;
      const actorId =
        owner === "opponent" && opponent && dispatchAs
          ? opponent.id
          : strictView.actorId;
      // 411.2 multi-selection object prompt: clicks accumulate; the board overlay confirms.
      if (strictPrompt && strictPromptMulti) {
        const option = promptOptionForAction(strictPrompt, action);
        if (option) {
          setStrictPromptSelection((current) =>
            togglePromptSelection(strictPrompt, current, option.id),
          );
          return;
        }
      }
      if (action.type.startsWith("rules_")) {
        sendAsActor(action, actorId);
        return;
      }
      const result = previewGesture(action, actorId);
      if (result && !result.ok) {
        const code = result.errorCode ?? "illegal_action";
        const rule = result.rule;
        const detail = result.detail;
        if (code === "ambiguous_gesture") {
          const choice = parseAmbiguousDetail(detail);
          if (choice) {
            setStrictAmbiguous({ action, owner, choice });
            return;
          }
        }
        showStrictNotice(
          code,
          rule,
          rulesRejectionText(t, { code, rule, detail }, (token) => findStrictCard(state, token)?.name),
        );
        return;
      }
      sendAsActor(action, actorId);
    },
    [
      strictView,
      state,
      opponent,
      dispatchAs,
      strictPrompt,
      strictPromptMulti,
      previewGesture,
      sendAsActor,
      showStrictNotice,
    ],
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

  const sendIntent = useCallback(
    (intent: GameActionIntent, owner: "self" | "opponent" = "self") => {
      // Strict rooms: send the natural sandbox gesture and let the engine translate it (or reject
      // it with code/rule/detail). Sandbox rooms take the original path unchanged.
      if (strictActive) {
        sendStrictGesture(intent, owner);
        return;
      }
      if (owner === "opponent" && opponent && dispatchAs) {
        dispatchAs(opponent.id, intent);
        return;
      }
      dispatch(intent);
    },
    [dispatch, dispatchAs, opponent, strictActive, sendStrictGesture],
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
    if (
      !strictActive &&
      state.activeTurnPlayerId &&
      !controlledPlayerIds.includes(state.activeTurnPlayerId)
    ) {
      return;
    }
    const observed = {
      turnNumber: state.turnNumber ?? 0,
      activePlayerId: state.activeTurnPlayerId ?? viewerId,
      activeStep: state.activeTurnStep ?? "main",
    };
    playBoardSound("ui_click");
    sendIntent(
      (strictActive
        ? { type: "end_turn", observed }
        : state.activeTurnStep === "beginning"
          ? { type: "end_beginning_phase", observed }
          : { type: "end_turn", observed }) as GameActionIntent,
    );
  }, [interactive, strictActive, state, controlledPlayerIds, viewerId, sendIntent]);

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
    [interactive, mode, dispatchAs, sendIntent, viewerId, opponent, state.sharedBattlefieldToken],
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

  const strictHandMenu = useCallback(
    (event: CardEvent) => {
      if (!strictView) return;
      openMenu(
        event.clientX ?? pointerRef.current.x,
        event.clientY ?? pointerRef.current.y,
        [
          {
            items: [
              {
                id: "ping",
                label: t("sim.compactPing") ?? "Ping",
                onSelect: () => triggerPing(event.card.id),
              },
            ],
          },
        ],
        event.card.name,
      );
      playBoardSound("ui_click");
    },
    [strictView, openMenu, triggerPing],
  );

  const openCardMenu = useCallback(
    (event: CardEvent, owner: "self" | "opponent") => {
      if (!viewer) return;
      const isSelf = owner === "self";
      if (strictActive) {
        if (!isSelf) return;
        strictHandMenu(event);
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
      strictHandMenu,
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
        // 411.2: an object prompt is answered by clicking its board option, whoever owns the
        // card (enemy units are the usual targets), so this runs before the ownership check.
        // `strictPrompt` is only set for a prompt this client answers, and the answer is sent by
        // the prompted player (`strictView.actorId` = "self"), never as the clicked card's
        // owner. Anything else is not a legal target; the aim arrow shows the not-allowed state
        // and sends nothing.
        const promptClick = interactive
          ? strictPromptClick(strictPrompt, strictPromptOnBoard, zone, card.id)
          : null;
        if (promptClick) {
          if (promptClick !== "not-an-option") {
            playBoardSound("card_click");
            sendIntent(promptClick, "self");
          }
          return;
        }
        if (!canActAsOwner) {
          if (isSelf && interactive) scheduleCardPreview(card, event, 0);
          return;
        }
        // Multi-unit Standard Move selection (Shift-click), then drag any selected Unit.
        if (event.shiftKey && isUnit(card) && (zone === "base" || zone.startsWith("battlefield"))) {
          playBoardSound("ui_click");
          setStrictSelectedUnitIds((current) => {
            const next = new Set(current);
            if (next.has(card.id)) next.delete(card.id);
            else next.add(card.id);
            return next;
          });
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
        if (
          zone === "base" ||
          zone.startsWith("battlefield") ||
          zone === "legend" ||
          zone === "runeArea"
        ) {
          // "Use" gesture: the engine maps it to the one legal activation (or returns
          // ambiguous_gesture so the client can choose the ability).
          playBoardSound("card_click");
          sendIntent(strictUseGesture(zone, card.id), owner);
          return;
        }
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
      strictPrompt,
      strictPromptOnBoard,
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
        if (event.zone === "hand" && event.owner === "self" && !event.faceDown) {
          // Own-hand cards are enlarged in place by HandZoomLayer; no side preview.
          setHoveredCardId(event.card.id);
          playBoardSound("card_hover");
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
        if (strictPrompt && strictPromptOnBoard) {
          cancelStrictAim();
          return;
        }
        if ((event.ctrlKey || event.metaKey) && event.owner === "self" && interactive) {
          if (
            event.zone === "hand" ||
            event.zone === "base" ||
            event.zone.startsWith("battlefield")
          ) {
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
      cancelStrictAim,
      strictPrompt,
      strictPromptOnBoard,
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

  const setCardDropTarget = useCallback((element: HTMLElement | null) => {
    if (dragCardTargetElementRef.current && dragCardTargetElementRef.current !== element) {
      dragCardTargetElementRef.current.removeAttribute("data-strict-drop-target");
    }
    dragCardTargetElementRef.current = element;
    if (element) element.setAttribute("data-strict-drop-target", "true");
  }, []);

  const clearDropTarget = useCallback(() => {
    setDropTargetElement(null);
    setCardDropTarget(null);
  }, [setDropTargetElement, setCardDropTarget]);

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
      // Strict rooms: one legality snapshot per drag source. Hover never calls the engine.
      strictDragLegalityRef.current = null;
      dragHoverCardRef.current = null;
      const payload = input.payload as { zone?: string; cardId?: string };
      if (strictActive && input.card && payload.cardId && payload.zone) {
        const actorId = input.owner === "self" ? viewerId : (opponent?.id ?? viewerId);
        strictDragLegalityRef.current = cachedStrictDragLegality(state, actorId, {
          cardId: payload.cardId,
          zone: payload.zone,
        });
      }
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
    [opponent, state, strictActive, viewerId],
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
    strictDragLegalityRef.current = null;
    dragHoverCardRef.current = null;
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
      if (strictActive && !strictSelectedUnitIds.has(event.card.id)) {
        setStrictSelectedUnitIds(EMPTY_SELECTION);
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
    [beginDragSession, dispatchAs, strictActive, strictSelectedUnitIds],
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

  const dropIntentForSession = useCallback(
    (
      session: DragSession,
      zone: string,
      owner: "self" | "opponent",
      clientX: number,
      clientY: number,
      shiftKey: boolean,
      toIndex: number | null,
      asHiddenOverride = false,
    ): GameActionIntent | null => {
      const payload = session.payload as { zone?: Zone; cardId?: string };
      const asHidden =
        asHiddenOverride ||
        (armedAction.kind === "play_hidden" && session.card
          ? armedAction.cardId === session.card.id
          : false);
      const cardIds =
        strictActive &&
        session.kind === "boardCard" &&
        payload.cardId &&
        strictSelectedUnitIds.has(payload.cardId)
          ? [...strictSelectedUnitIds]
          : undefined;
      // Move-out recommendation: only deliberate targeting (a card in the cached legal target
      // set) carries `targetCardId`. A plain zone drop — e.g. a unit dragged battlefield → Base
      // that happens to land over a base card — must not smuggle the hovered card into the
      // gesture. Sandbox keeps the old equip/target behaviour.
      const hoverCard = dragHoverCardRef.current ?? cardUnderPointer(clientX, clientY);
      const targetCard = strictDropTargetCard(hoverCard, strictDragLegalityRef.current, {
        strict: strictActive,
        hide: asHidden,
      });
      return buildDropIntent({
        source: { kind: session.kind, payload: session.payload, card: session.card },
        targetZone: zone as Parameters<typeof buildDropIntent>[0]["targetZone"],
        targetOwner: owner,
        viewerId,
        // Strict rooms: the seat that picked the card up acts, wherever it is dropped (a spell
        // or move released over the opponent's half of a battlefield is still the viewer's play).
        actorPlayerId:
          dropActorOwner(strictActive, session.owner, owner) === "self" ? viewerId : (opponent?.id ?? viewerId),
        toIndex: toIndex ?? undefined,
        shiftKey,
        asHidden,
        targetCard,
        ...(cardIds ? { cardIds } : {}),
        includeTarget: strictActive,
      });
    },
    [
      strictActive,
      strictSelectedUnitIds,
      buildDropIntent,
      viewerId,
      opponent,
      armedAction,
      cardUnderPointer,
    ],
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
      let legal: boolean;
      let hoverCard: CardInstance | null = null;
      if (strictActive) {
        const payload = session.payload as { zone?: string; cardId?: string };
        const actorId = session.owner === "self" ? viewerId : (opponent?.id ?? viewerId);
        const legality =
          strictDragLegalityRef.current ??
          (payload.cardId && payload.zone
            ? cachedStrictDragLegality(state, actorId, {
                cardId: payload.cardId,
                zone: payload.zone,
              })
            : null);
        if (legality && payload.cardId && payload.zone) strictDragLegalityRef.current = legality;
        hoverCard = cardUnderPointer(event.clientX, event.clientY);
        dragHoverCardRef.current = hoverCard;
        legal =
          !!legality &&
          strictDropAllowed(legality, {
            zone,
            targetId: hoverCard?.id ?? null,
            hide: event.altKey,
          });
      } else {
        const intent = dropIntentForSession(
          session,
          zone,
          owner,
          event.clientX,
          event.clientY,
          event.shiftKey,
          toIndex,
        );
        legal = intent
          ? engineCanDrop(state, owner === "self" ? viewerId : (opponent?.id ?? viewerId), intent)
          : false;
      }
      if (legal) setDropTargetElement(target);
      else clearDropTarget();
      if (strictActive && legal) {
        const sourceId = "cardId" in session.payload ? session.payload.cardId : null;
        const element =
          hoverCard && hoverCard.id !== sourceId && typeof document !== "undefined"
            ? document
                .elementFromPoint(event.clientX, event.clientY)
                ?.closest<HTMLElement>("[data-card-id][data-drop-zone]")
            : null;
        setCardDropTarget(element ?? null);
      } else {
        setCardDropTarget(null);
      }
      const nextOverZone = legal ? zone : null;
      const nextOverOwner = legal ? owner : null;
      const nextToIndex = legal ? toIndex : null;
      setDrag((previous) =>
        previous.active === true &&
        previous.kind === session.kind &&
        previous.sourceZone === ("zone" in session.payload ? (session.payload.zone as string) : null) &&
        previous.sourceOwner === session.owner &&
        previous.sourceCardId === ("cardId" in session.payload ? (session.payload.cardId ?? null) : null) &&
        previous.overZone === nextOverZone &&
        previous.overOwner === nextOverOwner &&
        previous.toIndex === nextToIndex
          ? previous
          : {
              active: true,
              kind: session.kind,
              sourceZone: "zone" in session.payload ? (session.payload.zone as string) : null,
              sourceOwner: session.owner,
              sourceCardId: "cardId" in session.payload ? (session.payload.cardId ?? null) : null,
              overZone: nextOverZone,
              overOwner: nextOverOwner,
              toIndex: nextToIndex,
            },
      );
    },
    [
      orderedRects,
      setDropTargetElement,
      clearDropTarget,
      setCardDropTarget,
      viewerId,
      opponent,
      armedAction,
      state,
      cardUnderPointer,
      dropIntentForSession,
      strictActive,
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
      /** 811.1.b: force the hide gesture (drop pocket or Alt-drop). */
      asHidden?: boolean;
      /** Auto-pass "hold priority" (Ctrl/⌘-drop): keep Priority after this play (337.4). */
      hold?: boolean;
    }) => {
      const session = dragSessionRef.current;
      if (!session) return;
      const dropped = dropIntentForSession(
        session,
        input.zone,
        input.owner,
        input.clientX,
        input.clientY,
        input.shiftKey,
        input.toIndex,
        input.asHidden === true,
      );
      // The engine forwards `hold` only when the gesture becomes a play or an activation.
      const intent =
        dropped && strictActive && input.hold === true
          ? ({ ...dropped, hold: true } as GameActionIntent)
          : dropped;
      if (intent) {
        const actorOwner = dropActorOwner(strictActive, session.owner, input.owner);
        const actorId = actorOwner === "self" ? viewerId : (opponent?.id ?? viewerId);
        // Sandbox keeps the old dry-run pre-filter; strict rooms send the gesture and let the
        // engine translate it (legal, or a rejection with code/rule/detail).
        if (!strictActive && !engineCanDrop(state, actorId, intent)) {
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
        sendIntent(intent, actorOwner);
      }
      endDragSession();
    },
    [
      viewerId,
      opponent,
      sendIntent,
      endDragSession,
      state,
      strictActive,
      dropIntentForSession,
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
        dragHoverCardRef.current = null;
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
          asHidden: strictActive && event.altKey,
          hold: strictActive && (event.ctrlKey || event.metaKey),
        });
      },
      onContextMenu: (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) return;
        zoneContextMenuHandlerRef.current(zone, owner, event);
      },
      ...(strictPromptOptionIds.has(zone)
        ? { "data-strict-prompt-option": "true" as const }
        : {}),
    }),
    [updateDragOver, clearDropTarget, completeDrop, strictPromptOptionIds, strictActive],
  );

  /** 811.1.b: the dedicated "Hide (facedown)" pocket on a legal battlefield. */
  const getHideDropZoneHandlers = useCallback(
    (zone: string, owner: "self" | "opponent"): DropZoneHandlers => ({
      onDragEnter: (event) => {
        if (!dragSessionRef.current) return;
        event.preventDefault();
        event.stopPropagation();
      },
      onDragOver: (event) => {
        if (!dragSessionRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        setDrag((previous) =>
          previous.overZone === zone && previous.overOwner === owner && previous.toIndex === null
            ? previous
            : {
                ...previous,
                overZone: zone,
                overOwner: owner,
                toIndex: null,
              },
        );
      },
      onDragLeave: (event) => {
        const current = event.currentTarget;
        const related = event.relatedTarget;
        if (related instanceof Node && current.contains(related)) return;
        setDrag((previous) =>
          previous.overZone === zone && previous.overOwner === owner
            ? { ...previous, overZone: null, overOwner: null }
            : previous,
        );
      },
      onDrop: (event) => {
        event.preventDefault();
        event.stopPropagation();
        completeDrop({
          zone,
          owner,
          toIndex: null,
          shiftKey: event.shiftKey,
          clientX: event.clientX,
          clientY: event.clientY,
          asHidden: true,
        });
      },
      onContextMenu: (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      "data-zone-owner": owner,
    }),
    [completeDrop],
  );

  const handlePilePress = useCallback(
    (slot: PileSlot, owner: "self" | "opponent", event: React.MouseEvent) => {
      const pileBoard = owner === "self" ? viewer?.board : opponent?.board;
      if (!pileBoard) return;
      // Decks are private: only their controller may draw from them.
      if (slot === "mainDeck") {
        if (owner !== "self" || !interactive || pileBoard.deck.length === 0) return;
        playBoardSound("card_draw");
        sendIntent({ type: "draw_cards", count: 1, to: "hand" } as GameActionIntent);
        return;
      }
      if (slot === "runeDeck") {
        if (owner !== "self" || !interactive || pileBoard.runeDeck.length === 0) return;
        playBoardSound("card_draw");
        sendIntent({
          type: "draw_rune",
          exhausted: !(event.ctrlKey || event.metaKey),
        } as GameActionIntent);
        return;
      }
      // Trash and banished are public zones (R108/R109): either seat's pile can be inspected.
      viewPile(slot, owner);
    },
    [viewer, opponent, interactive, sendIntent, viewPile],
  );

  const handlePileContextMenu = useCallback(
    (slot: PileSlot, owner: "self" | "opponent", event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) return;
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
    [interactive, viewer, sendIntent, viewPile, openMenu, buildSections],
  );

  const handleZoneContextMenuInternal = useCallback(
    (zone: string, owner: "self" | "opponent", event: React.MouseEvent) => {
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
    [interactive, viewer, openMenu, buildSections, sendIntent, handlePileContextMenu],
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
      if (strictActive && strictPrompt && strictPromptOnBoard && event.type === "contextmenu") {
        cancelStrictAim();
        return;
      }
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
      if (strictActive && strictPrompt && strictPromptOnBoard) {
        const gesture = strictUseGesture(zone, `battlefield-marker:${zone}`);
        if (promptOptionForAction(strictPrompt, gesture)) {
          playBoardSound("card_click");
          sendIntent(gesture, owner);
        }
        return;
      }
      if (event.shiftKey && interactive) {
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
              ...(strictActive
                ? []
                : [
                    {
                      id: "chain",
                      label: t("sim.tablet.addToChain") ?? "Add to Chain",
                      disabled: !interactive,
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
                  ]),
            ],
          },
        ],
        selected ?? t("sim.battlefield") ?? "Battlefield",
      );
    },
    [interactive, sendIntent, viewerId, state.players, openMenu, armedAction, completeTarget, triggerPing, strictActive, strictPrompt, strictPromptOnBoard, cancelStrictAim],
  );

  const handleBoardContextMenu = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-chat-panel-root="true"]')) return;
      if (event.shiftKey) return;
      event.preventDefault();
      if (strictPrompt && strictPromptOnBoard) {
        cancelStrictAim();
        return;
      }
      closeTransientUi();
    },
    [cancelStrictAim, closeTransientUi, strictPrompt, strictPromptOnBoard],
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
              hold: upEvent.ctrlKey || upEvent.metaKey,
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

  const openLabelEditor = useCallback(
    (request: LabelEditorRequest) => {
      if (strictActive) return; // manual labels are not part of strict play
      setLabelEditor(request);
      setMenu(null);
    },
    [strictActive],
  );

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
      if (strictActive) return;
      setArmedAction({ kind: "label" });
      setLabelSelection(preset);
    },
    [setArmedAction, strictActive],
  );

  useEffect(() => {
    if (!interactive) return;
    const entry = state.chainEntries[state.chainEntries.length - 1];
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || isEditableTarget(event.target)) return;
      const key = event.key;
      const lower = key.toLowerCase();
      const command = platformModifierPressed(event);

      if (strictPrompt && strictPromptOnBoard) {
        if (key === "Escape" || key === "Esc") {
          event.preventDefault();
          cancelStrictAim();
          return;
        }
        if (key === "Tab" || key.startsWith("Arrow")) {
          event.preventDefault();
          const delta =
            key === "Tab"
              ? event.shiftKey
                ? -1
                : 1
              : key === "ArrowLeft" || key === "ArrowUp"
                ? -1
                : 1;
          cycleStrictTarget(delta);
          return;
        }
        if (key === "Enter") {
          const option = (strictPrompt.options ?? []).find(
            (entry) => !entry.disabled && promptOptionAnchor(entry) === strictPromptHoverId,
          );
          if (option) {
            event.preventDefault();
            chooseStrictPromptOption(option);
            return;
          }
        }
      }

      if (key === "Escape" || key === "Esc") {
        event.preventDefault();
        closeTransientUi();
        setArmedAction({ kind: "none" });
        return;
      }
      if (event.repeat) return;

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
      // Auto-pass: Shift+W toggles "pass until end of turn" in strict rooms (W alone = Pass).
      if (event.shiftKey && lower === "w" && !command && !event.altKey && strictActive) {
        event.preventDefault();
        toggleStrictPassUntilEndOfTurn();
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
      if (lower === "w" && strictResponse) {
        event.preventDefault();
        passStrictResponse();
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
      if (lower === "l" && !event.shiftKey && !strictActive) {
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
        const preset = strictActive ? undefined : LABEL_PRESETS.find((candidate) => candidate.hotkey === lower);
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
    strictResponse,
    passStrictResponse,
    strictActive,
    toggleStrictPassUntilEndOfTurn,
    strictPrompt,
    strictPromptOnBoard,
    strictPromptHoverId,
    cancelStrictAim,
    cycleStrictTarget,
    chooseStrictPromptOption,
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

  const selectedPlusSource = useMemo(() => {
    if (strictSelectedUnitIds.size === 0 && strictPromptSelection.length === 0) {
      return selectedCardIds;
    }
    return new Set([
      ...selectedCardIds,
      ...strictSelectedUnitIds,
      ...strictPromptSelection,
    ]);
  }, [selectedCardIds, strictSelectedUnitIds, strictPromptSelection]);

  const pileCards = useMemo(() => {
    if (!pileViewer) return [];
    const player = pileViewer.owner === "self" ? viewer : opponent;
    return zoneCards(state, player, pileViewer.slot);
  }, [pileViewer, viewer, opponent, state]);

  const emoteList = DEFAULT_EMOTE_WHEEL;

  const resolveStrictAmbiguous = (value: string) => {
    if (!strictAmbiguous) return;
    const { action, owner, choice } = strictAmbiguous;
    setStrictAmbiguous(null);
    if (choice.kind === "ability") {
      sendStrictGesture(withGestureAbility(action, value), owner);
      return;
    }
    // Mode pick: the engine has no gesture field for a 355.3 mode, so send the explicit play
    // with the chosen mode choice (only reached from the ambiguity chooser).
    const cardId = (action as { cardId?: string }).cardId;
    if (!cardId) return;
    const to = (action as { to?: string }).to;
    const location =
      to === "base" || (to && to.startsWith("battlefield")) ? to : undefined;
    const actorId =
      owner === "opponent" && opponent && dispatchAs
        ? opponent.id
        : (strictView?.actorId ?? viewerId);
    sendAsActor(
      {
        type: "rules_play",
        cardId,
        ...(location ? { location } : {}),
        choices: { mode: [value] },
      } as GameActionIntent,
      actorId,
    );
  };

  const confirmStrictPromptSelection = useCallback(() => {
    if (!strictPrompt || !canConfirmPromptSelection(strictPrompt, strictPromptSelection)) return;
    const actorId = strictPrompt.playerId;
    setStrictPromptSelection([]);
    sendAsActor(promptChooseIntent(strictPrompt, strictPromptSelection), actorId);
  }, [sendAsActor, strictPrompt, strictPromptSelection]);

  // max reached → the pinned selection is complete and confirms without another click.
  useEffect(() => {
    if (!strictPrompt || !strictPromptMulti) return;
    if (promptAutoConfirms(strictPrompt, strictPromptSelection)) confirmStrictPromptSelection();
  }, [confirmStrictPromptSelection, strictPrompt, strictPromptMulti, strictPromptSelection]);

  const skipStrictPrompt = () => {
    if (!strictPrompt) return;
    const { min } = promptSelectionBounds(strictPrompt);
    if (min > 0) return;
    setStrictPromptSelection([]);
    setStrictPromptHoverId(null);
    sendAsActor(promptChooseIntent(strictPrompt, []), strictPrompt.playerId);
  };

  const handlePlayerTargetClick = useCallback(
    (playerId: string) => {
      if (!strictPrompt || !strictPromptOnBoard) return;
      const option = promptOptionForPlayer(strictPrompt, playerId);
      if (!option) return;
      if (strictPromptMulti) {
        setStrictPromptSelection((current) =>
          togglePromptSelection(strictPrompt, current, option.id),
        );
        return;
      }
      playBoardSound("card_click");
      sendAsActor(promptChooseIntent(strictPrompt, [option.id]), strictPrompt.playerId);
    },
    [sendAsActor, strictPrompt, strictPromptMulti, strictPromptOnBoard],
  );

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
    strictPromptOptionIds,
    strictPromptHoverId,
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
    getHideDropZoneHandlers,
    handlePlayerTargetClick,
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
        /* No rings on cards (owner rule); only zone targets keep a highlight. */
        [data-strict-prompt-option="true"]:not([data-card-id]):not(.gc-button) {
          outline: 1px solid rgba(126, 216, 255, 0.8) !important;
          outline-offset: -1px;
          box-shadow: inset 0 0 0 1px rgba(126,216,255,0.3), 0 0 14px rgba(64,164,220,0.38) !important;
        }
        [data-strict-drop-target="true"] {
          outline: 2px solid rgba(255, 214, 126, 0.9) !important;
          outline-offset: -2px;
          box-shadow: inset 0 0 0 1px rgba(255,214,126,0.35), 0 0 16px rgba(255,180,64,0.42) !important;
        }
        [data-card-drag-ghost] [data-card-drop-index] { display: none; }
      `}</style>
      {children}
      {strictAmbiguous ? (
        <div
          className="pointer-events-auto fixed left-1/2 top-[5.2rem] z-[157] w-[min(24rem,calc(100%-1rem))] -translate-x-1/2 rounded-[0.28rem] border border-[rgba(193,210,235,0.5)] bg-[rgba(16,28,46,0.98)] p-[0.45rem] text-[#eef5ff] shadow-[0_10px_24px_rgba(2,7,18,0.6)]"
          role="dialog"
          data-testid="strict-ambiguous"
          data-strict-kind={strictAmbiguous.choice.kind}
        >
          <p className="m-0 text-[0.62rem] font-semibold leading-[1.2]">
            {rulesReasonText(t, "ambiguous_gesture", "403.3")}
          </p>
          <div className="mt-[0.3rem] flex flex-wrap gap-[0.24rem]">
            {strictAmbiguous.choice.values.map((value) => (
              <button
                key={value}
                type="button"
                className={smallNeutralButton}
                data-strict-ambiguous-option={value}
                onClick={() => resolveStrictAmbiguous(value)}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              className={smallNeutralButton}
              onClick={() => setStrictAmbiguous(null)}
            >
              {t("rules.ui.cancel") ?? "Cancel"}
            </button>
          </div>
        </div>
      ) : null}
      {strictPrompt && strictPromptOnBoard ? (
        <div
          className="pointer-events-auto fixed left-1/2 top-[3.6rem] z-[157] w-[min(34rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-[0.6rem] border border-[var(--rb-border-strong,rgba(200,170,110,0.45))] bg-[var(--rb-surface,#0e0f12)] px-4 py-3 text-base text-[var(--rb-text,#ece6da)] shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_14px_36px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(240,212,138,0.14)]"
          style={{ fontFamily: "var(--font-ui), system-ui, sans-serif" }}
          role="status"
          data-testid="strict-prompt-banner"
          data-strict-prompt-id={strictPrompt.id}
          data-strict-prompt-kind={strictPrompt.kind}
        >
          <div className="flex items-start gap-[0.4rem]">
            <p
              className="m-0 min-w-0 flex-1 text-[1.1rem] font-semibold leading-[1.3] text-[var(--rb-gold-bright,#f0d48a)]"
              style={{ fontFamily: "var(--font-heading), ui-serif, Georgia, serif" }}
              data-testid="strict-prompt-banner-title"
            >
              <RulesText text={strictPromptTitle} />
            </p>
            {strictPromptMulti ? (
              <span
                className="shrink-0 tabular-nums text-base text-[var(--rb-gold,#c8aa6e)]"
                data-testid="strict-prompt-pinned-count"
              >
                {strictPromptSelection.length}/{promptSelectionBounds(strictPrompt).max}
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="strict-prompt-actions">
            {strictPromptMulti ? (
              <button
                type="button"
                className={`${PROMPT_SECONDARY_BUTTON} !min-h-10 !px-4`}
                data-testid="strict-prompt-clear"
                onClick={() => setStrictPromptSelection([])}
              >
                {t("rules.ui.cancel") ?? "Cancel"}
              </button>
            ) : null}
            {promptSelectionBounds(strictPrompt).min === 0 ? (
              <button
                type="button"
                className={`${PROMPT_SECONDARY_BUTTON} !min-h-10 !px-4`}
                data-testid="strict-prompt-skip"
                onClick={skipStrictPrompt}
              >
                {t("rules.ui.skip") ?? "Skip"}
              </button>
            ) : null}
            {strictPromptMulti &&
            strictPromptSelection.length >= promptSelectionBounds(strictPrompt).min &&
            strictPromptSelection.length < promptSelectionBounds(strictPrompt).max ? (
              <button
                type="button"
                className={`${PROMPT_PRIMARY_BUTTON} !min-h-10 !px-4`}
                data-testid="strict-prompt-confirm"
                onClick={confirmStrictPromptSelection}
              >
                {t("rules.ui.confirm") ?? "Confirm"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {strictResponse && !strictPrompt ? (
        <div
          className="pointer-events-auto fixed left-1/2 top-[5.2rem] z-[157] w-[min(30rem,calc(100%-1rem))] -translate-x-1/2 rounded-[0.28rem] border border-[rgba(255,214,126,0.6)] bg-[rgba(35,29,17,0.97)] px-[0.5rem] py-[0.4rem] text-[0.66rem] font-semibold text-[#fff0cf] shadow-[0_10px_24px_rgba(2,7,18,0.58)]"
          role="status"
          data-testid="strict-response-banner"
          data-strict-response-kind={strictResponse.kind}
          data-strict-response-window={strictResponse.window}
          data-strict-response-empty={strictResponse.hasLegalResponses ? "false" : "true"}
        >
          <p className="m-0 leading-[1.3]" data-testid="strict-response-window">
            {strictResponse.title}
          </p>
          <p className="m-0 mt-[0.12rem] leading-[1.3] text-[#e3d4b6]" data-testid="strict-response-instruction">
            {strictResponse.instruction}
          </p>
          <div className="mt-[0.32rem] flex flex-wrap items-center gap-[0.3rem]">
            <button
              type="button"
              className={smallBlueButton}
              data-testid="strict-response-pass"
              onClick={passStrictResponse}
            >
              {t("rules.ui.pass") ?? "Pass"}
              <kbd className="ml-[0.2rem] rounded-[0.1rem] border border-white/20 bg-black/25 px-[0.18rem] py-[0.02rem] text-[0.5rem]">
                W
              </kbd>
            </button>
            <button
              type="button"
              className={smallNeutralButton}
              data-testid="strict-response-pass-until-eot"
              onClick={toggleStrictPassUntilEndOfTurn}
            >
              {t("rules.ui.autoPass.passUntilEndOfTurn") ?? "Pass until end of turn"}
              <kbd className="ml-[0.2rem] rounded-[0.1rem] border border-white/20 bg-black/25 px-[0.18rem] py-[0.02rem] text-[0.5rem]">
                ⇧W
              </kbd>
            </button>
            {!strictResponse.hasLegalResponses ? (
              <span
                className="text-[0.6rem] font-medium text-[#bba98c]"
                data-testid="strict-response-empty-hint"
              >
                {t("rules.ui.noPlayableResponses") ?? "No playable responses right now"}
              </span>
            ) : null}
          </div>
        </div>
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
      <TargetArrowOverlay state={state} viewerId={viewerId} live={drag.active} aim={strictAimArrow} />
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
        canModify={
          interactive &&
          (pileViewer?.owner === "self" || (mode !== "multiplayer" && !!dispatchAs))
        }
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
