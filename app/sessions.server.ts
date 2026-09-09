import "dotenv/config";
import {
  createContext,
  createCookieSessionStorage,
  type RouterContextProvider,
} from "react-router";

export type SessionData = {
  userId: string;
};

export type ToastFlash = {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
};

type SessionFlashData = {
  toast: ToastFlash;
  error: string;
};

const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) throw new Error("AUTH_SECRET is not defined");

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
  authorityRefreshed: boolean;
};

export const requestSessionContext = createContext<RequestSessionState>();

export async function createRequestSession(request: Request) {
  return {
    session: await getSession(request.headers.get("Cookie")),
    dirty: false,
    destroy: false,
    authorityRefreshed: false,
  } satisfies RequestSessionState;
}

export function getRequestSession(context: Readonly<RouterContextProvider>) {
  return context.get(requestSessionContext);
}

export function markSessionDirty(context: Readonly<RouterContextProvider>) {
  getRequestSession(context).dirty = true;
}

export function markSessionDestroyed(context: Readonly<RouterContextProvider>) {
  const state = getRequestSession(context);
  state.destroy = true;
  state.dirty = false;
}

export { getSession, commitSession, destroySession };
