# Implementation Plan: Private Team Workspace

## Milestone Roadmap & Verification Gates

### STEP 0 — Repository Audit & Architecture
- [x] Inspect local and remote repository state.
- [x] Analyze design reference mockup in full detail.
- [x] Author core documentation:
  - `docs/ARCHITECTURE.md`
  - `docs/PRODUCT_REQUIREMENTS.md`
  - `docs/DATA_MODEL.md`
  - `docs/IMPLEMENTATION_PLAN.md`
- **Verification Gate**: Clear architectural blueprint approved and recorded.

---

### STEP 1 — Foundation & Database
- [x] Move initial Next.js files into project root.
- [x] Configure `package.json`, TypeScript, and Tailwind CSS with Georgian fonts (Noto Sans Georgian).
- [x] Install essential packages: `@prisma/client`, `prisma`, `lucide-react`, `zod`, `bcryptjs`, `@types/bcryptjs`, `date-fns`.
- [x] Create `docker-compose.yml` with persistent PostgreSQL (mapped to port 5434).
- [x] Initialize Prisma schema with models, migrations, and seed script for initial Admin user (`ფარნა`, `admin@team.local`).
- [x] Create database connection client and transactional audit helper.
- **Verification Gate**: Database boots in Docker, migrations apply cleanly, seed runs, and Next.js dev server starts without errors.

---

### STEP 2 — Authentication & Users
- [x] Implement server-side session management (cryptographic cookie-based tokens).
- [x] Implement API `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`.
- [x] Implement Admin user-management API (`/api/admin/users`) with creation, activation toggle, and password resets.
- [x] Create clean Georgian Login UI and Admin Users panel.
- [x] Enforce route protection and backend permission guards (`requireAdmin`, `requireAuth`).
- **Verification Gate**: Admin can log in, create a User (e.g. `ვასკა`, `თორნიკე`), and regular User is barred from Admin operations.

---

### STEP 3 — Application Shell & Shared Backlog
- [x] Build global layout matching the design reference:
  - Top navigation bar (Branding, Date Navigator, Search bar, `+ ახალი ტასკი`, Profile badge).
  - Left navigation sidebar with Georgian icons and bottom `ძირითადი შეჯამება` summary pill.
- [x] Implement Projects & Tasks CRUD API (`/api/tasks`, `/api/projects`).
- [x] Build Backlog UI with search, status/type/priority pill filters (`ყველა`, `Features`, `Bugs`, `Hotfix`).
- [x] Implement Quick Task Creation modal/drawer.
- [x] Implement Deadline Rule: regular user can set initial deadline; backend locks deadline upon initial assignment.
- **Verification Gate**: Tasks can be created, persisted, filtered, assigned, and deadline immobility is strictly tested.

---

### STEP 4 — Workflow Stages, Subtasks & Automatic Progress
- [x] Implement Workflow Stages API (`/api/tasks/[id]/stages`) with ordered sequential positions.
- [x] Implement Subtasks API (`/api/tasks/[id]/subtasks`) supporting multiple assignees.
- [x] Implement centralized progress engine: `Progress = (Done Subtasks / Active Subtasks) * 100` (counted once).
- [x] Implement stage completion and automatic handoff to the next assignee.
- [x] Implement in-app notifications on stage handoff and assignment.
- **Verification Gate**: 10 subtasks with 4 done displays 40%; multi-user subtasks do not double count; stage transitions atomically.

---

### STEP 5 — Vertical Timeline
- [x] Build vertical chronological timeline component with node markers and date headers.
- [x] Focus by default on Today (`დღეს`).
- [x] Support multi-day tasks displayed across their active date range without duplicate database records.
- [x] Implement "Schedule Mode" (planned dates) vs. "Activity Mode" (real historical audit events).
- [x] Style weekends and Georgian national holidays with distinct non-working indicators (`არასამუშაო დღე`).
- [x] Date jumping and quick "Today" reset action.
- **Verification Gate**: Date navigation scrolls smoothly; multi-day tasks link to the same task ID; historical mode shows genuine historical states.

---

### STEP 6 — Complete Task Details Drawer
- [x] Build side drawer opening on task click (matching center card in visual reference).
- [x] Header with Task ID (`TASK-104`), type pill, status, and overall progress bar.
- [x] Tabbed interface:
  - `სამუშაო`: Workflow stages, subtask checkoffs, handoff rail, tags, external links (GitLab, Figma).
  - `დეტალები`: Metadata, creator, dates.
  - `ფაილები`: Private file uploads with drag-and-drop & paste screenshot support.
  - `ყოველდღიური ჩანაწერი`: Optional "რა გააკეთე დღეს?" quick field with audit history.
  - `ლოგი`: Detailed audit history for this specific task.
- **Verification Gate**: All edits persist; file uploads are validated and stored safely; subtask completion immediately updates drawer and background timeline.

---

### STEP 7 — Pause, Reschedule & Workload Management
- [x] Implement Pause/Resume workflow with mandatory reason capture.
- [x] Implement Blocked status with reason.
- [x] Build Admin-only manual rescheduling dialog (shows old dates vs. new dates and logs reason).
- [x] Build Team Workload screen (`დატვირთვა`) showing member capacities, active/queued/paused tasks, and conflict warnings.
- **Verification Gate**: Pausing preserves progress; normal user cannot change locked deadlines; workload reflects real assignments.

---

### STEP 8 — Overview Dashboard, My Work & Notifications
- [x] Build `საწყისი` (Overview / Manager Dashboard) with real metrics: active today, completed today, overdue, blocked, paused.
- [x] Build `ჩემი სამუშაოები` (My Work) categorized by attention level (Needs attention, In Progress, Waiting, Paused, Done).
- [x] Implement in-app notification dropdown with mark-as-read capability.
- **Verification Gate**: Metrics calculate from real database records; personal workspace groups tasks accurately.

---

### STEP 9 — Complete QA, Verification & Internal Deployment Readiness
- [x] Verify test suite covering deadline locking, progress formula, and stage handoffs.
- [x] Test across viewport sizes (1440px, 1280px, 768px, 390px, 320px).
- [x] Test security: verify that normal user cannot bypass deadline check via API.
- [x] Provide simple Docker start & backup/restore documentation in `README.md`.
- **Verification Gate**: Full end-to-end user scenario passes without console errors or UI glitches.

---

### STEP 10 — Phase A: Stabilization & Fail-Closed Test Isolation
- [x] Enforce strict fail-closed database test isolation in `tests/test-db.ts` (exact DB name validation).
- [x] Implement Last-Admin protection against concurrent demotion/deactivation attempts.
- [x] Implement dedicated audit actions for deletions (`STAGE_DELETED`, `SUBTASK_DELETED`, `COMMENT_DELETED`, `ATTACHMENT_DELETED`).
- [x] Preserve historical completion timestamps (`completedAt`) upon task reopening.
- **Verification Gate**: 100% test isolation verified; zero application database records touched during test executions.

---

### STEP 11 — Founder Policy Decisions Implementation
- [x] **Decision 1 (Prevent Orphaned Tasks)**: Reject deletion of the only remaining stage of a stage-based task.
- [x] **Decision 2 (Stage Deletion Never Implies Completion)**: Removing a stage does not mark the task `DONE` or complete subtasks. If no valid assigned successor stage exists, deletion is rejected.
- [x] **Department Division**: Introduced `DEVELOPMENT` and `CONTENT` departments with dedicated filters in Backlog, Kanban, and Timeline.
- **Verification Gate**: 64/64 automated tests pass cleanly with sequential stage deletion invariants.

---

### STEP 12 — Independent Links, Reports Accuracy & Fresh Workspace Baseline
- [x] **Independent Links**: URLs support optional titles (defaulting to URL), with dedicated creation/deletion audit events.
- [x] **Reports Dynamic Engine**:
  - Dynamically calculates On-Time Delivery Rate evaluating completed vs. overdue commitments.
  - Subtitles dynamically indicate overdue count / late completions.
  - Dynamic Georgian month selector based on current date.
  - Overdue tasks from prior periods persist into current month until resolved.
- [x] **Clean Workspace Baseline**:
  - Full demo database backed up safely to `backups/backups_demo_before_reset.sql`.
  - Zero demo tasks, zero demo projects, single clean Admin user (`admin@team.local` / `admin123`).
  - Task number autoincrement sequence reset to 1.
- **Verification Gate**: Production build compiles with zero errors; full automated test suite passes with 64/64 tests.
