"use client";

import type { BoardSlotProps } from "../../slot-types";
import { StrictRulesPanel } from "../../strict/StrictRulesPanel";
import { DeckPeekPrompt } from "./DeckPeekPrompt";
import { PaymentTray } from "./ResourcesPanel";
import { ShowdownPrompt } from "./ShowdownPrompt";

export function InGamePrompts(props: BoardSlotProps) {
  const { state } = props;
  if (state.phase !== "in_game") return null;
  return (
    <>
      <ShowdownPrompt
        room={state}
        state={state}
        viewerId={props.viewerId}
        controlledPlayerIds={props.controlledPlayerIds}
        mode={props.mode}
        dispatch={props.dispatch}
        dispatchAs={props.dispatchAs}
      />
      <PaymentTray room={state} viewerId={props.viewerId} dispatch={props.dispatch} />
      <DeckPeekPrompt room={state} viewerId={props.viewerId} dispatch={props.dispatch} />
      {state.rulesMode === "strict" ? (
        <StrictRulesPanel
          state={state}
          viewerId={props.viewerId}
          controlledPlayerIds={props.controlledPlayerIds}
          dispatch={props.dispatch}
          dispatchAs={props.dispatchAs}
        />
      ) : null}
    </>
  );
}
