import { createContext } from "react";
import type { SessionData as CurrentUser } from "~/sessions.server";

export type CurrentUserContextValue = {
  currentUser: CurrentUser | null;
};

export const CurrentUserContext = createContext<CurrentUserContextValue>({
  currentUser: null,
});
