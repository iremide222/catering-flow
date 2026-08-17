# CaterFlow ERP

A multi-tenant catering operations system for managing customers, events, inventory, staff, procurement, and finance in one place.

## Project overview

CaterFlow ERP helps catering teams move from inquiry to delivery. It covers the full event lifecycle — quotation, planning, execution, and closure — while keeping inventory, purchase orders, staff assignments, invoices, and payments in sync.

The app is built as a single-page application with server-side rendering support, file-based routing, and a serverless-friendly backend powered by Lovable Cloud (Postgres, Auth, and Storage).

## Main features

- **Multi-tenant workspaces** — Each organization has isolated data. Users can belong to multiple workspaces.
- **Role-based access control** — Roles: `admin`, `manager`, `accountant`, `store_manager`, `staff`. The UI and database policies enforce the same rules.
- **CRM** — Customer profiles, contact history, preferences, tags, and spend totals.
- **Event management** — Event lifecycle from inquiry → quotation → confirmed → planning → execution → delivered → closed. Duplicate events and create invoices directly from an event.
- **Quotations** — Line-item quotes with taxes and discounts; export to PDF.
- **Calendar** — Month and event views with status-based color coding.
- **Inventory & procurement** — SKU catalog, stock levels per location, stock movements, low-stock alerts, suppliers, purchase requests/orders, and goods receipt.
- **Staff & tasks** — Staff directory, task board with priorities and deadlines, and event assignments.
- **Finance** — Invoices, payments, balance tracking, and revenue reporting.
- **Reports & dashboards** — Revenue trends, AR aging, customer spend, stock status, and task metrics.
- **Audit log** — Admin-only view of sensitive actions across the workspace.
- **Notifications** — In-app bell alerts for low stock, overdue invoices, upcoming events, and due tasks.
- **Command palette** — `Cmd/Ctrl + K` global navigation and action launcher.

## Technologies used

- **Framework:** [TanStack Start v1](https://tanstack.com/start) (React 19 + Vite 7)
- **Language:** TypeScript 5.8
- **Styling:** Tailwind CSS v4 with shadcn/ui components
- **State & data:** TanStack Query, React Hook Form, Zod
- **Backend / Auth / Database:** Lovable Cloud (Supabase) — Postgres, Auth, Storage
- **Charts:** Recharts
- **PDF export:** pdf-lib
- **Testing:** Vitest
- **Linting / formatting:** ESLint + Prettier

## Installation/setup instructions

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd tanstack_start_ts
   ```

2. **Install dependencies**

   The project uses `npm` scripts by default. You can also use `bun` if preferred.

   ```bash
   npm install
   # or
   bun install
   ```

3. **Environment variables**

   Copy the auto-generated `.env` values or ensure the following variables are present. These are managed by Lovable Cloud and should not be edited manually.

   ```env
   SUPABASE_PROJECT_ID=<your-project-id>
   SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
   SUPABASE_URL=https://<your-project-id>.supabase.co
   VITE_SUPABASE_PROJECT_ID=<your-project-id>
   VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
   VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
   ```

   See [Required environment variables](#required-environment-variables) for details.

## Required environment variables

| Variable | Purpose |
| --- | --- |
| `SUPABASE_PROJECT_ID` | Server-side Supabase project identifier. |
| `SUPABASE_PUBLISHABLE_KEY` | Server-side Supabase anon/public key. |
| `SUPABASE_URL` | Server-side Supabase REST/Auth URL. |
| `VITE_SUPABASE_PROJECT_ID` | Client-side Supabase project identifier. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client-side Supabase anon/public key. |
| `VITE_SUPABASE_URL` | Client-side Supabase REST/Auth URL. |

> **Note:** When running on Lovable Cloud, these values are injected automatically. For local development, use the values from your connected backend.

## How to run the project locally

```bash
# Start the development server
npm run dev
# or
bun run dev
```

The dev server starts on `http://localhost:8080` by default. Vite HMR, TanStack Start file-based routing, and Tailwind v4 are already configured.

### Other useful commands

```bash
# Build for production
npm run build

# Build in development mode
npm run build:dev

# Preview the production build locally
npm run preview

# Lint the codebase
npm run lint

# Format the codebase
npm run format
```

## How to run the test suite

Tests are written with [Vitest](https://vitest.dev/).

```bash
# Run tests once
npm run test

# Run tests in watch mode
npm run test:watch
```

Current test files:

- `tests/permissions.test.ts` — Role-based route access logic.
- `tests/format.test.ts` — Currency and date formatting helpers.
- `tests/app-contracts.test.ts` — Source-level checks for auth redirects, report queries, event duplication, and calendar status mapping.

## Supabase/database setup requirements

Database migrations live in `supabase/migrations/`. Each migration creates public-schema tables with explicit `GRANT` statements and Row Level Security (RLS) policies.

### On Lovable Cloud

Backend changes (migrations, auth config, storage buckets) deploy automatically when you publish or update the project. No manual CLI steps are required.

### Local/external Supabase

If you are connecting to a local or self-managed Supabase instance, apply migrations with the Supabase CLI:

```bash
supabase db reset
# or
supabase migration up
```

### Key schema concepts

- `organizations` — top-level tenant isolation.
- `organization_members` — links users to organizations.
- `user_roles` — stores roles separately from profiles (no roles on the profile table).
- `profiles` — public user profile data.
- `customers`, `events`, `quotations`, `invoices`, `payments` — CRM and finance core.
- `locations`, `items`, `stock_levels`, `stock_movements`, `suppliers`, `purchase_orders` — inventory and procurement.
- `staff_members`, `tasks`, `event_staff_assignments` — staff and task management.
- `audit_log` — activity trail for sensitive actions.
- `notifications` — in-app notification queue.

RLS helpers such as `has_role()` and `is_member()` are defined as `SECURITY DEFINER` functions and used across policies.

## Deployment instructions

CaterFlow is designed to deploy through Lovable.

1. Click **Publish** in the Lovable editor:
   - Desktop: top-right of the editor.
   - Mobile: bottom-right corner in Preview mode.
2. The first publish creates a public `.lovable.app` subdomain.
3. After publishing:
   - **Frontend changes** require clicking **Update** in the publish dialog to go live.
   - **Backend changes** (database migrations, auth, server functions) deploy automatically.

### Custom domains

A custom domain can be connected only after the project is published. Configure it in:

- **Project Settings → Project → Domains**, or
- **Publish dialog → Add custom domain**

### Public API endpoints

Webhooks, cron jobs, and public API consumers should target routes under `/api/public/*`. These routes bypass site authentication, so you must verify the caller inside the handler (e.g., webhook signatures, API keys).

Stable URLs:

- Production: `https://project--<project-id>.lovable.app`
- Preview: `https://project--<project-id>-dev.lovable.app`

## Basic project structure

```text
.
├── src/
│   ├── components/          # Reusable UI components (shadcn/ui + custom)
│   ├── hooks/               # React hooks (e.g., mobile detection)
│   ├── integrations/        # Lovable Cloud / Supabase clients and auth helpers
│   ├── lib/                 # Business logic, server functions, utilities
│   ├── routes/              # TanStack Start file-based routes
│   ├── server.ts            # SSR error wrapper entry
│   ├── start.ts             # TanStack Start instance + middleware
│   ├── router.tsx           # Router configuration
│   ├── styles.css           # Tailwind v4 theme and global styles
│   └── routeTree.gen.ts     # Auto-generated route tree (do not edit)
├── supabase/
│   ├── migrations/          # Database schema and policy migrations
│   └── config.toml          # Supabase project config (auto-generated)
├── tests/                   # Vitest test suites
├── package.json             # Scripts and dependencies
├── vitest.config.ts         # Vitest configuration
├── vite.config.ts           # Vite configuration (TanStack Start preset)
└── README.md                # This file
```

### Route conventions

TanStack Start uses file-based routing in `src/routes/`:

| File pattern | URL |
| --- | --- |
| `index.tsx` | `/` |
| `login.tsx` | `/login` |
| `_authenticated.app.tsx` | Layout for `/app/*` authenticated routes |
| `_authenticated.app.customers.index.tsx` | `/app/customers` |
| `_authenticated.app.customers.$id.tsx` | `/app/customers/:id` |
| `_authenticated.app.events.new.tsx` | `/app/events/new` |

The generated `src/routeTree.gen.ts` is updated automatically by the TanStack Router plugin.

## Authentication

The app uses Supabase Auth. Supported flows:

- Email/password sign-up and sign-in
- Password reset (`/forgot-password`, `/reset-password`)
- OAuth via Lovable Cloud (Google is configured by default)

Protected routes live under `/app/*` and are gated by `src/routes/_authenticated/route.tsx`. Unauthenticated users are redirected to `/login`.

## License

Private — for the project owner and authorized team members.
