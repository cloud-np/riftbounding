import type { ActionHandler } from "../types";
import { updateBoardSettings } from "../state/selectors";
import { bool } from "./common";

/** orig: 35qz5rkx7yexy.js:22739 "set_show_legend_xp_counter" */
export const setShowLegendXpCounter: ActionHandler = ({ room, player, action }) => {
  updateBoardSettings(room, player.id, { showLegendXpCounter: bool(action.visible) });
};

/** orig: 35qz5rkx7yexy.js:22742 "set_stop_at_beginning_phase" */
export const setStopAtBeginningPhase: ActionHandler = ({ room, player, action }) => {
  updateBoardSettings(room, player.id, { stopAtBeginningPhase: bool(action.enabled) });
};

/** orig: 35qz5rkx7yexy.js:22749 "set_skip_draw_phase" */
export const setSkipDrawPhase: ActionHandler = ({ room, player, action }) => {
  updateBoardSettings(room, player.id, { skipDrawPhase: bool(action.enabled) });
};

/** orig: 35qz5rkx7yexy.js:22752 "set_auto_score_from_hold" */
export const setAutoScoreFromHold: ActionHandler = ({ room, player, action }) => {
  updateBoardSettings(room, player.id, { autoScoreFromHold: bool(action.enabled) });
};
