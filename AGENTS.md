<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Team Workspace: Code Conventions & Architectural Patterns

All code in this repository MUST strictly adhere to the mandatory conventions specified in [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md):

- **Backend Architecture (`naturel-core` pattern)**:
  - **Route Handlers** (`src/app/api/**/route.ts`): Keep thin (≤ ~20-25 lines). Wrap with `handle()`. NEVER call Prisma directly from a route handler.
  - **Strict Layering**: **Route (Controller) → Action → Repository**.
  - **Validation**: **DTO** (`src/server/dto/*.dto.ts` with Zod).
  - **Authorization**: **Policy** (`src/server/policies/*.policy.ts`).
  - **Business Operations**: **Action** (`src/server/actions/<domain>/*.action.ts`). All DB writes wrapped in `prisma.$transaction`, audit and notifications logged within the same transaction.
  - **Database Queries**: **Repository** (`src/server/repositories/*.repository.ts`). Only Prisma queries, accept optional `db: Db = prisma` to participate in transactions.
  - **API Responses**: **Resource** (`src/server/resources/*.resource.ts`). Never return raw Prisma models.
  - **Server Isolation**: Every file in `src/server/` MUST start with `import 'server-only'`.

- **Frontend Architecture (`nando/client` pattern)**:
  - **Modular Domains**: One folder per domain under `src/modules/<domain>/` (`api.ts`, `types.ts`, `schema.ts`, `query-keys.ts`, `hooks/`, `components/`, `views/`).
  - **Data Fetching & Cache**: TanStack Query (`@tanstack/react-query`). Never use raw `useState` + `useEffect` for server data.
  - **Form Management**: `react-hook-form` + `zod`.
  - **API Client**: `fetch` calls exist ONLY inside `src/lib/api-client.ts`.
  - **Date & Time**: Dynamic `Asia/Tbilisi` timezone via `src/lib/date.ts`. Never use manual `+4` offsets or `toISOString().split('T')[0]`.
  - **Labels & Badges**: Centralized in `src/lib/labels.ts`.
  - **Reusable UI Primitives**: `src/components/ui/` and `src/components/shared/`.

