import { data, Outlet, useLoaderData } from "react-router";
import CurrentUserProvider from "~/components/current-user-provider";
import { requireCurrentUser } from "~/lib/auth.server";
import type { Route } from "./+types/index";
import { RouteError } from "~/components/error-section";
export const middleware: Route.MiddlewareFunction[] = [
  async ({ context }) => {
    await requireCurrentUser(context);
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  const user = await requireCurrentUser(context);
  return data({ user });
}

export default function ProtectedLayout({ children }: Readonly<{ children?: React.ReactNode }>) {
  const { user } = useLoaderData<typeof loader>();
  return (
    <CurrentUserProvider currentUser={{ userId: user }}>
      <div className="min-w-0 h-dvh max-w-full px-3 py-4">{children || <Outlet />}</div>
    </CurrentUserProvider>
  );
}

export function ErrorBoundary() {
  return <RouteError />;
}
