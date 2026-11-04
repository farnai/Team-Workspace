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
- [ ] Move initial Next.js files into project root.
- [ ] Configure `package.json`, TypeScript, and Tailwind CSS with Georgian fonts (Noto Sans Georgian).
- [ ] Install essential packages: `@prisma/client`, `prisma`, `lucide-react`, `zod`, `bcryptjs`, `@types/bcryptjs`, `date-fns`.
- [ ] Create `docker-compose.yml` with persistent PostgreSQL (mapped to port 5434).
- [ ] Initialize Prisma schema with models, migrations, and seed script for initial Admin user (`ფარნა`, `admin@team.local`).
- [ ] Create database connection client and transactional audit helper.
- **Verification Gate**: Database boots in Docker, migrations apply cleanly, seed runs, and Next.js dev server starts without errors.

---

### STEP 2 — Authentication & Users
- [ ] Implement server-side session management (cryptographic cookie-based tokens).
- [ ] Implement API `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`.
- [ ] Implement Admin user-management API (`/api/admin/users`) with creation, activation toggle, and password resets.
- [ ] Create clean Georgian Login UI and Admin Users panel.
- [ ] Enforce route protection and backend permission guards (`requireAdmin`, `requireAuth`).
- **Verification Gate**: Admin can log in, create a User (e.g. `ვასკა`, `თორნიკე`), and regular User is barred from Admin operations.

---

### STEP 3 — Application Shell & Shared Backlog
- [ ] Build global layout matching the design reference:
  - Top navigation bar (Branding, Date Navigator, Search bar, `+ ახალი ტასკი`, Profile badge).
  - Left navigation sidebar with Georgian icons and bottom `ძირითადი შეჯამება` summary pill.
- [ ] Implement Projects & Tasks CRUD API (`/api/tasks`, `/api/projects`).
- [ ] Build Backlog UI with search, status/type/priority pill filters (`ყველა`, `Features`, `Bugs`, `Hotfix`).
- [ ] Implement Quick Task Creation modal/drawer.
- [ ] Implement Deadline Rule: regular user can set initial deadline; backend locks deadline upon initial assignment.
- **Verification Gate**: Tasks can be created, persisted, filtered, assigned, and deadline immobility is strictly tested.

---

### STEP 4 — Workflow Stages, Subtasks & Automatic Progress
- [ ] Implement Workflow Stages API (`/api/tasks/[id]/stages`) with ordered sequential positions.
- [ ] Implement Subtasks API (`/api/tasks/[id]/subtasks`) supporting multiple assignees.
- [ ] Implement centralized progress engine: `Progress = (Done Subtasks / Active Subtasks) * 100` (counted once).
- [ ] Implement stage completion and automatic handoff to the next assignee.
- [ ] Implement in-app notifications on stage handoff and assignment.
- **Verification Gate**: 10 subtasks with 4 done displays 40%; multi-user subtasks do not double count; stage transitions atomically.

---

### STEP 5 — Vertical Timeline
- [ ] Build vertical chronological timeline component with node markers and date headers.
- [ ] Focus by default on Today (`04 ნოემბერი, 2026 ოთხშაბათი • დღეს`).
- [ ] Support multi-day tasks displayed across their active date range without duplicate database records.
- [ ] Implement "Schedule Mode" (planned dates) vs. "Activity Mode" (real historical audit events).
- [ ] Style weekends and Georgian national holidays with distinct non-working indicators (`არასამუშაო დღე`).
- [ ] Date jumping and quick "Today" reset action.
- **Verification Gate**: Date navigation scrolls smoothly; multi-day tasks link to the same task ID; historical mode shows genuine historical states.

---

### STEP 6 — Complete Task Details Drawer
- [ ] Build side drawer opening on task click (matching center card in visual reference).
- [ ] Header with Task ID (`TASK-104`), type pill, status, and overall progress bar.
- [ ] Tabbed interface:
  - `სამუშაო`: Workflow stages, subtask checkoffs, handoff rail, tags, external links (GitLab, Figma).
  - `დეტალები`: Metadata, creator, dates.
  - `ფაილები`: Private file uploads with drag-and-drop & paste screenshot support.
  - `ყოველდღიური ჩანაწერი`: Optional "რა გააკეთე დღეს?" quick field with audit history.
  - `ლოგი`: Detailed audit history for this specific task.
- **Verification Gate**: All edits persist; file uploads are validated and stored safely; subtask completion immediately updates drawer and background timeline.

---

### STEP 7 — Pause, Reschedule & Workload Management
- [ ] Implement Pause/Resume workflow with mandatory reason capture.
- [ ] Implement Blocked status with reason.
- [ ] Build Admin-only manual rescheduling dialog (shows old dates vs. new dates and logs reason).
- [ ] Build Team Workload screen (`დატვირთვა`) showing member capacities, active/queued/paused tasks, and conflict warnings.
- **Verification Gate**: Pausing preserves progress; normal user cannot change locked deadlines; workload reflects real assignments.

---

### STEP 8 — Overview Dashboard, My Work & Notifications
- [ ] Build `საწყისი` (Overview / Manager Dashboard) with real metrics: active today, completed today, overdue, blocked, paused.
- [ ] Build `ჩემი სამუშაოები` (My Work) categorized by attention level (Needs attention, In Progress, Waiting, Paused, Done).
- [ ] Implement in-app notification dropdown with mark-as-read capability.
- **Verification Gate**: Metrics calculate from real database records; personal workspace groups tasks accurately.

---

### STEP 9 — Complete QA, Verification & Internal Deployment Readiness
- [ ] Verify test suite covering deadline locking, progress formula, and stage handoffs.
- [ ] Test across viewport sizes (1440px, 1280px, 768px, 390px, 320px).
- [ ] Test security: verify that normal user cannot bypass deadline check via API.
- [ ] Provide simple Docker start & backup/restore documentation in `README.md`.
- **Verification Gate**: Full end-to-end user scenario passes without console errors or UI glitches.
