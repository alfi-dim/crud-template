import { AlertTriangle, ArrowLeft, Home, RefreshCw } from "lucide-react";
import { isRouteErrorResponse, Link, useNavigate, useRouteError } from "react-router";

import { Button } from "~/components/ui/button";

type GeneralErrorProps = {
  title?: string;
  description?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  showReloadButton?: boolean;
};

export function ErrorSection({
  title,
  description,
  showBackButton = true,
  showHomeButton = true,
  showReloadButton = true,
}: Readonly<GeneralErrorProps>) {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-8" />
        </div>

        <p className="mb-2 text-sm font-medium text-muted-foreground">Something went wrong</p>

        <h1 className="text-3xl font-semibold tracking-tight">{title ?? "Unexpected error"}</h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {description ??
            "We couldn't complete your request. Please try again or return to the previous page."}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {showReloadButton && (
            <Button variant="default" onClick={() => window.location.reload()}>
              <RefreshCw />
              Try again
            </Button>
          )}

          {showBackButton && (
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft />
              Go back
            </Button>
          )}

          {showHomeButton && (
            <Button variant="ghost" render={<Link to="/" />}>
              <Home />
              Home
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

export function RouteError() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <ErrorSection
          title="Page not found"
          description="The page you're looking for doesn't exist or may have been moved."
        />
      );
    }

    return (
      <ErrorSection
        title={`${error.status} ${error.statusText}`}
        description={
          typeof error.data === "string"
            ? error.data
            : "Something went wrong while loading this page."
        }
      />
    );
  }

  if (error instanceof Error) {
    return <ErrorSection title="Something went wrong" description={error.message} />;
  }

  return <ErrorSection />;
}
