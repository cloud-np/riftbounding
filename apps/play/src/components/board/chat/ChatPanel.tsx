"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { resolveLocale } from "@rift/i18n";
import type { RoomPlayer } from "@rift/protocol";

import { soundEngine } from "@/runtime";

import { EmoteWheel, type Emote } from "../emotes";
import { ChevronDownIcon, EmoteIcon, HelpIcon, SendIcon } from "../header/icons";
import { useBoardTranslator } from "../sidebar/i18n";
import { formatLogTime } from "../log/log-segments";
import {
  normalizeChatEntries,
  type ChatEntryLike,
  type NormalizedChatEntry,
  type SidebarChatBinding,
} from "./types";

export interface ChatPanelProps {
  viewerId: string;
  players: readonly RoomPlayer[];
  locale?: string;
  chat?: SidebarChatBinding;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

export function ChatPanel({
  viewerId,
  players,
  locale,
  chat,
  expanded = true,
  onToggleExpanded,
}: ChatPanelProps) {
  const t = useBoardTranslator(locale);
  const [localEntries, setLocalEntries] = useState<ChatEntryLike[]>([]);
  const [draft, setDraft] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [emoteAnchor, setEmoteAnchor] = useState<{ x: number; y: number } | null>(null);
  const [localUnread, setLocalUnread] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);
  const typingRef = useRef(false);
  const localIdRef = useRef(0);
  const lastEntryIdRef = useRef<string | null>(null);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const viewer = players.find((player) => player.id === viewerId);

  const entries = useMemo<NormalizedChatEntry[]>(
    () => normalizeChatEntries(chat?.entries === undefined ? localEntries : chat.entries, players),
    [chat?.entries, localEntries, players],
  );

  const canSend = chat?.canSend !== false;
  const sendPaused = chat?.sendPaused === true;
  const disabled = !canSend || sendPaused;

  const publishTyping = useCallback(
    (isTyping: boolean) => {
      if (typingRef.current === isTyping) return;
      typingRef.current = isTyping;
      chat?.publishTyping?.(isTyping);
    },
    [chat],
  );

  useEffect(() => () => publishTyping(false), [publishTyping]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [entries.length]);

  useEffect(() => {
    const last = entries.at(-1);
    if (!last) {
      lastEntryIdRef.current = null;
      return;
    }
    if (lastEntryIdRef.current === null) {
      lastEntryIdRef.current = last.id;
      return;
    }
    if (lastEntryIdRef.current === last.id) return;
    lastEntryIdRef.current = last.id;
    if (last.authorPlayerId === viewerId) return;
    soundEngine.play("chat_message");
    if (!expandedRef.current) setLocalUnread((current) => current + 1);
  }, [entries, viewerId]);

  useEffect(() => {
    if (expanded) setLocalUnread(0);
  }, [expanded]);

  const unreadCount = chat?.unreadCount ?? localUnread;

  const submit = useCallback(() => {
    const value = draft.trim();
    if (!value || disabled) return;
    const clientEntryId = `chat-${Date.now().toString(36)}-${(localIdRef.current += 1)}`;
    const sent = chat?.send?.(value, clientEntryId);
    if (sent === false) return;
    if (!chat?.send) {
      setLocalEntries((current) => [
        ...current,
        {
          id: clientEntryId,
          at: Date.now(),
          text: value,
          author: viewer?.name ?? "You",
          authorPlayerId: viewerId,
          authorRole: "player",
        },
      ]);
    }
    setDraft("");
    publishTyping(false);
  }, [chat, disabled, draft, publishTyping, viewer?.name, viewerId]);

  const typingNames = useMemo(() => {
    const names = chat?.typingPlayers ?? [];
    if (names.length === 0) return null;
    const formatted =
      names.length === 1
        ? names[0]!
        : new Intl.ListFormat(resolveLocale(locale)).format([...names]);
    return names.length === 1
      ? (t("sim.typingOne", { name: formatted }) ?? `${formatted} is typing...`)
      : (t("sim.typingMany", { names: formatted }) ?? `${formatted} are typing...`);
  }, [chat?.typingPlayers, locale, t]);

  const selectEmote = useCallback(
    (emote: Emote) => {
      chat?.onBoardEmote?.(emote.id);
    },
    [chat],
  );

  return (
    <section
      data-chat-panel-root="true"
      data-chat-panel="true"
      aria-label={t("sim.chat") ?? "Chat"}
      className={`relative flex min-h-0 flex-col overflow-hidden rounded-[0.18rem] border border-[rgba(155,183,219,0.18)] bg-[linear-gradient(180deg,rgba(16,29,48,0.78),rgba(8,17,31,0.86))] shadow-[inset_0_1px_0_rgba(235,246,255,0.04)] ${
        expanded ? "h-[clamp(9rem,22vh,12rem)] shrink-0" : "shrink-0"
      }`}
    >
      <header className="flex shrink-0 items-center justify-between gap-[0.32rem] border-b border-[rgba(176,196,222,0.12)] px-[0.4rem] py-[0.26rem]">
        <h3 className="m-0 flex items-center gap-[0.28rem] text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[#9fb7d8]">
          {t("sim.chat") ?? "Chat"}
          {unreadCount ? (
            <span className="inline-flex h-[0.92rem] min-w-[0.92rem] items-center justify-center rounded-full border border-[rgba(116,239,255,0.34)] bg-[rgba(20,67,82,0.6)] px-[0.18rem] font-mono text-[0.5rem] leading-none text-[#d9f7ff]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </h3>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={
            expanded
              ? (t("sim.collapseChat") ?? "Collapse chat")
              : (t("sim.expandChat") ?? "Expand chat")
          }
          onClick={onToggleExpanded}
          className="inline-flex h-[1rem] w-[1rem] items-center justify-center rounded-[0.14rem] text-[#8fa8c8] transition-colors hover:bg-[rgba(148,177,216,0.12)] hover:text-[#eaf5ff]"
        >
          <ChevronDownIcon
            className={`h-[0.76rem] w-[0.76rem] ${expanded ? "rotate-0" : "rotate-180"}`}
          />
        </button>
      </header>

      {expanded ? (
        <>
          <div className="relative min-h-0 flex-1">
            <ul
              ref={listRef}
              data-chat-message-list="true"
              className="relative z-2 m-0 grid h-full min-h-0 list-none auto-rows-min content-start gap-[0.08rem] overflow-auto p-0 pr-[0.02rem] py-[0.12rem] select-text"
            >
              {entries.length === 0 ? (
                <li className="pointer-events-none px-[0.24rem] text-[0.58rem] leading-[1.3] text-[#7f96b5]">
                  {t("sim.noMessagesYet") ?? "No messages yet."}
                </li>
              ) : null}
              {entries.map((entry) => {
                const self = entry.authorPlayerId === viewerId;
                const opponent = !self && entry.authorPlayerId !== null;
                const judge = entry.authorRole === "judge";
                return (
                  <li
                    key={entry.id}
                    data-chat-entry-tone={
                      entry.verifiedJudge
                        ? "verified-judge"
                        : judge
                          ? "community-judge"
                          : self
                            ? "player"
                            : "opponent"
                    }
                    aria-label={
                      t("sim.chatMessageAccessibility", {
                        author: self ? (t("sim.you") ?? "You") : entry.author,
                        time: formatLogTime(entry.at, locale),
                        message: entry.text,
                      }) ?? `${entry.author}: ${entry.text}`
                    }
                    className={`w-fit max-w-[calc(100%-0.42rem)] cursor-text select-text rounded-[0.22rem] border px-[0.2rem] py-[0.13rem] ${
                      judge && entry.verifiedJudge
                        ? "justify-self-start border-[rgba(195,164,255,0.5)] bg-[rgba(66,39,100,0.88)] shadow-[inset_0_0_0_1px_rgba(195,164,255,0.1)]"
                        : judge
                          ? "justify-self-start border-[rgba(118,191,255,0.45)] bg-[rgba(26,54,88,0.88)] shadow-[inset_0_0_0_1px_rgba(118,191,255,0.1)]"
                          : self
                            ? "justify-self-end border-[rgba(123,226,183,0.28)] bg-[rgba(22,58,49,0.82)] shadow-[inset_0_0_0_1px_rgba(123,226,183,0.08)]"
                            : "justify-self-start border-[rgba(205,176,115,0.28)] bg-[rgba(70,51,28,0.8)] shadow-[inset_0_0_0_1px_rgba(205,176,115,0.09)]"
                    }`}
                  >
                    <p className="m-0 min-w-0 whitespace-pre-wrap break-words text-[clamp(0.6rem,0.53rem+0.26vmin,0.8rem)] leading-[1.24] text-[#e2ebf8]">
                      <span className="sr-only">
                        {self ? (t("sim.you") ?? "You") : entry.author} {t("sim.messageAt") ?? "at"}{" "}
                        {formatLogTime(entry.at, locale)}:{" "}
                      </span>
                      {opponent || judge ? (
                        <span className="mb-[0.08rem] flex min-w-0 items-center gap-[0.2rem] text-[0.5rem] font-semibold uppercase tracking-[0.06em] text-[#9fdff2]">
                          <span className="min-w-0 truncate normal-case tracking-normal text-[#dbeefa]">
                            {entry.author}
                          </span>
                        </span>
                      ) : null}
                      <span>{entry.text}</span>{" "}
                      <span className="ml-[0.22rem] inline-block whitespace-nowrap align-baseline text-[clamp(0.54rem,0.46rem+0.24vmin,0.72rem)] leading-[1.1] text-(--text-dim) opacity-[0.72]">
                        {formatLogTime(entry.at, locale)}
                      </span>
                    </p>
                  </li>
                );
              })}
            </ul>
            {typingNames ? (
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-none absolute left-[0.28rem] top-[0.28rem] z-5 max-w-[calc(100%-0.56rem)] rounded-[0.28rem] border border-[rgba(116,239,255,0.48)] bg-[linear-gradient(180deg,rgba(18,47,72,0.97),rgba(8,24,43,0.97))] px-[0.42rem] py-[0.22rem] text-[clamp(0.54rem,0.46rem+0.24vmin,0.72rem)] text-[#d9f7ff] shadow-[0_10px_22px_rgba(2,8,20,0.46),0_0_0_1px_rgba(116,239,255,0.12)]"
              >
                {typingNames}
              </div>
            ) : null}
          </div>

          <div className="relative z-3 shrink-0 border-t border-[rgba(176,196,222,0.14)] px-[0.28rem] pb-[0.24rem] pt-[0.22rem]">
            {!canSend ? (
              <p className="m-0 mb-[0.14rem] text-[0.56rem] leading-[1.35] text-[#b8c9dc]">
                {t("sim.judgeChat.closedHint") ?? "Messages cannot be sent here."}
              </p>
            ) : sendPaused ? (
              <p
                role="status"
                className="m-0 mb-[0.14rem] text-[0.56rem] leading-[1.35] text-[#f0c69e]"
              >
                {t("sim.chatSendPaused") ?? "Chat reconnecting…"}
              </p>
            ) : null}

            <div
              data-testid="chat-composer-input"
              className={`relative min-w-0 overflow-hidden rounded-[0.24rem] border bg-[rgba(34,52,74,0.9)] transition-colors focus-within:border-[rgba(166,185,209,0.32)] focus-within:shadow-[0_0_0_1px_rgba(166,185,209,0.12)] ${
                disabled
                  ? "border-[rgba(166,185,209,0.12)] opacity-[0.72]"
                  : "border-[rgba(166,185,209,0.2)]"
              }`}
            >
              <textarea
                rows={1}
                value={draft}
                disabled={disabled}
                maxLength={1000}
                placeholder={t("sim.typeMessage") ?? "Type message..."}
                aria-label={t("sim.chat") ?? "Chat"}
                onChange={(event) => {
                  setDraft(event.currentTarget.value);
                  if (event.currentTarget.value.trim()) publishTyping(true);
                  else publishTyping(false);
                }}
                onFocus={() => {
                  if (draft.trim()) publishTyping(true);
                }}
                onBlur={() => publishTyping(false)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setDraft("");
                    publishTyping(false);
                    return;
                  }
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
                className="relative z-1 block max-h-[4.4rem] min-h-[1.6rem] w-full resize-none overflow-y-auto border-0 bg-transparent px-[0.24rem] py-[0.19rem] text-[clamp(0.68rem,0.58rem+0.32vmin,0.9rem)] leading-[1.2] text-(--text-main) outline-none placeholder:text-[#8498af] focus:outline-none focus-visible:outline-none focus:ring-0"
              />
            </div>

            <div className="mt-[0.16rem] flex w-full min-w-0 items-center gap-[0.14rem]">
              <div className="relative">
                <button
                  type="button"
                  aria-label={t("sim.gameInfoButton") ?? "Help"}
                  aria-expanded={helpOpen}
                  onClick={() => {
                    if (chat?.onHelp) {
                      chat.onHelp();
                      return;
                    }
                    setHelpOpen((current) => !current);
                  }}
                  className="inline-flex min-h-6 items-center gap-[0.14rem] rounded-[0.24rem] border border-[rgba(166,185,209,0.24)] bg-[rgba(31,47,69,0.88)] px-[0.24rem] py-[0.16rem] text-[0.6rem] font-semibold leading-none text-[#dbe7f8] transition-colors hover:border-[rgba(196,215,240,0.42)] hover:text-white"
                >
                  <HelpIcon className="h-[0.64rem] w-[0.64rem]" />
                  {t("sim.gameInfoButton") ?? "Help"}
                </button>
                {helpOpen ? (
                  <div
                    role="dialog"
                    aria-label={t("sim.gameInfoButton") ?? "Help"}
                    className="absolute bottom-[calc(100%+0.34rem)] left-0 z-140 w-[15.6rem] max-w-[calc(100vw-2rem)] rounded-[0.3rem] border border-[rgba(173,201,242,0.34)] bg-[linear-gradient(180deg,rgba(18,36,58,0.99),rgba(8,18,33,0.99))] p-[0.44rem] text-[0.6rem] leading-[1.4] text-[#dbe7f8] shadow-[0_14px_30px_rgba(2,6,18,0.55)]"
                  >
                    <strong className="block text-[0.66rem] text-[#eef7ff]">
                      {t("sim.controlsHelp") ?? "Hotkeys and mouse shortcuts"}
                    </strong>
                    <ul className="m-0 mt-[0.28rem] grid list-none gap-[0.14rem] p-0 text-[0.56rem] text-[#a9bfd8]">
                      {[
                        ["Space", t("sim.hotkeyAdvanceTurn") ?? "Advance the turn"],
                        ["S", t("sim.hotkeyResolveChain") ?? "Resolve the chain"],
                        ["R", t("sim.hotkeyRewindLastAction") ?? "Rewind the last action"],
                        ["E", t("sim.hotkeyOpenEmoteWheel") ?? "Open the emote wheel"],
                        ["V", t("sim.hotkeySwitchPerspective") ?? "Switch perspective"],
                      ].map(([key, label]) => (
                        <li key={key} className="flex items-baseline gap-[0.28rem]">
                          <kbd className="inline-flex min-w-[1.25rem] justify-center rounded-[0.12rem] border border-[rgba(190,214,235,0.3)] bg-[rgba(20,38,60,0.8)] px-[0.16rem] py-[0.03rem] font-mono text-[0.52rem] text-[#eaf5ff]">
                            {key}
                          </kbd>
                          <span>{label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                aria-label={t("sim.emoteWheel") ?? "Emote wheel"}
                title={t("sim.emoteWheel") ?? "Emote wheel"}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setEmoteAnchor({ x: rect.left + rect.width / 2, y: rect.top - 95 });
                }}
                className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-[0.24rem] border border-[rgba(166,185,209,0.22)] bg-[rgba(31,47,69,0.72)] text-[#cfe0fb] transition-colors hover:border-[rgba(196,215,240,0.4)] hover:text-white"
              >
                <EmoteIcon className="h-[0.72rem] w-[0.72rem]" />
              </button>

              <button
                type="button"
                onClick={submit}
                disabled={disabled || draft.trim().length === 0}
                aria-label={t("sim.send") ?? "Send"}
                className="ml-auto inline-flex shrink-0 items-center justify-center gap-[0.13rem] rounded-[0.24rem] border border-[rgba(166,185,209,0.24)] bg-[rgba(57,81,110,0.92)] px-[0.26rem] py-[0.18rem] text-[0.62rem] font-semibold leading-[1.15] text-(--text-soft) transition-colors hover:border-[rgba(196,215,240,0.42)] hover:bg-[rgba(70,98,132,0.96)] hover:text-white disabled:cursor-default disabled:opacity-[0.55] focus-visible:outline-2 focus-visible:outline-[#9fe5ef]"
              >
                <SendIcon className="h-[0.64rem] w-[0.64rem]" />
                {t("sim.send") ?? "Send"}
              </button>
            </div>
          </div>
        </>
      ) : null}

      <EmoteWheel
        open={emoteAnchor !== null}
        anchor={emoteAnchor}
        locale={locale}
        onClose={() => setEmoteAnchor(null)}
        onSelect={selectEmote}
      />
    </section>
  );
}
