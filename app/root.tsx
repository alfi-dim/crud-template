import { data, Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { ThemeProvider } from "~/components/theme-provider";
import {
  commitSession,
  createRequestSession,
  destroySession,
  getRequestSession,
  markSessionDirty,
  requestSessionContext,
} from "~/sessions.server";
import { toast, Toaster } from "~/components/ui/toast";
import { useEffect } from "react";
import { ErrorSection } from "~/components/error-section";
import { TooltipProvider } from "~/components/ui/tooltip";

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const state = await createRequestSession(request);
    context.set(requestSessionContext, state);

    const response = await next();
    if (state.destroy) {
      response.headers.append("Set-Cookie", await destroySession(state.session));
    } else if (state.dirty) {
      response.headers.append("Set-Cookie", await commitSession(state.session));
    }
    return response;
  },
];

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { session } = getRequestSession(context);
  const toast = session.get("toast");
  if (toast) markSessionDirty(context);
  return data({ toast });
};

export function Layout({ children }: { children: React.ReactNode }) {
  const loaderData = useLoaderData<typeof loader>();
  useEffect(() => {
    if (!loaderData?.toast) return;

    toast.add({
      id: loaderData.toast.id,
      title: loaderData.toast.title,
      description: loaderData.toast.description,
      type: loaderData.toast.type,
      positionerProps: {},
    });
  }, [loaderData]);
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  return (
    <ThemeProvider>
      <ErrorSection />
    </ThemeProvider>
  );
}
