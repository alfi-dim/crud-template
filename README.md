# Heavy CRUD React Router Template

A minimal full-stack React Router template for projects that repeatedly need authentication scaffolding, schema-driven forms, and data tables.

The repository supplies reusable UI and integration points without choosing a database, API architecture, authentication provider, or authorization model for the application built from it.

## Included

- React 19 and React Router 8 framework mode with server-side rendering
- Tailwind CSS 4 and reusable UI primitives
- Cookie-session scaffolding and protected-route examples
- TanStack Form with shared Zod validation
- TanStack Table with search, sorting, pagination, column controls, row actions, and nested filters
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

Create `.env` from `.env.example`, then replace the placeholder with a generated secret:

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

Demo credentials are rejected when `NODE_ENV=production`. Before deploying an application created from this template, replace the credential check in `app/routes/auth/login.tsx` and adapt the session data to the project's user model.

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

The component currently submits JSON with `POST`. Routes can use `readJsonAction()` from `app/lib/action.server.ts` to enforce that transport and parse the body.

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
  return <DataTable data={users} columns={columns} searchKeys={["name", "status"]} />;
}
```

The table performs pagination, sorting, searching, and filtering in the browser over the complete supplied dataset. Nested filter groups preserve `AND`, `OR`, and rule-negation behavior.

Server-controlled pagination, URL-backed state, total-count metadata, and backend filter compilation are intentionally not included. Add them in the consuming project if its dataset or API requires them.

## Sessions and Security

`app/sessions.server.ts` uses a signed cookie session with these defaults:

- HTTP-only cookie
- `SameSite=Lax`
- `Secure` in production
- Seven-day maximum age
- Application-wide `/` path

Cookie-session data is signed against tampering, not intended for storing secrets, and cannot be individually revoked without changing the signing secret. Projects requiring per-session revocation should replace it with server-side session storage.

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
