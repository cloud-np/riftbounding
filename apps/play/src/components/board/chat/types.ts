import type { RoomPlayer } from "@rift/protocol";

/** Wire chat entry as received by `chat_sync` / `chat_append` (extra fields preserved). */
export interface ChatEntryLike {
  id?: string;
  at?: number;
  text?: string;
  author?: string;
  authorName?: string;
  authorPlayerId?: string;
  authorId?: string;
  authorRole?: string;
  visibility?: string;
  verifiedJudge?: boolean;
  judgeCallId?: string;
  [key: string]: unknown;
}

export interface NormalizedChatEntry {
  id: string;
  at: number;
  text: string;
  author: string;
  authorPlayerId: string | null;
  authorRole: "player" | "judge" | "staff" | "system";
  verifiedJudge: boolean;
  visibility: "public" | "private";
}

export interface SidebarChatBinding {
  entries?: readonly ChatEntryLike[];
  canSend?: boolean;
  sendPaused?: boolean;
  authorId?: string | null;
  /** `useChat().send` — return false to keep the draft (paused/rejected). */
  send?: (text: string, clientEntryId?: string, judgeCallId?: string) => boolean;
  publishTyping?: (isTyping: boolean) => void;
  typingPlayers?: readonly string[];
  unreadCount?: number;
  onHelp?: () => void;
  onBoardEmote?: (emoteId: string) => void;
}

export function normalizeChatEntry(
  raw: ChatEntryLike,
  index: number,
  players: readonly RoomPlayer[],
): NormalizedChatEntry {
  const authorPlayerId =
    typeof raw.authorPlayerId === "string"
      ? raw.authorPlayerId
      : typeof raw.authorId === "string"
        ? raw.authorId
        : null;
  const player = authorPlayerId
    ? players.find((candidate) => candidate.id === authorPlayerId)
    : undefined;
  const author =
    (typeof raw.author === "string" && raw.author.trim()) ||
    (typeof raw.authorName === "string" && raw.authorName.trim()) ||
    player?.name ||
    "Player";
  const role: NormalizedChatEntry["authorRole"] =
    raw.authorRole === "judge" || raw.verifiedJudge === true
      ? "judge"
      : raw.authorRole === "staff"
        ? "staff"
        : raw.authorRole === "system"
          ? "system"
          : "player";
  return {
    id:
      typeof raw.id === "string" && raw.id
        ? raw.id
        : `chat-entry-${index}-${typeof raw.at === "number" ? raw.at : "now"}`,
    at: typeof raw.at === "number" && Number.isFinite(raw.at) ? raw.at : Date.now(),
    text: typeof raw.text === "string" ? raw.text : "",
    author,
    authorPlayerId,
    authorRole: role,
    verifiedJudge: raw.verifiedJudge === true,
    visibility: raw.visibility === "private" ? "private" : "public",
  };
}

export function normalizeChatEntries(
  entries: readonly ChatEntryLike[] | undefined,
  players: readonly RoomPlayer[],
): NormalizedChatEntry[] {
  return (entries ?? []).map((entry, index) => normalizeChatEntry(entry, index, players));
}
