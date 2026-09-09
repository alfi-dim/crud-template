import { type LoaderFunctionArgs, redirect } from "react-router";
import { getRequestSession, getSession, markSessionDirty } from "~/sessions.server";
import { ConfigurableForm } from "~/components/form";
import { loginField, loginSchema } from "~/routes/auth/lib/config";
import type { Route } from "./+types/login";
import { readJsonAction } from "~/lib/action.server";
import { dataWithToast } from "~/lib/utils.server";

export async function action({ request, context }: Route.ActionArgs) {
  const input = await readJsonAction(request);
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return dataWithToast(
      context,
      { error: "Invalid email/password" },
      {
        title: "Error",
        description: "Invalid email/password",
        type: "error",
      },
    );
  }
  const { email, password } = parsed.data;
  const { session } = getRequestSession(context);
  if (email === "admin@admin.com" && password === "admin123") {
    session.set("userId", "admin");
    session.flash("toast", {
      id: "welcome-back",
      type: "success",
      title: "Welcome back admin!",
      description: "You have been successfully logged in.",
    });
    markSessionDirty(context);
    return redirect("/home");
  }

  return dataWithToast(
    context,
    { error: "Invalid email/password" },
    {
      title: "Error",
      description: "Invalid email/password",
      type: "error",
    },
  );
}
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  if (session.has("userId")) {
    return redirect("/");
  }
}
export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <ConfigurableForm title="Login" target="/auth" schema={loginSchema} fields={loginField} />
      </div>
    </div>
  );
}
