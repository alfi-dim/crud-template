import type { Route } from "./+types/logout";
import { redirect } from "react-router";
import { markSessionDestroyed, requireCsrfToken } from "~/sessions.server";

export async function action({ request, context }: Route.ActionArgs) {
  requireCsrfToken(request, context);
  markSessionDestroyed(context);
  return redirect("/auth");
}
