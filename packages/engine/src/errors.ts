/**
 * Error strings observed in the original client mirror / server contract.
 * Keep verbatim: the UI may surface them and the oracle compares them.
 */
export const ENGINE_ERRORS = {
  unknownAction: (type: string) => `Unknown action type: ${type}`,
  unknownPlayer: "The acting player is not seated in this room.",
  notInGame: "That action is only available during a game.",
  invalidPhase: "That action is not available in the current phase.",
  invalidOperations: (kind: string) => `Invalid ${kind.replaceAll("_", " ")} operations.`,
  chainFull: "The Chain is full.",
  runeConservation:
    "That action would add or remove runes from a rune pool, so it was not applied.",
  autoPayUnavailable:
    "Auto-pay could not complete because the card or available resources changed. No resources were spent.",
  expectedExhaustion: "Expected exhaustion state is required.",
  invalidLabelSlot: "Invalid card label slot.",
  forwardUnavailable: "There is no rewound timeline to restore.",
  rewindUnavailable: "There is no action available to rewind.",
  rewindConfirmationRequired: "Other players must approve this rewind.",
  rewindRequestNotFound: "That rewind confirmation request is no longer active.",
} as const;

export const ERROR_CODES = {
  unknownAction: "unknown_action",
  unknownPlayer: "unknown_player",
  notInGame: "not_in_game",
  invalidPhase: "invalid_phase",
  invalidOperations: "invalid_operations",
  chainFull: "chain_full",
  runeConservation: "rune_conservation_violation",
  autoPayUnavailable: "auto_pay_unavailable",
  forwardUnavailable: "forward_unavailable",
  rewindUnavailable: "rewind_unavailable",
  rewindConfirmationRequired: "rewind_confirmation_required",
  rewindRequestNotFound: "rewind_request_not_found",
} as const;
