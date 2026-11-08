export function getOtpCopy(type: string) {
    return {
        "sign-in": ["Your sign-in code", "Your one-time password for signing in is:"],
        "email-verification": ["Verify your email address", "Your email verification code is:"],
        "forget-password": ["Reset your password", "Your password reset code is:"],
    }[type];
}
