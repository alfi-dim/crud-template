import type { RouterContextProvider } from "react-router";
import { getRequestSession } from "~/sessions.server";
import { redirectWithToast } from "~/lib/utils.server";

export function requireCurrentUser(context: Readonly<RouterContextProvider>): string {
  const { session } = getRequestSession(context);
  const userId = session.data.userId;
  if (!userId) {
    throw redirectWithToast(context, "/auth", {
      type: "warning",
      title: "Session expired",
      description: "Session expired, please login again",
    });
  }
  return userId;
}
