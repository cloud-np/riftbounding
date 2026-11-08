import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";

export interface AuthEmail {
	email: string;
	html: string;
	subject: string;
	name: string;
}

export interface AuthEmailTemplates {
	/** Branded verification-link email. Receives the Better Auth verification URL. */
	verification?: (input: { name: string; url: string }) => { subject: string; html: string };
	/** Branded OTP email. `type` is the Better Auth emailOTP type (sign-in | email-verification | forget-password). */
	otp?: (input: { type: string; otp: string }) => { subject: string; html: string };
	/**
	 * Branded notice sent when someone signs up with an address that already has an account
	 * (open sign-up only). The HTTP response stays identical to a fresh sign-up, so the page
	 * cannot reveal that the account exists; only the inbox owner learns it. `emailVerified`
	 * is the existing account's state.
	 */
	existingAccount?: (input: { name: string; emailVerified: boolean }) => { subject: string; html: string };
}

export interface CloudAuthOptions<Plugins extends BetterAuthPlugin[] = BetterAuthPlugin[]> {
	secret?: string;
	database: BetterAuthOptions["database"];
	baseURL: string;
	trustedOrigins: string[];
	allowedEmails: readonly string[];
	authorizeEmail?: (email: string) => Promise<boolean>;
	plugins?: Plugins;
	/** Better Auth social providers (google, facebook, ...). Omit for email-only auth. */
	socialProviders?: BetterAuthOptions["socialProviders"];
	production: boolean;
	sendEmail: (email: AuthEmail) => Promise<unknown>;
	/** Optional branded renderers for auth email; when omitted the package's plain-text fallbacks are used. */
	templates?: AuthEmailTemplates;
	disableSignUp?: boolean;
	/**
	 * Better Auth session settings, passed through unchanged (e.g. `cookieCache`). A cookie
	 * cache trades revocation latency for fewer session reads: a revoked session or a changed
	 * session field stays visible to `getSession` until the cookie's `maxAge` lapses, unless
	 * the caller bypasses it (`query: { disableCookieCache: true }`).
	 */
	session?: BetterAuthOptions["session"];
}
