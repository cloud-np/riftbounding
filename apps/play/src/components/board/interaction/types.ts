/**
 * Board interaction context types (wave 2).
 *
 * The provider owns *client-local* state only: hover preview, armed modes,
 * selection, drag session, open menus. Everything that changes the game is a
 * wire intent passed to `dispatch`.
 */
import type { CardInstance, Zone } from "@rift/protocol";

import type { CardEvent } from "../card/types";
import type { LabelPreset } from "../menus/label-presets";
import type { HoverPreviewLayout, PreviewAnchorRect } from "../hover/hover-metrics";
import type { BoardSlotProps } from "../slot-types";
import type { GameActionIntent } from "../slot-types";
import type { StrictBoardView } from "../strict/strict-interaction";

export type ArmedAction =
  | { kind: "none" }
  | { kind: "counter"; counter: "white" | "red" }
  | { kind: "buff" }
  | { kind: "duplicate" }
  | { kind: "label" }
  | { kind: "ping" }
  | { kind: "target"; sourceCardId: string; sourceCardName: string; sourceAnchor: "board" | "chain" }
  | { kind: "transfer_control" }
  | { kind: "equip"; equipmentCardId: string }
  | { kind: "play_hidden"; cardId: string; from: Zone };

export interface HoverPreviewState {
  card: CardInstance;
  anchor: PreviewAnchorRect;
  preferredSide?: "left" | "right";
  x: number;
  y: number;
  landscape: boolean;
  rotationDeg: 0 | 45 | 90;
  scale: number;
  outerWidth: number;
  outerHeight: number;
  imageWidth: number;
  imageHeight: number;
  rulesHeight: number;
}

export interface ShowCardPreviewOptions {
  landscape?: boolean;
  rotationDeg?: 0 | 45 | 90;
  scale?: number;
  preferredSide?: "left" | "right";
  /** Hide if the card has no art (runes, placeholders). */
  allowMissingArt?: boolean;
}

export type PreviewAnchorInput =
  | HTMLElement
  | PreviewAnchorRect
  | { clientX: number; clientY: number }
  | null
  | undefined;

export interface MenuItemDescriptor {
  id: string;
  label: string;
  disabled?: boolean;
  hint?: string;
  tone?: "default" | "danger" | "positive";
  checked?: boolean;
  onSelect: () => void;
}

export interface MenuSectionDescriptor {
  title?: string;
  items: MenuItemDescriptor[];
}

export interface BoardMenuState {
  x: number;
  y: number;
  /** Optional heading rendered above the first section. */
  title?: string;
  sections: MenuSectionDescriptor[];
}

export interface DropZoneHandlers {
  onDragEnter: (event: React.DragEvent<HTMLElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  onDrop: (event: React.DragEvent<HTMLElement>) => void;
  onContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
  "data-drop-zone-root"?: string;
  "data-zone-owner"?: "self" | "opponent";
  /** 411.2: this battlefield zone is a clickable prompt option. */
  "data-strict-prompt-option"?: "true";
}

export interface DragUiState {
  active: boolean;
  kind: string | null;
  sourceZone: string | null;
  sourceOwner: "self" | "opponent" | null;
  sourceCardId: string | null;
  overZone: string | null;
  overOwner: "self" | "opponent" | null;
  toIndex: number | null;
}

export interface LabelEditorRequest {
  zone: Zone;
  card: CardInstance;
  owner: "self" | "opponent";
  slot?: 0 | 1 | 2;
}

export interface CounterEditorRequest {
  zone: Zone;
  card: CardInstance;
  owner: "self" | "opponent";
}

export interface PileViewerRequest {
  slot: "trash" | "banished";
  owner: "self" | "opponent";
}

export interface BoardInteractionValue {
  slotProps: BoardSlotProps;
  viewerId: string;
  mode: BoardSlotProps["mode"];
  canAct: boolean;

  /* strict-rules board view (null in sandbox rooms) */
  strictView: StrictBoardView | null;
  /** §6.4 manual window is open for the acting seat (sandbox board actions stay legal). */
  strictManual: boolean;
  /** 411.2 object-prompt options to highlight on the board. */
  strictPromptOptionIds: ReadonlySet<string>;
  /** Prompt option currently hovered in the banner's chip list (stronger board highlight). */
  strictPromptHoverId: string | null;

  /* hover preview */
  showCardPreview: (card: CardInstance, anchor?: PreviewAnchorInput, options?: ShowCardPreviewOptions) => void;
  showCardPreviewByName: (name: string, anchor?: PreviewAnchorInput, options?: ShowCardPreviewOptions) => void;
  hideCardPreview: () => void;
  hoveredCardId: string | null;

  /* selection / modes */
  selectedCardIds: ReadonlySet<string>;
  targetableCardIds: ReadonlySet<string>;
  armedAction: ArmedAction;
  setArmedAction: (action: ArmedAction) => void;
  labelSelection: LabelPreset | null;
  drag: DragUiState;

  /* card events */
  handleCardEvent: (event: CardEvent) => void;
  handleTouchLongPress: (event: CardEvent) => void;
  handleCardDragStart: (event: CardEvent, native: React.DragEvent<HTMLElement>) => void;
  handleCardDragEnd: () => void;
  handleCardPointerDown: (event: React.PointerEvent<HTMLElement>, cardEvent: CardEvent) => void;
  pingedCardId: string | null;
  /** Realtime card ping is presence-only; this drives the local flash. */
  pingCard: (cardId: string) => void;

  /* zones */
  getDropZoneHandlers: (zone: string, owner: "self" | "opponent") => DropZoneHandlers;
  /** 811.1.b: drop pocket that hides the dragged card at this battlefield. */
  getHideDropZoneHandlers: (zone: string, owner: "self" | "opponent") => DropZoneHandlers;
  handleZoneContextMenu: (zone: string, owner: "self" | "opponent", event: React.MouseEvent) => void;
  handlePilePress: (slot: "mainDeck" | "runeDeck" | "trash" | "banished", owner: "self" | "opponent", event: React.MouseEvent) => void;
  handlePileContextMenu: (slot: "mainDeck" | "runeDeck" | "trash" | "banished", owner: "self" | "opponent", event: React.MouseEvent) => void;
  handlePileDragStart: (
    slot: "mainDeck" | "runeDeck",
    owner: "self" | "opponent",
    card: CardInstance | null,
    event: React.DragEvent,
  ) => void;
  handlePileDragEnd: () => void;
  handleBattlefieldMarkerPress: (zone: Zone, owner: "self" | "opponent", event: React.MouseEvent) => void;
  handleBattlefieldMarkerDragStart: (zone: Zone, owner: "self" | "opponent", event: React.DragEvent<HTMLElement>) => void;

  /* board */
  handleBoardContextMenu: (event: React.MouseEvent) => void;
  handleBoardPointerDown: (event: React.PointerEvent) => void;
  handleEndTurn: () => void;
  handleSwitchPerspective: () => void;

  /* editors */
  openLabelEditor: (request: LabelEditorRequest) => void;
  openCounterEditor: (request: CounterEditorRequest) => void;
  openPileViewer: (request: PileViewerRequest) => void;

  /* low-level helpers used by sibling slots */
  sendIntent: (intent: GameActionIntent, owner?: "self" | "opponent") => void;
  playCard: (zone: Zone, card: CardInstance, owner: "self" | "opponent") => void;
}

/** Exposed to the match log: hover a card name to show the same preview layer. */
export interface CardHoverPreviewApi {
  showCardPreview: BoardInteractionValue["showCardPreview"];
  showCardPreviewByName: BoardInteractionValue["showCardPreviewByName"];
  hideCardPreview: () => void;
}

export interface HoverPreviewRect extends PreviewAnchorRect {}
export type { HoverPreviewLayout };
