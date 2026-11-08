import type { ComponentType, SVGProps } from "react";

import {
  BattleIcon,
  BoardIcon,
  DeckIcon,
  DrawIcon,
  ForwardIcon,
  InspectIcon,
  LegendXpIcon,
  ResourceIcon,
  RewindIcon,
  ScoreIcon,
  SpellIcon,
  TrashIcon,
  TurnActionIcon,
} from "../header/icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** `actionKind` → icon, mirroring the original match-log icon table. */
export const ACTION_ICONS: Record<string, IconComponent> = {
  turn: TurnActionIcon,
  inspect: InspectIcon,
  draw: DrawIcon,
  deck: DeckIcon,
  trash: TrashIcon,
  resource: ResourceIcon,
  board: BoardIcon,
  spell: SpellIcon,
  battle: BattleIcon,
  score: ScoreIcon,
  "legend-xp": LegendXpIcon,
  rewind: RewindIcon,
  forward: ForwardIcon,
};
