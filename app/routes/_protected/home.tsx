import { useSubmit } from "react-router";
import { Button } from "~/components/ui/button";

export function meta() {
  return [{ title: "Home" }, { name: "description", content: "Welcome to React Router!" }];
}

export default function Home() {
  const submit = useSubmit();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">Welcome to the Protected Home Page</h1>
      <p className="text-lg text-gray-600">
        You are successfully logged in and can access this protected route.
      </p>
      <Button onClick={() => submit(null, { action: "/auth/logout", method: "POST" })}>
        Logout
      </Button>
    </div>
  );
}
