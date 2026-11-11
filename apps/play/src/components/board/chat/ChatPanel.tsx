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
      className={`relative flex min-h-0 flex-col overflow-hidden rounded-[0.18rem] border border-[rgba(175,182,190,0.18)] bg-[linear-gradient(180deg,rgba(25,24,23,0.78),rgba(16,15,14,0.86))] shadow-[inset_0_1px_0_rgba(245,246,245,0.04)] ${
        expanded ? "h-[clamp(9rem,22vh,12rem)] shrink-0" : "shrink-0"
      }`}
    >
      <header className="flex shrink-0 items-center justify-between gap-[0.32rem] border-b border-[rgba(191,195,201,0.12)] px-[0.4rem] py-[0.26rem]">
        <h3 className="m-0 flex items-center gap-[0.28rem] text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[#b1b6be]">
          {t("sim.chat") ?? "Chat"}
          {unreadCount ? (
            <span className="inline-flex h-[0.92rem] min-w-[0.92rem] items-center justify-center rounded-full border border-[rgba(184,224,225,0.34)] bg-[rgba(51,50,49,0.6)] px-[0.18rem] font-mono text-[0.5rem] leading-none text-[#edf4f3]">
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
          className="inline-flex h-[1rem] w-[1rem] items-center justify-center rounded-[0.14rem] text-[#a1a7ae] transition-colors hover:bg-[rgba(169,176,185,0.12)] hover:text-[#f4f5f4]"
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
                <li className="pointer-events-none px-[0.24rem] text-[0.58rem] leading-[1.3] text-[#90959c]">
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
                        ? "justify-self-start border-[rgba(187,174,201,0.5)] bg-[rgba(44,43,42,0.88)] shadow-[inset_0_0_0_1px_rgba(187,174,201,0.1)]"
                        : judge
                          ? "justify-self-start border-[rgba(162,185,203,0.45)] bg-[rgba(45,44,43,0.88)] shadow-[inset_0_0_0_1px_rgba(162,185,203,0.1)]"
                          : self
                            ? "justify-self-end border-[rgba(123,226,183,0.28)] bg-[rgba(22,58,49,0.82)] shadow-[inset_0_0_0_1px_rgba(123,226,183,0.08)]"
                            : "justify-self-start border-[rgba(205,176,115,0.28)] bg-[rgba(70,51,28,0.8)] shadow-[inset_0_0_0_1px_rgba(205,176,115,0.09)]"
                    }`}
                  >
                    <p className="m-0 min-w-0 whitespace-pre-wrap break-words text-[clamp(0.6rem,0.53rem+0.26vmin,0.8rem)] leading-[1.24] text-[#ebebec]">
                      <span className="sr-only">
                        {self ? (t("sim.you") ?? "You") : entry.author} {t("sim.messageAt") ?? "at"}{" "}
                        {formatLogTime(entry.at, locale)}:{" "}
                      </span>
                      {opponent || judge ? (
                        <span className="mb-[0.08rem] flex min-w-0 items-center gap-[0.2rem] text-[0.5rem] font-semibold uppercase tracking-[0.06em] text-[#c5d8db]">
                          <span className="min-w-0 truncate normal-case tracking-normal text-[#e9eded]">
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
                className="pointer-events-none absolute left-[0.28rem] top-[0.28rem] z-5 max-w-[calc(100%-0.56rem)] rounded-[0.28rem] border border-[rgba(184,224,225,0.48)] bg-[linear-gradient(180deg,rgba(38,37,36,0.97),rgba(21,20,19,0.97))] px-[0.42rem] py-[0.22rem] text-[clamp(0.54rem,0.46rem+0.24vmin,0.72rem)] text-[#edf4f3] shadow-[0_10px_22px_rgba(8,7,6,0.46),0_0_0_1px_rgba(184,224,225,0.12)]"
              >
                {typingNames}
              </div>
            ) : null}
          </div>

          <div className="relative z-3 shrink-0 border-t border-[rgba(191,195,201,0.14)] px-[0.28rem] pb-[0.24rem] pt-[0.22rem]">
            {!canSend ? (
              <p className="m-0 mb-[0.14rem] text-[0.56rem] leading-[1.35] text-[#c6c9cb]">
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
              className={`relative min-w-0 overflow-hidden rounded-[0.24rem] border bg-[rgba(44,43,42,0.9)] transition-colors focus-within:border-[rgba(181,185,189,0.32)] focus-within:shadow-[0_0_0_1px_rgba(181,185,189,0.12)] ${
                disabled
                  ? "border-[rgba(181,185,189,0.12)] opacity-[0.72]"
                  : "border-[rgba(181,185,189,0.2)]"
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
                className="relative z-1 block max-h-[4.4rem] min-h-[1.6rem] w-full resize-none overflow-y-auto border-0 bg-transparent px-[0.24rem] py-[0.19rem] text-[clamp(0.68rem,0.58rem+0.32vmin,0.9rem)] leading-[1.2] text-(--text-main) outline-none placeholder:text-[#93979b] focus:outline-none focus-visible:outline-none focus:ring-0"
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
                  className="inline-flex min-h-6 items-center gap-[0.14rem] rounded-[0.24rem] border border-[rgba(181,185,189,0.24)] bg-[rgba(40,39,38,0.88)] px-[0.24rem] py-[0.16rem] text-[0.6rem] font-semibold leading-none text-[#e6e7e9] transition-colors hover:border-[rgba(211,215,219,0.42)] hover:text-white"
                >
                  <HelpIcon className="h-[0.64rem] w-[0.64rem]" />
                  {t("sim.gameInfoButton") ?? "Help"}
                </button>
                {helpOpen ? (
                  <div
                    role="dialog"
                    aria-label={t("sim.gameInfoButton") ?? "Help"}
                    className="absolute bottom-[calc(100%+0.34rem)] left-0 z-140 w-[15.6rem] max-w-[calc(100vw-2rem)] rounded-[0.3rem] border border-[rgba(193,200,210,0.34)] bg-[linear-gradient(180deg,rgba(31,30,29,0.99),rgba(16,15,14,0.99))] p-[0.44rem] text-[0.6rem] leading-[1.4] text-[#e6e7e9] shadow-[0_14px_30px_rgba(7,6,5,0.55)]"
                  >
                    <strong className="block text-[0.66rem] text-[#f7f7f6]">
                      {t("sim.controlsHelp") ?? "Hotkeys and mouse shortcuts"}
                    </strong>
                    <ul className="m-0 mt-[0.28rem] grid list-none gap-[0.14rem] p-0 text-[0.56rem] text-[#b9bec3]">
                      {[
                        ["Space", t("sim.hotkeyAdvanceTurn") ?? "Advance the turn"],
                        ["S", t("sim.hotkeyResolveChain") ?? "Resolve the chain"],
                        ["R", t("sim.hotkeyRewindLastAction") ?? "Rewind the last action"],
                        ["E", t("sim.hotkeyOpenEmoteWheel") ?? "Open the emote wheel"],
                        ["V", t("sim.hotkeySwitchPerspective") ?? "Switch perspective"],
                      ].map(([key, label]) => (
                        <li key={key} className="flex items-baseline gap-[0.28rem]">
                          <kbd className="inline-flex min-w-[1.25rem] justify-center rounded-[0.12rem] border border-[rgba(207,213,216,0.3)] bg-[rgba(32,31,30,0.8)] px-[0.16rem] py-[0.03rem] font-mono text-[0.52rem] text-[#f4f5f4]">
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
                className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-[0.24rem] border border-[rgba(181,185,189,0.22)] bg-[rgba(40,39,38,0.72)] text-[#dde0e5] transition-colors hover:border-[rgba(211,215,219,0.4)] hover:text-white"
              >
                <EmoteIcon className="h-[0.72rem] w-[0.72rem]" />
              </button>

              <button
                type="button"
                onClick={submit}
                disabled={disabled || draft.trim().length === 0}
                aria-label={t("sim.send") ?? "Send"}
                className="ml-auto inline-flex shrink-0 items-center justify-center gap-[0.13rem] rounded-[0.24rem] border border-[rgba(181,185,189,0.24)] bg-[rgba(68,67,66,0.92)] px-[0.26rem] py-[0.18rem] text-[0.62rem] font-semibold leading-[1.15] text-(--text-soft) transition-colors hover:border-[rgba(211,215,219,0.42)] hover:bg-[rgba(90,97,105,0.96)] hover:text-white disabled:cursor-default disabled:opacity-[0.55] focus-visible:outline-2 focus-visible:outline-[#c7dddc]"
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
