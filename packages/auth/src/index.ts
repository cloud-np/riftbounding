import { APIError, betterAuth, type BetterAuthOptions, type BetterAuthPlugin } from "better-auth";
import { admin, bearer, emailOTP, twoFactor } from "better-auth/plugins";
import { getOtpCopy } from "./otp";
import type { AuthEmail, CloudAuthOptions } from "./models";

export type { AuthEmail, CloudAuthOptions } from "./models";

export function createCloudAuth<const Plugins extends BetterAuthPlugin[] = []>(
    options: CloudAuthOptions<Plugins>,
) {
    const authorizeEmail = async (email: string) => {
        if (!options.allowedEmails.includes(email) && !(await options.authorizeEmail?.(email))) {
            throw new APIError("UNAUTHORIZED", { message: `Email is not authorized: ${email}` });
        }
    };

        const builtInPlugins = [
            admin(),
            bearer(),
            twoFactor({
            otpOptions: {
                async sendOTP({ user, otp }) {
                    if (!options.production) console.log(`Two-factor OTP for ${user.email}: ${otp}`);
                },
            },
        }),
        emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
                await authorizeEmail(email);

                if (!options.production) {
                    console.log(`Email OTP for ${email} (${type}): ${otp}`);
                    return;
                }

                const copy = getOtpCopy(type);

                if (!copy) return;

                const fallback = {
                    subject: copy[0]!,
                    html: `<p>${copy[1]}</p>
              <h2 style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">${otp}</h2>
              <p>This code will expire in 5 minutes.</p>
              <p>If you didn't request this code, please ignore this email.</p>`,
                };
                const rendered = options.templates?.otp?.({ type, otp }) ?? fallback;

                await options.sendEmail({
                    name: "",
                    email,
                    subject: rendered.subject,
                    html: rendered.html,
                });
            },
        }),
    ] as const;

    const plugins = [
        ...builtInPlugins,
        ...(options.plugins ?? []),
    ] as [...typeof builtInPlugins, ...Plugins];

    return betterAuth({
        secret: options.secret,
        database: options.database,
        baseURL: options.baseURL,
        trustedOrigins: options.trustedOrigins,
        socialProviders: options.socialProviders,
        session: options.session,
        account: {
            accountLinking: {
                enabled: true,
                trustedProviders: ["google", "facebook"],
            },
        },
        emailAndPassword: {
            enabled: true,
            disableSignUp: options.disableSignUp ?? true,
            requireEmailVerification: true,
            minPasswordLength: 8,
            maxPasswordLength: 128,
            autoSignIn: true,
            // With requireEmailVerification, a sign-up for a registered address gets the same fake
            // success as a fresh one (anti-enumeration) and Better Auth sends nothing, so the person
            // waits for a verification mail that never comes. Tell the inbox owner instead.
            onExistingUserSignUp: options.disableSignUp === false
                ? async ({ user }) => {
                    const fallback = {
                        subject: "You already have an account",
                        html: "Someone tried to create an account with this email address. You already have one — sign in, or reset your password if you forgot it. If this wasn't you, ignore this email.",
                    };
                    const rendered = options.templates?.existingAccount?.({
                        name: user.name ?? "",
                        emailVerified: Boolean(user.emailVerified),
                    }) ?? fallback;
                    await options.sendEmail({
                        name: user.name,
                        email: user.email,
                        subject: rendered.subject,
                        html: rendered.html,
                    });
                }
                : undefined,
        },
		emailVerification: {
			sendOnSignUp: options.disableSignUp === false,
			// An unverified account that lost its link gets a fresh one on a sign-in attempt
			// instead of dead-ending on EMAIL_NOT_VERIFIED. Recipient quota caps the resends.
			sendOnSignIn: options.disableSignUp === false,
			autoSignInAfterVerification: options.disableSignUp === false,
            async sendVerificationEmail({ user, url }) {
                const fallback = { subject: "Verify your email address", html: `Click the link to verify your email: ${url}` };
                const rendered = options.templates?.verification?.({ name: user.name ?? "", url }) ?? fallback;
                await options.sendEmail({
                    name: user.name,
                    email: user.email,
                    subject: rendered.subject,
                    html: rendered.html,
                });
            },
        },
        databaseHooks: {
            user: {
                create: {
                    async before(user) {
                        await authorizeEmail(user.email);
                        return { data: user };
                    },
                },
            },
        },
        plugins,
        rateLimit: {
            enabled: true,
        },
    });
}
