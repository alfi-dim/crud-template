import type { ReactNode } from "react";
import { CurrentUserContext } from "~/context/current-user";
import type { SessionData as CurrentUser } from "~/sessions.server";

export default function CurrentUserProvider({
  currentUser,
  children,
}: Readonly<{
  currentUser: CurrentUser | null;
  children: ReactNode;
}>) {
  return (
    <CurrentUserContext.Provider value={{ currentUser }}>{children}</CurrentUserContext.Provider>
  );
}
