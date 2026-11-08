import { createAuthClient } from "better-auth/client";
import { adminClient, emailOTPClient } from "better-auth/client/plugins";

export function createCloudAuthClient(baseURL?: string) {
    return createAuthClient({
        ...(baseURL ? { baseURL } : {}),
        plugins: [adminClient(), emailOTPClient()],
    });
}
