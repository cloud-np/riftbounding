"use client";

import { useEffect, useId, useState } from "react";

import { strings } from "@/components/lobby/strings";
import { Icon } from "@/components/ui/Icon";
import { NativeDialog } from "@/components/ui/NativeDialog";

export interface AccountDialogProps {
  open: boolean;
  onClose: () => void;
  onGuestLogin: (name: string) => void;
  /** Password sign-in against the realtime worker (rejects with a user-facing error). */
  onPasswordLogin?: (username: string, password: string) => Promise<void>;
  /** Optional account creation; enables the "Create an account" footer toggle. */
  onRegisterAccount?: (username: string, password: string) => Promise<void>;
  onSignOut?: () => void;
  guestName?: string | null;
  signedInKind?: "guest" | "account";
  initialName?: string;
  /** Reason the dialog opened ("Sign in to play or spectate." etc). */
  reason?: string | null;
  /** Header "Sign up" opens directly on the create-account view. */
  initialMode?: "login" | "register";
}

const accountVars = {
  ["--account-surface" as string]: "#0f172a",
  ["--account-surface-muted" as string]: "#0b1222",
  ["--account-surface-raised" as string]: "#1e293b",
  ["--account-input" as string]: "#020617",
  ["--account-border" as string]: "#334155",
  ["--account-text" as string]: "#f1f5f9",
  ["--account-text-muted" as string]: "#94a3b8",
  ["--account-accent" as string]: "#67e8f9",
  ["--account-focus" as string]: "#67e8f9",
  ["--account-primary" as string]: "#67e8f9",
  ["--account-primary-text" as string]: "#020617",
};

const oauthButton =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[var(--account-border)] bg-[var(--account-surface)] px-1.5 text-sm font-medium text-[var(--account-text)] transition hover:bg-[var(--account-surface-raised)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--account-focus)]";
const primaryButton =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--account-primary)] px-4 text-sm font-semibold text-[var(--account-primary-text)] transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--account-focus)] disabled:cursor-not-allowed disabled:opacity-60";
const fieldClass =
  "block h-10 w-full min-w-0 rounded-md border border-[var(--account-border)] bg-[var(--account-input)] px-3 text-base text-[var(--account-text)] outline-none transition-colors placeholder:text-[var(--account-text-muted)] focus:border-[var(--account-focus)] focus:ring-2 focus:ring-[var(--account-focus)]/25 sm:text-sm";

/** The original embeds Cloudflare Turnstile (300×72 at 1920). Keep the same footprint;
 * the local auth flow does not submit a challenge token. */
function TurnstileMock() {
  return (
    <div className="flex justify-center pt-4">
      <div
        data-testid="account-turnstile"
        className="flex h-[72px] w-[300px] max-w-full items-center justify-between gap-2 border border-[#3b4556] bg-[#1f2735] px-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
      >
        <span className="flex min-w-0 items-center gap-2.5 text-[0.8rem] leading-tight text-[#e5e7eb]">
          <span
            aria-hidden="true"
            className="inline-flex size-6 shrink-0 items-center justify-center border border-[#6b7280] bg-white"
          />
          {strings["account.turnstile"]}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right text-[0.55rem] leading-tight text-[#9ca3af]">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-5 text-[#f6821f]"
            fill="currentColor"
          >
            <path d="M16.5 12.5c0-2.49-2.01-4.5-4.5-4.5S7.5 10.01 7.5 12.5H4.2c0-4.31 3.49-7.8 7.8-7.8s7.8 3.49 7.8 7.8h-3.3Z" />
          </svg>
          <span className="font-bold tracking-wide text-[#f6821f]">CLOUDFLARE</span>
          <span>
            Privacy <span aria-hidden="true">·</span> Terms
          </span>
        </span>
      </div>
    </div>
  );
}

export function AccountDialog({
  open,
  onClose,
  onGuestLogin,
  onPasswordLogin,
  onRegisterAccount,
  onSignOut,
  guestName,
  signedInKind = "guest",
  initialName = "",
  reason,
  initialMode = "login",
}: AccountDialogProps) {
  const titleId = useId();
  const emailId = useId();
  const passwordId = useId();
  const guestNameId = useId();
  const [name, setName] = useState(initialName);
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setStep("email");
      setEmail("");
      setPassword("");
      setNotice(null);
      setMode(initialMode);
      setSubmitting(false);
    }
  }, [open, initialName, initialMode]);

  const signedIn = Boolean(guestName);

  const submitGuest = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onGuestLogin(trimmed);
  };

  const continueToPassword = () => {
    if (!email.trim()) {
      setNotice(strings["account.enterEmail"]);
      return;
    }
    setNotice(null);
    setStep("password");
  };

  const submitAccount = async () => {
    const handler = mode === "register" ? onRegisterAccount : onPasswordLogin;
    if (!handler || submitting) return;
    const identifier = email.trim();
    if (!identifier) {
      setNotice(strings["account.enterEmail"]);
      setStep("email");
      return;
    }
    if (!password) {
      setNotice(strings["account.enterPassword"]);
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      await handler(identifier, password);
      setPassword("");
    } catch (error) {
      setNotice(
        error instanceof Error && error.message.trim()
          ? error.message
          : mode === "register"
            ? "Could not create that account. Try again."
            : "Sign-in failed. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const footerToggle = () => {
    if (onRegisterAccount === undefined) return;
    setNotice(null);
    setMode((current) => (current === "register" ? "login" : "register"));
  };

  return (
    <NativeDialog
      open={open}
      onClose={onClose}
      ariaLabelledBy={titleId}
      attributes={{ "data-account-dialog": "" }}
      className="m-0 h-dvh max-h-dvh w-full max-w-none overflow-clip bg-[var(--account-surface)] p-0 text-[var(--account-text)] backdrop:bg-black/60 sm:m-auto sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[min(27rem,calc(100vw-2rem))] sm:rounded-xl sm:border sm:border-[var(--account-border)] sm:shadow-[0_24px_60px_-28px_rgb(0_0_0/0.6)]"
    >
      <div style={accountVars} className="text-[var(--account-text)]">
        <div className="flex h-full flex-col overflow-y-auto overscroll-contain sm:h-auto sm:max-h-[calc(100dvh-4rem)]">
          <div className="relative flex min-h-full flex-col">
            <div className="absolute inset-x-0 top-0 hidden sm:block">
              <div
                aria-hidden="true"
                className="h-px bg-[linear-gradient(90deg,transparent,rgb(242_176_45/0.85)_30%,rgb(232_144_26/0.85)_70%,transparent)]"
              />
            </div>
            <div className="sticky top-0 z-10 flex h-0 justify-end">
              <button
                type="button"
                className="mt-5 mr-3 inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--account-surface)] text-sm text-[var(--account-text-muted)] transition hover:bg-[var(--account-surface-raised)] hover:text-[var(--account-text)] disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={strings["account.close"]}
                onClick={onClose}
              >
                <Icon name="close" className="size-4" />
              </button>
            </div>

            <div className="mx-auto w-full max-w-[27rem] space-y-4 px-6 py-6 sm:px-8">
              <h2
                id={titleId}
                className="px-7 text-center text-xl font-semibold tracking-tight text-balance"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  width={21}
                  height={24}
                  className="mr-2 inline-block h-6 w-auto align-middle drop-shadow-[0_2px_6px_rgb(0_0_0/0.3)] select-none"
                  draggable="false"
                  src="/riftbound/static/brand/rift-atlas/rift-atlas-mark-header.webp"
                />
                {mode === "register"
                  ? strings["account.signUpTitle"]
                  : strings["account.title"]}
              </h2>

              {signedIn ? (
                <div className="grid gap-3">
                  <div className="rounded-md border border-[var(--account-border)] bg-[var(--account-surface-muted)] px-4 py-3 text-center text-sm">
                    <p className="text-[var(--account-text-muted)]">
                      {signedInKind === "account"
                        ? "Signed in as"
                        : strings["account.guestSignedIn"]}
                    </p>
                    <p
                      data-testid="account-signed-in-name"
                      className="mt-1 text-base font-semibold text-[var(--account-text)]"
                    >
                      {guestName}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={primaryButton}
                    onClick={onClose}
                  >
                    {strings["account.continue"]}
                  </button>
                  {onSignOut ? (
                    <button
                      type="button"
                      className="text-xs text-[var(--account-text-muted)] underline-offset-4 hover:text-[var(--account-text)] hover:underline"
                      onClick={onSignOut}
                    >
                      Sign out
                    </button>
                  ) : null}
                </div>
              ) : step === "email" ? (
                <>
                  {reason ? <p className="sr-only">{reason}</p> : null}

                  <div className="@container grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      className={oauthButton}
                      aria-label={strings["account.google"]}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      <span className="truncate @max-[20rem]:hidden">Google</span>
                    </button>
                    <button
                      type="button"
                      className={oauthButton}
                      aria-label={strings["account.discord"]}
                    >
                      <svg viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true" className="size-4">
                        <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                      <span className="truncate @max-[20rem]:hidden">Discord</span>
                    </button>
                    <button
                      type="button"
                      className={oauthButton}
                      aria-label={strings["account.twitch"]}
                    >
                      <svg viewBox="0 0 24 24" fill="#9146FF" aria-hidden="true" className="size-4">
                        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                      </svg>
                      <span className="truncate @max-[20rem]:hidden">Twitch</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[var(--account-text-muted)]">
                    <span className="h-px flex-1 bg-[var(--account-border)]" />
                    {strings["account.or"]}
                    <span className="h-px flex-1 bg-[var(--account-border)]" />
                  </div>

                  <div>
                    <form
                      className="space-y-3"
                      data-account-auth-form={mode}
                      onSubmit={(event) => {
                        event.preventDefault();
                        continueToPassword();
                      }}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <label htmlFor={emailId} className="text-sm font-medium">
                            {strings["account.email"]}
                          </label>
                        </div>
                        <input
                          id={emailId}
                          name="email"
                          type="text"
                          inputMode="email"
                          autoComplete="username"
                          autoCapitalize="none"
                          spellCheck={false}
                          required
                          autoFocus
                          value={email}
                          onChange={(event) => {
                            setEmail(event.currentTarget.value);
                            setNotice(null);
                          }}
                          data-testid="account-email"
                          className={fieldClass}
                        />
                      </div>
                      <button
                        type="submit"
                        data-testid="account-email-continue"
                        className={primaryButton}
                      >
                        {strings["account.continue"]}
                      </button>
                    </form>
                    <TurnstileMock />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--account-border)] bg-[var(--account-surface-muted)] px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{email.trim()}</span>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-[var(--account-accent)] underline-offset-4 hover:underline"
                      onClick={() => {
                        setStep("email");
                        setPassword("");
                        setNotice(null);
                      }}
                    >
                      {strings["account.useDifferentEmail"]}
                    </button>
                  </div>

                  <form
                    className="space-y-3"
                    data-account-auth-form={mode}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitAccount();
                    }}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <label htmlFor={passwordId} className="text-sm font-medium">
                          {strings["account.password"]}
                        </label>
                      </div>
                      <input
                        id={passwordId}
                        name="password"
                        type="password"
                        autoComplete={mode === "register" ? "new-password" : "current-password"}
                        required
                        autoFocus
                        value={password}
                        onChange={(event) => {
                          setPassword(event.currentTarget.value);
                          setNotice(null);
                        }}
                        data-testid="account-password"
                        className={fieldClass}
                      />
                      {mode === "register" ? (
                        <p className="text-[0.72rem] text-[var(--account-text-muted)]">
                          {strings["account.passwordHint"]}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      data-testid="account-submit"
                      className={primaryButton}
                    >
                      {submitting
                        ? strings["account.working"]
                        : mode === "register"
                          ? strings["account.createAccount"]
                          : strings["account.continue"]}
                    </button>
                    {notice ? (
                      <p
                        role="alert"
                        data-account-auth-error=""
                        className="text-center text-[0.72rem] leading-snug text-[#fca5a5]"
                      >
                        {notice}
                      </p>
                    ) : null}
                  </form>

                  <div className="flex items-center gap-3 text-xs text-[var(--account-text-muted)]">
                    <span className="h-px flex-1 bg-[var(--account-border)]" />
                    {strings["account.or"]}
                    <span className="h-px flex-1 bg-[var(--account-border)]" />
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <p className="text-sm font-semibold">{strings["account.guestHeading"]}</p>
                      <p className="mt-0.5 text-xs text-[var(--account-text-muted)]">
                        {strings["account.guestHelp"]}
                      </p>
                    </div>
                    <form
                      className="space-y-2.5"
                      onSubmit={(event) => {
                        event.preventDefault();
                        submitGuest();
                      }}
                    >
                      <label htmlFor={guestNameId} className="sr-only">
                        {strings["account.guestPlaceholder"]}
                      </label>
                      <input
                        id={guestNameId}
                        type="text"
                        value={name}
                        maxLength={24}
                        onChange={(event) => setName(event.currentTarget.value)}
                        placeholder={strings["account.guestPlaceholder"]}
                        className={fieldClass}
                      />
                      <button
                        type="submit"
                        disabled={!name.trim()}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[rgba(103,232,249,0.5)] bg-[rgba(37,99,235,0.28)] px-4 text-sm font-semibold text-[#e0f7ff] transition hover:bg-[rgba(37,99,235,0.4)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {strings["account.guestButton"]}
                      </button>
                    </form>
                  </div>
                </>
              )}

              {notice && step === "email" ? (
                <p
                  role="alert"
                  data-account-auth-error=""
                  className="text-center text-[0.72rem] leading-snug text-[#fca5a5]"
                >
                  {notice}
                </p>
              ) : null}
            </div>

            {signedIn ? null : (
              <p className="mt-auto border-t border-[var(--account-border)] bg-[var(--account-surface-muted)] px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm text-[var(--account-text-muted)]">
                {mode === "register" ? (
                  <>
                    {strings["account.haveAccount"]}{" "}
                    <button
                      type="button"
                      className="rounded-sm font-medium text-[var(--account-accent)] underline-offset-4 hover:underline"
                      onClick={footerToggle}
                    >
                      {strings["account.signInLink"]}
                    </button>
                  </>
                ) : (
                  <>
                    {strings["account.newHere"]}{" "}
                    <button
                      type="button"
                      className="rounded-sm font-medium text-[var(--account-accent)] underline-offset-4 hover:underline"
                      onClick={footerToggle}
                    >
                      {strings["account.create"]}
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </NativeDialog>
  );
}
