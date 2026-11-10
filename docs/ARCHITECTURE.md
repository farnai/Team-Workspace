# System Architecture: Private Team Workspace

## 1. Executive Summary

Private Team Workspace is an internal, self-hosted task management and work-tracking application built specifically for a high-velocity team of 5–10 members. The application delivers real-time team visibility, deterministic workflow handoffs, immutable audit trails, and strict deadline governance in full Georgian (ქართული) language.

Unlike commercial multi-tenant SaaS products, the architecture optimizes for zero operational bloat, strict data ownership, high information density, and rapid local or internal private-server deployment.

---

## 2. Technology Stack & Architectural Decision Records (ADRs)

| Layer | Selected Technology | Rationale |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router, React 19) | Modern React Server Components, server actions, integrated API route handlers, optimized static/dynamic bundling. |
| **Language** | TypeScript (Strict Mode) | Full type-safety across database models, server business logic, API contracts, and UI components. |
| **Styling** | Tailwind CSS + Lucide Icons | Clean, utility-first CSS matching the light, warm, high-density Georgian design aesthetic from the reference mockup. |
| **State Management**| TanStack Query + React Hook Form + Zod | Seamless server state synchronization, robust form handling, and strict schema validation on both client and server. |
| **Database & ORM** | PostgreSQL + Prisma ORM | Relational consistency, transactional safety, deterministic constraints, and automated versioned migrations. |
| **Authentication** | Server-Side HTTP-Only Sessions + Argon2id / bcrypt | Secure, brute-force-resilient credential authentication without external identity dependencies. |
| **Audit Log** | Append-Only Transactional Event Store | Tamper-proof, immutable record of every user action and state transition. |
| **File Storage** | Private Local Secure Volume Storage | Authorization-checked static file serving with MIME validation and safe UUID-based filenames. |
| **Timezone** | `Asia/Tbilisi` (UTC+4) | Centralized dynamic date parsing and calendar rendering. Zero hardcoded mock dates. |
| **Layering** | Route → Action → Repository | Strict backend separation of concerns (`naturel-core` pattern). |
| **Frontend Modularity** | Domain Modules (`src/modules/`) | Feature-encapsulated views, hooks, types, schema and api clients (`nando/client` pattern). |

> **სავალდებულო კოდის სტანდარტები:** პროექტის დეტალური კოდის სტრუქტურა და წესები აღწერილია [`docs/CONVENTIONS.md`](CONVENTIONS.md)-ში.

---

## 3. High-Level Architectural Diagram

```mermaid
flowchart TD
    subgraph Client["Browser Client (ქართული UI)"]
        UI_Nav["Navigation Sidebar\n(საწყისი, თაიმლაინი, ბექლოგი, ჩემი სამუშაოები...)"]
        UI_Timeline["Vertical Timeline\n(Schedule & Activity Modes)"]
        UI_Backlog["Shared Backlog\n(Filters, Quick Create)"]
        UI_Drawer["Task Details Drawer\n(Workflow, Subtasks, Links, Daily Notes)"]
        UI_Workload["Workload & Overview\n(Capacity, Overlaps, Stats)"]
    end

    subgraph Server["Next.js Server (App Router & API Handlers)"]
        Auth_MW["Session & Role Guard\n(Admin vs User Authorization)"]
        subgraph Services["Core Business Services"]
            Task_Service["Task Service\n(CRUD, Status Transitions)"]
            Deadline_Service["Deadline Governance\n(Initial user setting, Admin-only lock)"]
            Workflow_Service["Workflow & Progress Engine\n(Auto % = Done/Total, Sequential Stage Handoff)"]
            Timeline_Service["Timeline Engine\n(Multi-day projection, Holidays, Real Activity)"]
            Audit_Service["Audit & Activity Engine\n(Immutable append-only events)"]
            File_Service["Attachment & Upload Guard\n(Validation, Auth Check, Private Serve)"]
        end
    end

    subgraph Data["Database & Storage"]
        PG[(PostgreSQL DB)]
        Uploads[Private File Storage\n(/uploads)]
    end

    Client -->|HTTP / JSON / Cookies| Auth_MW
    Auth_MW --> Services
    Services -->|Prisma Transactions| PG
    File_Service -->|Local Secure I/O| Uploads
```

---

## 4. Key Subsystems & Core Domain Rules

### 4.1 Authentication & Role-Based Access Control (RBAC)
- **Two Roles Only**:
  - `ADMIN`: User provisioning, password resets, holiday configuration, full task & stage management, **exclusive permission to modify established deadlines**, manual rescheduling with reason capture.
  - `USER`: Task creation, subtask creation, stage/task assignment, marking subtasks complete, commenting, daily updates, pausing assigned work with reason.
- **No Public Registration**: Accounts are provisioned solely by Administrators.
- **Session Security**: Session tokens are cryptographically secure random tokens stored in the database with expiry, served via `httpOnly`, `SameSite=Lax`, secure cookies.

### 4.2 Deadline Governance Rule (CRITICAL)
- When a task or subtask is first created or assigned, a regular `USER` may set the initial deadline.
- As soon as the initial deadline is saved (`deadlineLocked = true` or `deadline != null`), **only an ADMIN can modify or extend it**.
- The backend strictly enforces this rule in database transactions. Reassigning or unassigning a task does not clear the deadline lock.
- Any admin deadline adjustment triggers a mandatory audit event logging the previous deadline, new deadline, and the admin's stated reason.

### 4.3 Centralized Progress & Workflow Calculation
- **Formula**: `Progress = (Completed Subtasks / Total Active Subtasks) * 100`
- Subtasks assigned to multiple team members are counted **exactly once**.
- Cancelled subtasks are excluded from the denominator.
- Reopening a subtask recalculates progress instantaneously.
- If no subtasks exist, progress is either 0% or 100% based on task status.
- Frontend cannot submit an arbitrary progress integer; the server recalculates and persists progress on every subtask state mutation.

### 4.4 Workflow Stage Progression & Atomic Handoff
- Tasks support ordered workflow stages (e.g., `1. Design (ვასკა)` -> `2. Development (თორნიკე)` -> `3. QA (ფარნა)`).
- Stages are sequential by default.
- Completing a stage verifies all required subtasks are done, records completion, activates the subsequent stage, assigns current responsibility to the next assignee, and produces notification events atomically inside a Prisma transaction.
- **Stage Deletion Governance (Founder Policy Decision)**:
  1. **Prevent Orphaned Tasks**: Deleting the only remaining stage of a stage-based task is strictly forbidden. The system rejects the operation with a clear Georgian notification.
  2. **Stage Deletion Never Implies Completion**: Removing a workflow stage is an administrative action, not proof that work was accomplished. It never automatically marks the task `DONE` or marks remaining subtasks complete.
  3. **Active Stage Deletion Safe Promotion**: When deleting an active stage, the immediate successor stage MUST exist and MUST already have an assigned member. The successor is atomically promoted to `isActive = true`. If no valid assigned successor exists, deletion is rejected.

### 4.5 Last-Admin Protection & Concurrency Safety
- The platform guarantees that at least one active `ADMIN` always exists.
- Any attempt to demote (`role = USER`) or deactivate (`isActive = false`) the sole remaining active admin is rejected.
- Concurrency protection: To prevent race conditions from simultaneous demotion/deactivation requests, checks are executed inside transactional queries, ensuring fail-closed safety.

### 4.6 Department Division (DEVELOPMENT vs. CONTENT)
- Users and Tasks belong to a `Department` (`DEVELOPMENT` or `CONTENT`).
- Backlog, Kanban, and Timeline provide immediate filtering by department, preventing visual clutter between engineering work and content generation.
- Tasks default to `DEVELOPMENT` and can be transitioned cleanly.

### 4.7 Reports & Analytics Metric Engine
- **Accurate On-Time Delivery Rate**:
  $$\text{On-Time Delivery Rate} = \frac{\text{On-Time Completed}}{\text{On-Time Completed} + \text{Late Completed} + \text{Overdue Active}} \times 100$$
  Evaluates actual completion dates against deadlines (`completedAt <= deadline`), while factoring in ongoing past-due commitments.
- **Dynamic Date Intervals & Overdue Persistence**:
  Incomplete tasks whose deadline passed in a prior month remain visible in the current reporting period until resolved. Month selectors are dynamically generated with Georgian localization.

### 4.8 Vertical Timeline System
- Displays a continuous chronological vertical axis.
- Centers on today (`დღეს`) with backward/forward smooth scrolling and direct date navigation.
- **Multi-day task representation**: Multi-day tasks are projected across their scheduled dates visually without creating duplicate rows in the database.
- **Two Timeline Modes**:
  1. *Schedule Mode*: Displays planned work schedules and date allocations.
  2. *Activity Mode*: Displays what actually happened on that specific date, queried directly from immutable audit records (avoiding misleading retroactive state).
- **Weekends & Holidays**: Saturday and Sunday are marked as non-working days (`არასამუშაო დღე`). Configurable Georgian national holidays are respected with visual distinction and schedule conflict warnings.

### 4.9 Append-Only Audit & Activity Logging
- Every create, update, delete, assignment, status change, deadline shift, pause, resume, attachment upload, link creation, and deletion event is appended to `audit_events`.
- Dedicated deletion audit actions (`STAGE_DELETED`, `SUBTASK_DELETED`, `COMMENT_DELETED`, `ATTACHMENT_DELETED`) ensure complete operational traceability.
- No user (including Admin) can delete or alter audit events through the UI or API.
- Sensitive credentials (passwords, session hashes) are never written to audit metadata payloads.

---

## 5. Security & Data Protection
1. **CSRF & Injection Protection**: Handled via standard Next.js server actions and Prisma parameterized queries.
2. **File Upload Security**: Uploads are restricted by extension, magic-byte MIME type inspection, file size caps (max 25MB), randomized safe storage filenames, and served via authenticated streaming endpoints.
3. **Independent Links**: External URLs (GitLab, Figma, Docs) are validated, stored with `isExternal = true`, and support optional human titles (defaulting to the URL itself).
4. **Session Rate Limiting**: In-memory / database sliding window rate limiter on `/api/auth/login` to prevent brute-force credential stuffing.
5. **Test Database Fail-Closed Protection**: Automated tests are restricted to dedicated test databases ending with `_test_db` or `_test`, completely barring connections to `team_workspace_db`.
