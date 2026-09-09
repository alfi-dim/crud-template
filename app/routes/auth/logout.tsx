import type { Route } from "./+types/logout";
import { redirect } from "react-router";
import { markSessionDestroyed } from "~/sessions.server";

export async function action({ context }: Route.ActionArgs) {
  markSessionDestroyed(context);
  return redirect("/auth");
}
