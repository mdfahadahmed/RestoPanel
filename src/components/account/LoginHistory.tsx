import { CheckCircle2, Monitor, XCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

export interface LoginHistoryEvent {
  id: string;
  createdAt: Date;
  success: boolean;
  method: string;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
}

/** Best-effort friendly device string from a raw user-agent. */
function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os =
    /Windows/i.test(ua) ? "Windows" :
    /iPhone|iPad|iOS/i.test(ua) ? "iOS" :
    /Mac OS X|Macintosh/i.test(ua) ? "macOS" :
    /Android/i.test(ua) ? "Android" :
    /Linux/i.test(ua) ? "Linux" : "";
  const browser =
    /Edg\//i.test(ua) ? "Edge" :
    /Chrome\//i.test(ua) ? "Chrome" :
    /Firefox\//i.test(ua) ? "Firefox" :
    /Safari\//i.test(ua) ? "Safari" : "Browser";
  return os ? `${browser} on ${os}` : browser;
}

/**
 * Read-only "recent login activity" for the account — successful and failed
 * sign-ins so a customer can spot access they don't recognise.
 */
export function LoginHistory({ events }: { events: LoginHistoryEvent[] }) {
  return (
    <section className="rounded-2xl border border-line bg-ink-900/50 p-5">
      <h2 className="font-semibold text-fog-100">Recent login activity</h2>
      <p className="mt-1 text-sm text-fog-400">
        Sign-ins to your account. If you don&apos;t recognise something, change your
        password and sign out of all sessions below.
      </p>

      {events.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-ink-900/40 p-6 text-center text-sm text-fog-500">
          No login activity recorded yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line/60">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-3">
              <span className={e.success ? "text-emerald-400" : "text-rose-400"}>
                {e.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm text-fog-200">
                  <Monitor className="h-3.5 w-3.5 text-fog-500" />
                  {describeDevice(e.userAgent)}
                  {!e.success && (
                    <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] text-rose-300">
                      failed
                    </span>
                  )}
                  {e.reason === "register" && e.success && (
                    <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-300">
                      account created
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-fog-500">
                  {e.ip ?? "Unknown IP"} · {formatDate(e.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
