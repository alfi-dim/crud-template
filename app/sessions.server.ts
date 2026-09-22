import "dotenv/config";
import {
  createContext,
  createCookieSessionStorage,
  type RouterContextProvider,
} from "react-router";
import { randomBytes } from "node:crypto";

export type SessionData = {
  userId: string;
  csrfToken?: string;
};

export type ToastFlash = {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
};

type SessionFlashData = {
  toast: ToastFlash;
};

const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET || AUTH_SECRET === "your_secret_key") {
  throw new Error("Set AUTH_SECRET to a generated secret before starting the application");
}

const { getSession, commitSession, destroySession } = createCookieSessionStorage<
  SessionData,
  SessionFlashData
>({
  // a Cookie from `createCookie` or the CookieOptions to create one
  cookie: {
    name: "__session",

    // all of these are optional
    // domain: "reactrouter.com",
    // Expires can also be set (although maxAge overrides it when used in combination).
    // Note that this method is NOT recommended as `new Date` creates only one date on each server deployment, not a dynamic date in the future!
    //
    // expires: new Date(Date.now() + 60_000),
    httpOnly: true,
    maxAge: 604800, // 7 days on seconds
    path: "/",
    sameSite: "lax",
    secrets: [AUTH_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

type AppSession = Awaited<ReturnType<typeof getSession>>;

export type RequestSessionState = {
  session: AppSession;
  dirty: boolean;
  destroy: boolean;
};

export const requestSessionContext = createContext<RequestSessionState>();

export async function createRequestSession(request: Request) {
  return {
    session: await getSession(request.headers.get("Cookie")),
    dirty: false,
    destroy: false,
  } satisfies RequestSessionState;
}

export function getRequestSession(context: Readonly<RouterContextProvider>) {
  const state = context.get(requestSessionContext);
  if (!state) {
    throw new Error(
      "getRequestSession called outside request context. " +
        "Ensure the session middleware runs before this route.",
    );
  }
  return state;
}

export function markSessionDirty(context: Readonly<RouterContextProvider>) {
  getRequestSession(context).dirty = true;
}

export function markSessionDestroyed(context: Readonly<RouterContextProvider>) {
  const state = getRequestSession(context);
  state.destroy = true;
  state.dirty = false;
}

/** Generates a CSRF token and stores it in the session. Returns the token. */
export function ensureCsrfToken(context: Readonly<RouterContextProvider>): string {
  const { session } = getRequestSession(context);
  let token = session.get("csrfToken") as string | undefined;
  if (!token || typeof token !== "string") {
    token = randomBytes(32).toString("hex");
    session.set("csrfToken", token);
    markSessionDirty(context);
  }
  return token;
}

/** Validates a CSRF token against the one stored in the session. */
export function validateCsrfToken(
  context: Readonly<RouterContextProvider>,
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  const { session } = getRequestSession(context);
  const expected = session.get("csrfToken") as string | undefined;
  if (!expected) return false;
  // Constant-time comparison to prevent timing attacks
  if (token.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

/** Validates the CSRF token from a request header. Throws 403 if invalid. */
export function requireCsrfToken(request: Request, context: Readonly<RouterContextProvider>): void {
  const token = request.headers.get("X-CSRF-Token");
  if (!validateCsrfToken(context, token)) {
    throw new Response("Invalid CSRF token", { status: 403 });
  }
}

export { getSession, commitSession, destroySession };
