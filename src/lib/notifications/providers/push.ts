/**
 * Provider-agnostic mobile push. Defaults to the Expo Push API (a single HTTP
 * endpoint that fans out to both APNs and FCM), over `fetch` with no SDK — the
 * same dependency-free approach as the Resend/Twilio providers. When no provider
 * is configured the caller treats sends as SKIPPED (mirroring email/SMS).
 */

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushSendResult {
  ok: boolean;
  sent: number;
  error?: string;
}

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

/** Which push provider is configured, if any (env-driven). */
export function pushProvider(): "expo" | null {
  if (process.env.PUSH_PROVIDER === "expo" || process.env.EXPO_PUSH_ENABLED === "true") return "expo";
  return null;
}

export function isPushConfigured(): boolean {
  return pushProvider() !== null;
}

/** Build Expo push messages (pure — easy to unit test). */
export function buildExpoMessages(tokens: string[], payload: PushPayload) {
  return tokens.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    ...(payload.data ? { data: payload.data } : {}),
  }));
}

export async function sendViaExpo(
  tokens: string[],
  payload: PushPayload,
  fetchImpl: typeof fetch = fetch
): Promise<PushSendResult> {
  if (tokens.length === 0) return { ok: true, sent: 0 };
  try {
    const res = await fetchImpl(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(buildExpoMessages(tokens, payload)),
    });
    if (!res.ok) return { ok: false, sent: 0, error: `Expo push error (${res.status})` };
    return { ok: true, sent: tokens.length };
  } catch (e) {
    return { ok: false, sent: 0, error: e instanceof Error ? e.message : "Push request failed" };
  }
}
