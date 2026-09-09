import type { RouterContextProvider } from "react-router";
import { getRequestSession } from "~/sessions.server";
import { redirectWithToast } from "~/lib/utils.server";
import type { SessionData as CurrentUser } from "~/sessions.server";
export function getUserSession(context: Readonly<RouterContextProvider>): CurrentUser {
  const { session } = getRequestSession(context);
  const userId = session.data.userId;
  if (!userId)
    throw redirectWithToast(context, "/auth", {
      type: "warning",
      title: "Session expired",
      description: "Session expired, please login again",
    });
  return { userId };
}

export async function requireCurrentUser(context: Readonly<RouterContextProvider>) {
  const { userId } = getUserSession(context);
  return userId;
}
