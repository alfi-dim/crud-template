# Heavy CRUD React Router Template

A minimal full-stack React Router template for projects that repeatedly need authentication scaffolding, schema-driven forms, and data tables.

The repository supplies reusable UI and integration points without choosing a database, API architecture, authentication provider, or authorization model for the application built from it.

## Included

- React 19 and React Router 8 framework mode with server-side rendering
- Tailwind CSS 4 and reusable UI primitives
- Cookie-session scaffolding and protected-route examples
- TanStack Form with shared Zod validation
- TanStack Table with search, sorting, pagination, column controls, row actions, and basic flat AND filters
- Toast feedback stored in the request session
- TypeScript, Oxlint, and Oxfmt
- Multi-stage Docker build

## Requirements

- Node.js 24 or newer
- pnpm 11 or newer

The exact pnpm version is declared in `package.json` and can be activated through Corepack.

## Setup

Install dependencies:

```sh
corepack enable
pnpm install
```

Create `.env` from `.env.example`, then replace the placeholder with a generated secret (missing secrets and the literal `your_secret_key` are rejected at startup):

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```env
AUTH_SECRET=replace_with_the_generated_value
```

Start the development server:

```sh
pnpm dev
```

The application is available at `http://localhost:5173`.

## Commands

| Command          | Purpose                                 |
| ---------------- | --------------------------------------- |
| `pnpm dev`       | Start the development server with HMR   |
| `pnpm build`     | Create a production build               |
| `pnpm start`     | Serve an existing production build      |
| `pnpm typecheck` | Generate route types and run TypeScript |
| `pnpm lint`      | Run Oxlint                              |
| `pnpm lint:fix`  | Fix supported lint issues               |
| `pnpm fmt`       | Format the repository with Oxfmt        |
| `pnpm fmt:check` | Check formatting without changing files |

## Demo Authentication

The authentication route is demonstration scaffolding, not a production authentication system.

Development credentials:

```text
Email: admin@admin.com
Password: admin123
```

Demo credentials are accepted only when `NODE_ENV=development`. They are rejected in every other environment. Before deploying an application created from this template, replace the credential check in `app/routes/auth/login.tsx` and adapt the session data to the project's user model.

The example route flow is:

- `/auth` renders the login form.
- `/home` demonstrates a protected route.
- `/auth/logout` destroys the session through a route action.

Authentication only establishes the example `userId`. The consuming project must implement its own account lookup, credential verification, authorization checks, account lifecycle, and rate limiting.

## Configurable Form

`app/components/form.tsx` provides `ConfigurableForm`, a schema-driven form using TanStack Form and Zod. It supports navigation and fetcher submissions, client validation, server field errors, pending state, reset behavior, and custom fields.

Define one Zod schema and a typed field configuration:

```tsx
import * as z from "zod";
import type { FormFieldConfig } from "~/components/form";

export const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email({ message: "Enter a valid email" }),
});

export const userFields = [
  { type: "text", name: "name", label: "Name", required: true },
  { type: "email", name: "email", label: "Email", required: true },
] satisfies FormFieldConfig<z.infer<typeof userSchema>>[];
```

Render the form and pass route action data for navigation submissions:

```tsx
import { useActionData } from "react-router";
import { ConfigurableForm } from "~/components/form";

export default function UserFormRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <ConfigurableForm
      title="Create user"
      target="/users/new"
      schema={userSchema}
      fields={userFields}
      actionData={actionData}
    />
  );
}
```

Actions consumed by the form return the existing `FormActionResult` shape:

```ts
type FormActionResult = {
  ok: boolean;
  formError?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};
```

The component submits JSON with `POST`. Routes can use `readJsonAction()` from `app/lib/action.server.ts` to enforce that transport and parse the body. The HTML form also declares `POST` so credentials cannot fall back to URL query parameters before hydration. Native submissions without JavaScript are rejected with 415 by the JSON-only helper.

Editing a field clears its server error and the form-level error, while preserving errors for untouched fields. A new server result restores its errors. Success handling depends on the result, not callback identity; unrelated navigation does not mark the form busy. Required select and checkbox controls expose `aria-required`.

## Data Table

`app/components/data-table.tsx` provides the reusable `DataTable` wrapper. Data fetching remains outside the component and complete rows are passed through `data`.

```tsx
import { DataGridColumnHeader } from "~/components/reui/data-grid/data-grid-column-header";
import { createDataTableColumnHelper, DataTable } from "~/components/data-table";

type UserRow = {
  id: string;
  name: string;
  status: "active" | "inactive";
};

const columnHelper = createDataTableColumnHelper<UserRow>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    header: ({ column }) => <DataGridColumnHeader title="Name" column={column} />,
  }),
  columnHelper.accessor("status", {
    header: ({ column }) => <DataGridColumnHeader title="Status" column={column} />,
  }),
]);

export function UsersTable({ users }: { users: UserRow[] }) {
  return (
    <DataTable aria-label="Users" data={users} columns={columns} searchKeys={["name", "status"]} />
  );
}
```

The table performs pagination, sorting, searching, and filtering in the browser over the complete supplied dataset. DataTable uses basic filters: flat rules combined with implicit `AND`. Incomplete rules are ignored according to each field’s resolved operator arity (including custom operators); unsupported nonempty operators match no rows even when they have no value. Empty selections are checked by array length, and numeric comparisons exclude missing, blank, and non-finite values. The advanced Filters component remains available independently, but DataTable does not support nested groups or OR queries.

`initialPageSize` must be a positive integer; the current size is included in the page-size selector. Use `aria-label` or `aria-labelledby` to identify each table. Row actions without an individual or shared handler are omitted. Column resizing defaults to off; `enableColumnResizing={true}` opts into the grid primitive’s pointer-based resize handles.

Server-controlled pagination, URL-backed state, total-count metadata, and backend filter compilation are intentionally not included. Add them in the consuming project if its dataset or API requires them.

## Sessions and Security

`app/sessions.server.ts` uses a signed cookie session with these defaults:

- HTTP-only cookie
- `SameSite=Lax`
- `Secure` in production
- Seven-day maximum age
- Application-wide `/` path

Cookie-session data is signed against tampering, not intended for storing secrets, and cannot be individually revoked without changing the signing secret. Projects requiring per-session revocation should replace it with server-side session storage.

Route loaders and actions should use `getRequestSession(context)` to access the request session. Call `markSessionDirty(context)` after changing it, or `markSessionDestroyed(context)` to sign out. Root middleware commits or destroys the cookie once per request.

React Router rejects action submissions whose `Origin` does not match the request origin. Projects that intentionally accept actions from other origins can configure `allowedActionOrigins` in `react-router.config.ts`. Do not duplicate this protection unless the deployment has additional requirements.

General browser security headers are deployment-specific and are not added by this template. Configure at least content-type sniffing protection, a restrictive referrer policy, and anti-framing protection in the application server, reverse proxy, or hosting platform.

## Project Structure

```text
app/
  components/          Reusable forms, tables, providers, and UI primitives
  components/reui/     Data-grid, filter, and cascader primitives
  lib/                 Shared client and server utilities
  routes/              Route modules and protected-route examples
  sessions.server.ts   Cookie-session configuration and request context
  root.tsx             Root middleware, layout, toast handling, and error boundary
```

Route definitions live in `app/routes.ts`.

## Production Build

Build and run locally:

```sh
pnpm build
pnpm start
```

The build output is written to `build/client` and `build/server`.

## Docker

Build the image:

```sh
docker build -t heavy-crud-template .
```

Run it with a generated session secret:

```sh
docker run --rm -p 3000:3000 -e AUTH_SECRET="replace_with_a_generated_secret" heavy-crud-template
```

The container listens on port `3000`. Demo authentication is disabled because the runtime uses `NODE_ENV=production`.

> If your corporate network requires a proxy and the build fails while downloading pnpm or installing depedency, configure the build proxy as follows.
> A request error alone does not confirm a proxy issue.
>
> ```env
> # .env — replace with your actual corporate proxy
> HTTP_PROXY=http://proxy.company.local:8080
> HTTPS_PROXY=http://proxy.company.local:8080
> NO_PROXY=localhost,127.0.0.1
> ```
>
> ```yaml
> # add this on build or install phase
> args:
>   HTTP_PROXY: "${HTTP_PROXY:-}"
>   HTTPS_PROXY: "${HTTPS_PROXY:-}"
>   NO_PROXY: "${NO_PROXY:-localhost,127.0.0.1}"
> ```
>
> ```dockerfile
> # add this on build or install command
> NODE_USE_ENV_PROXY=1
> ```
