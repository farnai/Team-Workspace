# Product Requirements: Private Team Workspace

## 1. System Goals & Operational Scope
The **Private Team Workspace** is a high-reliability, internal work-tracking system for a core team of 5–10 members (Developers, Designers, QA, and Project Leads).

### Primary Operational Objectives
- Instant clarity on who is assigned to what today.
- Sequential workflow visibility (Design -> Development -> QA).
- Unambiguous responsibility for the current step and the next recipient in line.
- Transparent progress tracking calculated strictly from subtask completion.
- Absolute enforcement of established deadlines: **Only Admins can modify locked deadlines**.
- Accurate historical audit trail displaying genuine historical state on any past date.
- All user-facing interfaces rendered in natural, high-fidelity Georgian (ქართული).

---

## 2. User Roles & Permissions Matrix

| Feature / Action | Admin | User | Domain Rules & Constraints |
| :--- | :---: | :---: | :--- |
| **User Management** | ✅ | ❌ | Admin creates users, resets passwords, activates/deactivates accounts. |
| **System Settings** | ✅ | ❌ | Admin configures working days, company holidays, and global options. |
| **Create Project / Task** | ✅ | ✅ | Any authenticated member can create projects and backlog tasks. |
| **Edit Task Content** | ✅ | ✅ | Title, rich description, type, priority, and tags can be edited. |
| **Initial Deadline Setting** | ✅ | ✅ | Regular user can set the deadline when first creating or scheduling work. |
| **Modify Established Deadline** | ✅ | ❌ | **CRITICAL**: Once set, only Admin can extend or reschedule deadlines. |
| **Workflow Stages** | ✅ | ✅ | Create, reorder, and assign workflow stages. |
| **Subtask Management** | ✅ | ✅ | Create subtasks, assign single or multiple assignees, set initial dates. |
| **Mark Subtask Done/Reopen** | ✅ | ✅ | Authorized assignee or Admin can mark subtask done; automatically updates task %. |
| **Pause Work** | ✅ | ✅ | Pausing requires an explicit reason (e.g., interrupted by hotfix). Retains progress. |
| **Reschedule Work** | ✅ | ❌ | Admin can adjust planned dates with old vs. new date audit comparison. |
| **Optional Daily Update** | ✅ | ✅ | Lightweight "დღეს რა გაკეთდა?" input; never mandatory for task completion. |
| **View All Dashboards** | ✅ | ✅ | Overview, Timeline, Backlog, My Work, Workload, Activity Log. |

---

## 3. Detailed Screen Requirements

### 3.1 Global Navigation Header
- **Workspace Branding**: "Team Workspace" with distinct dual-leaf orange brand badge.
- **Dynamic Date Navigator**: `<` `დღეს • {Current Date}` `>` with immediate jump to Today.
- **Global Search**: Instant fuzzy filtering for Tasks (ID, Title), Assignees, and Projects with shortcut `Ctrl+K`.
- **Quick Action**: Prominent `+ ახალი ტასკი` (+ New Task) button in primary terracotta-orange.
- **Notifications**: Unread count indicator and quick dropdown for assignment/handoff/deadline alerts.
- **User Profile Pill**: Avatar, User Name (e.g. `ფარნა`), and Role (`Admin` or `User`).

### 3.2 Navigation Sidebar
- Navigation links:
  - `საწყისი` (Home / Overview Dashboard)
  - `თაიმლაინი` (Vertical Timeline - primary schedule view)
  - `ბექლოგი` (Shared Backlog)
  - `ჩემი სამუშაოები` (My Work - personalized workbench)
  - `დატვირთვა` (Team Workload & Capacity)
  - `რეპორტები` (Project Progress & Reports)
  - `ლოგი / ისტორია` (Comprehensive Audit Log)
  - `მომხმარებლები` (User Management - Admin only)
  - `პარამეტრები` (System Calendar & Settings - Admin only)
- Bottom Summary Card (`ძირითადი შეჯამება`):
  - Green indicator: `აქტიური ტასკები` (Active Tasks)
  - Red indicator: `გადაცილებული` (Overdue Tasks)
  - Neutral indicator: `დასრულებული (7 დღე)` (Completed in last 7 days)

### 3.3 Center View: Vertical Timeline
- Continuous vertical chronological timeline with node indicators.
- Defaults to Today's date (`დღეს`).
- Jump controls: `დღე` (Day), `კვირა` (Week), `თვე` (Month) view filters.
- **Multi-day task projection**: A task running from Nov 4 to Nov 8 displays seamlessly on all corresponding dates while pointing to a single task record.
- **Weekend & Holiday treatment**: Saturdays and Sundays are clearly demarcated as `არასამუშაო დღე` (Non-working day). Georgian national holidays display official names.
- Two distinct display modes:
  - **Schedule Mode**: Shows planned workload distribution.
  - **Activity Mode**: Shows actual chronological mutations that occurred on each date based on immutable audit history.

### 3.4 Task Details Drawer (Modal / Side Drawer)
- Top Bar: Task ID (e.g., `TASK-104`), Type Pill (`FEATURE`, `BUG`, `HOTFIX`), Star, Link Copy, More actions, Close button.
- Title and Description: Inline editable, supporting Markdown/rich formatting.
- Progress Banner: `საერთო პროგრესი: X%` with animated green progress bar and `Y / Z საბტასკი დასრულებულია` counter.
- Quick Meta Grid:
  - `დაწყება` (Start date)
  - `დედლაინი` (Deadline - with lock indicator for non-admins)
  - `სტატუსი` (Status dropdown)
  - `პრიორიტეტი` (Priority: დაბალი, საშუალო, მაღალი, კრიტიკული)
- Main Tabs:
  1. `სამუშაო` (Work & Stages):
     - Hierarchical stages (e.g. `1. დიზაინი`, `2. Development`, `3. QA`).
     - Subtasks list per stage with status check, assignee avatars, and due dates.
     - Right rail: Sequential handoff participants (`1 ვასკა • დიზაინი`, `2 თორნიკე • Development`, `3 ფარნა • QA`), tags, external links (GitLab, Figma).
  2. `დეტალები` (Full metadata, project, creation info).
  3. `ფაილები` (Secure private attachments, drag-and-drop, clipboard screenshot paste).
  4. `ყოველდღიური ჩანაწერი` (Optional daily progress notes with author and timestamp).
  5. `ლოგი` (Full audit trail of all changes to this specific task).

### 3.5 Shared Backlog (Right Side / Dedicated View)
- Quick task creation row.
- Filter pills: `ყველა` (All), `Features`, `Bugs`, `Hotfix`.
- Search & sorting by priority, creation date, or deadline.
- Unassigned tasks counter and one-click scheduling into Timeline.

### 3.6 Workload Management
- Team member capacity overview cards.
- Active task count, active subtasks, waiting/queued tasks, paused tasks, overdue tasks.
- Overlapping assignment warnings to avoid resource bottlenecks.

### 3.7 Personal Workbench ("ჩემი სამუშაოები")
- Focused sections for the logged-in user:
  - `ყურადღებას მოითხოვს` (Needs My Attention / Overdue / Blocked)
  - `მიმდინარე` (Currently In Progress)
  - `მოლოდინის რეჟიმში` (Waiting for previous workflow stage)
  - `შეჩერებული` (Paused)
  - `დასრულებული` (Completed)

---

## 4. Georgian Language Standards

| English Term | Georgian Equivalent | Context |
| :--- | :--- | :--- |
| Workspace | სამუშაო სივრცე / Team Workspace | Top header & branding |
| Task | ტასკი | Core unit of work |
| Subtask | საბტასკი | Unit of work inside a stage or task |
| Stage / Workflow | სამუშაო ეტაპი / ვორქფლოუ | Sequential progression |
| Timeline | თაიმლაინი | Vertical date schedule |
| Backlog | ბექლოგი | Unscheduled / inventory tasks |
| My Work | ჩემი სამუშაოები | Personalized member dashboard |
| Workload | დატვირთვა | Team member capacity view |
| Overview / Home | საწყისი | Team management overview |
| Activity Log | ლოგი / ისტორია | Immutable audit history |
| Users | მომხმარებლები | Admin user list |
| Settings | პარამეტრები | Admin system configuration |
| Overdue | გადაცილებული | Deadline passed |
| Today | დღეს | Current date |
| Tomorrow | ხვალ | Next day |
| Non-working Day | არასამუშაო დღე | Weekend / Public holiday |
| Low Priority | დაბალი | Priority level |
| Medium Priority | საშუალო | Priority level |
| High Priority | მაღალი | Priority level |
| Critical Priority | კრიტიკული | Priority level |
| Backlog Status | ბექლოგი | Status |
| Planned Status | დაგეგმილი | Status |
| In Progress Status | მიმდინარე | Status |
| Paused Status | შეჩერებული | Status |
| Blocked Status | დაბლოკილი | Status |
| Done Status | დასრულებული | Status |
| Cancelled Status | გაუქმებული | Status |
| Development Department | დეველოპმენტი | Department |
| Content Department | კონტენტი | Department |

---

## 5. Extended Governance & Business Policies

### 5.1 Department Division
- Users and Tasks belong to either `DEVELOPMENT` or `CONTENT`.
- Tasks can be filtered across Backlog, Kanban, Timeline, and Reports by department to avoid visual collisions between software engineering and media production.

### 5.2 Stage Deletion Governance (Founder Invariants)
- **Prevent Orphaned Tasks**: Deletion of the ONLY stage of a stage-based task is strictly prohibited.
- **Stage Deletion Never Implies Completion**: Deleting a stage is an administrative reorganization and must never mark the task `DONE` or complete pending subtasks. If no valid assigned successor stage exists, deletion is rejected.
- **Atomic Promotion**: Deleting an active stage automatically promotes the immediate assigned successor stage to active.

### 5.3 Independent Links & Attachments
- External links (GitLab, Figma, Docs) can be added with or without a custom name. When omitted, the name cleanly defaults to the URL itself.
- Deletions are immutably logged to the audit log.

### 5.4 Reports & Deadline Adherence Formula
- On-Time Delivery Rate dynamically evaluates both completed tasks (`completedAt <= deadline`) and open overdue tasks (`status !== DONE && deadline < now`).
- Subtitles dynamically highlight overdue tasks (`X გადაცილებული დავალება`), late completions, or on-schedule status.
