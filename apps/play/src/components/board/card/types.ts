import type { CardInstance, Zone } from "@rift/protocol";

export type CardSide = "self" | "opponent";

export interface CardEvent {
  type: "select" | "context" | "hover" | "hoverEnd" | "doubleClick";
  card: CardInstance;
  zone: Zone;
  owner: CardSide;
  exhausted: boolean;
  faceDown: boolean;
  clientX?: number;
  clientY?: number;
  pointerType?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  button?: number;
  /** Set by the touch long-press path: open the context menu, do not select. */
  longPress?: boolean;
  /** Source element rect captured at event time (hover preview anchoring). */
  anchorRect?: { left: number; top: number; right: number; bottom: number; width: number; height: number };
}

export type CardEventHandler = (event: CardEvent) => void;

export interface GameCardVisualProps {
  card: CardInstance;
  zone: Zone;
  owner: CardSide;
  faceDown?: boolean;
  exhausted?: boolean;
  selected?: boolean;
  targetable?: boolean;
  dimmed?: boolean;
  hovered?: boolean;
  labels?: string[];
  attachedCards?: CardInstance[];
  mightBuff?: number;
  compact?: boolean;
  draggable?: boolean;
  onCardEvent?: CardEventHandler;
}
