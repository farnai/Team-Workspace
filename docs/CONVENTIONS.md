# Team Workspace: კოდის სტრუქტურა და პატერნები

> ყველა ახალი კოდი ამ წესებით იწერება. ძველი კოდი ეტაპობრივად გადაეწყობა (იხ. ბოლო სექცია).
>
> - **ფრონტი** — `nando/client`-ის მოდულური სტრუქტურა (იქ Vue-ა, აქ React/Next.js — პრინციპი იგივეა).
> - **ბექენდი** — `naturel-core`-ის ფენები: **Route → Action → Repository**, ვალიდაცია **DTO**-თი, პასუხი **Resource**-ით (იქ Laravel-ია, აქ Next.js route handlers + Prisma — პრინციპი იგივეა).

---

## 1. საერთო სურათი

```
src/
├── app/                  # Next.js routing — მხოლოდ თხელი page.tsx / route.ts ფაილები
├── modules/              # ფრონტი: ერთი საქაღალდე = ერთი დომენი (tasks, projects, ...)
├── components/           # ფრონტი: საერთო UI (ui / shared / layout)
├── hooks/                # ფრონტი: გლობალური hooks
├── lib/                  # ფრონტი + საერთო: api-client, date, format, utils
└── server/               # ბექენდი: actions, repositories, dto, resources, policies, http
```

მთავარი წესი: **`src/app` არაფერს „აკეთებს“** — page მხოლოდ მოდულის view-ს არენდერებს, `route.ts` მხოლოდ Action-ს იძახებს.

---

## 2. ბექენდი

### 2.1 ფენები და პასუხისმგებლობა

```
HTTP request
   │
   ▼
route.ts  (Controller)     — ვალიდაცია (DTO) → ავტორიზაცია (Policy) → Action → Resource → JSON
   │
   ▼
Action                     — ერთი ბიზნეს-ოპერაცია: ტრანზაქცია, წესები, აუდიტი, შეტყობინებები
   │
   ▼
Repository                 — მხოლოდ Prisma მოთხოვნები, არანაირი ბიზნეს-ლოგიკა
   │
   ▼
Prisma / PostgreSQL
```

| ფენა | naturel-core-ში | აქ | რა შეიძლება | რა არ შეიძლება |
| --- | --- | --- | --- | --- |
| Controller | `Http/Controllers/CP/BrandController` | `src/app/api/**/route.ts` | DTO-ს parse, policy, Action-ის გამოძახება, Resource | Prisma, ბიზნეს-წესები |
| Request | `Http/Requests/CP/BrandStoreUpdateRequest` | `src/server/dto/*.dto.ts` (zod) | ფორმატის ვალიდაცია | DB-ში შემოწმება |
| Policy | `Policies/OrderPolicy` | `src/server/policies/*.policy.ts` | „შეუძლია თუ არა ამ user-ს“ | DB-ში ჩაწერა |
| Action | `Actions/Brand/StoreBrandAction` | `src/server/actions/<domain>/*.action.ts` | ტრანზაქცია, წესები, audit, notification | `NextResponse`, `cookies()` |
| Repository | `Repositories/BrandRepository` + `Contracts/...Interface` | `src/server/repositories/*.repository.ts` | Prisma queries | ბიზნეს-წესები, audit |
| Resource | `Http/Resources/CP/BrandResource` | `src/server/resources/*.resource.ts` | DB მოდელი → API პასუხი | DB მოთხოვნები |
| Enum | `Enums/...Enum` | Prisma enum (`@prisma/client`) + ლეიბლები `src/lib/labels.ts` | — | — |

> **ყურადღება:** ჩვენი „Action“ ≠ Next.js-ის „Server Action“ (`'use server'`). Server Actions-ს არ ვიყენებთ — ყველაფერი `/api` route-ებით.

### 2.2 საქაღალდეები

```
src/server/
├── http/
│   ├── errors.ts            # AppError, NotFoundError, ForbiddenError, ValidationError
│   └── route.ts             # handle() — ერთი try/catch ყველა route-ისთვის
├── auth/
│   └── session.ts           # requireUser(), requireAdmin()
├── dto/
│   └── task.dto.ts          # createTaskDto, updateTaskDto (zod) + ტიპები
├── policies/
│   └── task.policy.ts       # canUpdateTask(), canDeleteTask(), ...
├── actions/
│   └── tasks/
│       ├── create-task.action.ts
│       ├── update-task.action.ts
│       ├── delete-task.action.ts
│       └── complete-stage.action.ts
├── repositories/
│   ├── task.repository.ts
│   └── audit.repository.ts
└── resources/
    └── task.resource.ts     # toTaskResource(), toTaskListResource()
```

ფაილის სახელი: `kebab-case.<role>.ts` — `create-task.action.ts`, `task.repository.ts`, `task.dto.ts`.
ყველა ფაილი `src/server/`-ში იწყება `import 'server-only'`-ით — ბრაუზერის bundle-ში შემთხვევით რომ არ მოხვდეს.

### 2.3 მაგალითი ბოლომდე: `POST /api/tasks`

**`src/server/http/errors.ts`**
```ts
import 'server-only'

export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export class UnauthorizedError extends AppError { constructor() { super('გთხოვთ გაიაროთ ავტორიზაცია', 401) } }
export class ForbiddenError extends AppError { constructor(msg = 'წვდომა შეზღუდულია') { super(msg, 403) } }
export class NotFoundError extends AppError { constructor(msg = 'ვერ მოიძებნა') { super(msg, 404) } }
```

**`src/server/http/route.ts`** — ერთადერთი try/catch მთელ პროექტში
```ts
import 'server-only'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AppError } from './errors'

export function handle<C>(fn: (req: Request, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    try {
      const data = await fn(req, ctx)
      return NextResponse.json({ data })
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ error: err.issues[0]?.message ?? 'არასწორი მონაცემები' }, { status: 422 })
      }
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      console.error(err)
      return NextResponse.json({ error: 'სერვერის შეცდომა' }, { status: 500 })
    }
  }
}
```

**`src/server/dto/task.dto.ts`** — Laravel-ის FormRequest-ის ანალოგი
```ts
import 'server-only'
import { z } from 'zod'
import { Priority, TaskType, Department } from '@prisma/client'

export const createTaskDto = z.object({
  title: z.string().trim().min(1, 'სათაური სავალდებულოა').max(200),
  projectId: z.string().uuid(),
  type: z.nativeEnum(TaskType),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  department: z.nativeEnum(Department),
  deadline: z.coerce.date().nullable().optional(),     // არასწორი თარიღი → 422, არა 500
  assigneeIds: z.array(z.string().uuid()).default([]),
  links: z.array(z.object({
    name: z.string().trim().max(200).optional(),
    url: z.string().url().refine(u => /^https?:\/\//i.test(u), 'მხოლოდ http(s) ბმული'),
  })).default([]),
})
export type CreateTaskDto = z.infer<typeof createTaskDto>
```

**`src/server/repositories/task.repository.ts`** — მხოლოდ Prisma
```ts
import 'server-only'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Db = PrismaClient | Prisma.TransactionClient

export const taskRepository = {
  findById(id: string, db: Db = prisma) {
    return db.task.findUnique({ where: { id }, include: { assignments: true, stages: { orderBy: { position: 'asc' } } } })
  },
  create(data: Prisma.TaskUncheckedCreateInput, db: Db = prisma) {
    return db.task.create({ data })
  },
  setAssignees(taskId: string, userIds: string[], db: Db = prisma) {
    return db.taskAssignment.createMany({ data: userIds.map(userId => ({ taskId, userId })), skipDuplicates: true })
  },
}
```
ყველა მეთოდი იღებს არასავალდებულო `db`-ს — ასე Action-ს შეუძლია ტრანზაქცია (`tx`) გადასცეს.

**`src/server/actions/tasks/create-task.action.ts`** — ბიზნეს-ოპერაცია
```ts
import 'server-only'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { taskRepository } from '@/server/repositories/task.repository'
import { auditRepository } from '@/server/repositories/audit.repository'
import type { CreateTaskDto } from '@/server/dto/task.dto'

/** ქმნის დავალებას შემსრულებლებით და ბმულებით; ყველაფერი ერთ ტრანზაქციაში. */
export async function createTaskAction(input: CreateTaskDto, actor: User) {
  return prisma.$transaction(async (tx) => {
    const task = await taskRepository.create({
      title: input.title,
      projectId: input.projectId,
      type: input.type,
      priority: input.priority,
      department: input.department,
      deadline: input.deadline ?? null,
      deadlineLocked: Boolean(input.deadline),
      createdById: actor.id,
    }, tx)

    await taskRepository.setAssignees(task.id, input.assigneeIds, tx)
    await auditRepository.log({ taskId: task.id, actorId: actor.id, action: 'TASK_CREATED', entityType: 'TASK', entityId: task.id }, tx)

    return task
  })
}
```

**`src/server/resources/task.resource.ts`** — რას ვაბრუნებთ API-ში
```ts
import 'server-only'
import type { Task } from '@prisma/client'

export function toTaskResource(task: Task) {
  return {
    id: task.id,
    number: task.taskNumber,
    title: task.title,
    status: task.status,
    priority: task.priority,
    deadline: task.deadline?.toISOString() ?? null,
  }
}
```

**`src/app/api/tasks/route.ts`** — თხელი controller
```ts
import { handle } from '@/server/http/route'
import { requireUser } from '@/server/auth/session'
import { createTaskDto } from '@/server/dto/task.dto'
import { createTaskAction } from '@/server/actions/tasks/create-task.action'
import { toTaskResource } from '@/server/resources/task.resource'

export const POST = handle(async (req) => {
  const user = await requireUser()
  const input = createTaskDto.parse(await req.json())
  const task = await createTaskAction(input, user)
  return toTaskResource(task)
})
```

### 2.4 ბექენდის წესები
1. **route.ts ≤ ~20 ხაზი.** Prisma-ს პირდაპირ არ იძახებს.
2. **ყველა ჩაწერა — Action-ში, `prisma.$transaction`-ით.** აუდიტი და notification იმავე `tx`-ში იწერება.
3. **ავტორიზაცია — Policy-ში**, Action-ის დასაწყისში ან route-ში: `if (!canUpdateTask(user, task)) throw new ForbiddenError()`.
4. **შეცდომები — `throw new AppError(...)`**, არა `throw new Error('UNAUTHORIZED')` და string-ების შედარება.
5. **პასუხი — ყოველთვის Resource-ით.** Prisma-ს მოდელი პირდაპირ არ ბრუნდება (ზედმეტ ველებს არ გავცემთ).
6. **ფორმა:** წარმატება `{ data }`, შეცდომა `{ error }` + სწორი HTTP სტატუსი (401/403/404/422/500).
7. **თარიღი/დრო:** სერვერზე ყველაფერი UTC-ში ინახება; „დღის საზღვარი“ მხოლოდ `src/lib/date.ts`-ის ფუნქციებით (Asia/Tbilisi), ხელით `+4` ან `setHours` აკრძალულია.

---

## 3. ფრონტი

### 3.1 საქაღალდეები (nando/client-ის მიხედვით)

```
src/
├── app/                              # Next.js routes — მხოლოდ თხელი ფაილები
│   ├── (auth)/login/page.tsx         #   → <LoginView />
│   └── (workspace)/
│       ├── layout.tsx                #   → <WorkspaceLayout> (Sidebar + Header)
│       ├── tasks/page.tsx            #   → <TasksView />
│       ├── tasks/[id]/page.tsx       #   → <TaskDetailView id=... />
│       └── projects/page.tsx         #   → <ProjectsView />
│
├── modules/
│   └── tasks/
│       ├── api.ts                    # API გამოძახებები ამ დომენისთვის
│       ├── types.ts                  # ტიპები + enum-ების const-ები
│       ├── schema.ts                 # ფორმების zod სქემები
│       ├── query-keys.ts             # TanStack Query-ის key-ები
│       ├── hooks/
│       │   ├── useTasks.ts           # useQuery
│       │   └── useCreateTask.ts      # useMutation
│       ├── components/
│       │   ├── TaskCard.tsx
│       │   ├── TaskStatusBadge.tsx
│       │   └── CreateTaskForm.tsx
│       └── views/
│           ├── TasksView.tsx         # გვერდის შიგთავსი (page.tsx მას არენდერებს)
│           └── TaskDetailView.tsx
│
├── components/
│   ├── ui/                           # პრიმიტივები: Button, Input, Dialog, Select, DatePicker...
│   ├── shared/                       # დომენზე დამოუკიდებელი: PageHeader, DataTable, ConfirmDialog, LoadingError, Pagination
│   └── layout/                       # Sidebar, Header, WorkspaceLayout
│
├── hooks/                            # გლობალური: useToastMutation, useDebounce
└── lib/
    ├── api-client.ts                 # ერთი fetch wrapper + getErrorMessage()
    ├── date.ts                       # ყველა თარიღის ფუნქცია (Tbilisi)
    ├── labels.ts                     # სტატუსი/პრიორიტეტი → ქართული ტექსტი/ფერი
    └── utils.ts                      # cn() და ა.შ.
```

მოდულები: `auth`, `tasks`, `task-stages`, `projects`, `workload`, `timeline`, `overview`, `reports`, `archive`, `audit`, `admin-users`, `settings`, `notifications`.

**წესი:** მოდული სხვა მოდულის `components`-ს პირდაპირ არ იყენებს; საჭიროების შემთხვევაში კომპონენტი `components/shared`-ში გადადის. სხვა მოდულის `api.ts`/`types.ts`/`hooks`-ის import დასაშვებია.

### 3.2 მაგალითი: tasks მოდული

**`src/lib/api-client.ts`** — ერთადერთი ადგილი, სადაც `fetch` იძახება
```ts
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)          // HTML-ის შეცდომის გვერდზე არ ვარდება
  if (res.status === 401) window.location.href = '/login'
  if (!res.ok) throw new ApiError(json?.error ?? `შეცდომა (${res.status})`, res.status)
  return json.data as T
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  delete: <T>(url: string) => request<T>('DELETE', url),
}

export function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'უცნობი შეცდომა'
}
```

**`src/modules/tasks/types.ts`**
```ts
export const TaskStatus = {
  Backlog: 'BACKLOG', Planned: 'PLANNED', InProgress: 'IN_PROGRESS',
  Paused: 'PAUSED', Blocked: 'BLOCKED', Done: 'DONE', Cancelled: 'CANCELLED',
} as const
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus]

export interface Task {
  id: string
  number: number
  title: string
  status: TaskStatus
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  deadline: string | null
}

export interface CreateTaskPayload { title: string; projectId: string; /* ... */ }
```
> client-ში `@prisma/client`-ის import არ კეთდება — ტიპები `types.ts`-შია.

**`src/modules/tasks/api.ts`**
```ts
import { api } from '@/lib/api-client'
import type { Task, CreateTaskPayload } from './types'

export const tasksApi = {
  list: (params?: { status?: string }) => api.get<Task[]>(`/tasks?${new URLSearchParams(params)}`),
  get: (id: string) => api.get<Task>(`/tasks/${id}`),
  create: (payload: CreateTaskPayload) => api.post<Task>('/tasks', payload),
  remove: (id: string) => api.delete<void>(`/tasks/${id}`),
}
```

**`src/modules/tasks/query-keys.ts`**
```ts
export const taskKeys = {
  all: ['tasks'] as const,
  list: (filters: object) => [...taskKeys.all, 'list', filters] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
}
```

**`src/modules/tasks/hooks/useTasks.ts`** + **`useCreateTask.ts`**
```ts
import { useQuery } from '@tanstack/react-query'
import { tasksApi } from '../api'
import { taskKeys } from '../query-keys'

export function useTasks(filters: { status?: string } = {}) {
  return useQuery({ queryKey: taskKeys.list(filters), queryFn: () => tasksApi.list(filters) })
}
```
```ts
import { useToastMutation } from '@/hooks/useToastMutation'
import { tasksApi } from '../api'
import { taskKeys } from '../query-keys'

export function useCreateTask() {
  return useToastMutation({
    mutationFn: tasksApi.create,
    successMessage: 'დავალება შეიქმნა',
    invalidate: [taskKeys.all],      // ყველა სია ავტომატურად განახლდება
  })
}
```

**`src/modules/tasks/views/TasksView.tsx`**
```tsx
'use client'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingError } from '@/components/shared/LoadingError'
import { TaskCard } from '../components/TaskCard'
import { useTasks } from '../hooks/useTasks'

export function TasksView() {
  const { data: tasks, isPending, error, refetch } = useTasks()

  return (
    <div className="space-y-6">
      <PageHeader title="დავალებები" />
      <LoadingError pending={isPending} error={error} onRetry={refetch}>
        {tasks?.map(task => <TaskCard key={task.id} task={task} />)}
      </LoadingError>
    </div>
  )
}
```

**`src/app/(workspace)/tasks/page.tsx`**
```tsx
import { TasksView } from '@/modules/tasks/views/TasksView'
export default function Page() { return <TasksView /> }
```

### 3.3 ფრონტის წესები
1. **`fetch` მხოლოდ `lib/api-client.ts`-ში.** კომპონენტი API-ს `hooks`-ის გავლით იძახებს.
2. **სერვერის მონაცემები — TanStack Query** (`@tanstack/react-query`), არა `useState` + `useEffect`. ასე ქეში, refetch, race condition-ები და „ძველი მონაცემები სხვა გვერდზე“ თავისით გვარდება.
3. **ფორმები — `react-hook-form` + `zod`** (`schema.ts`-დან). ვალიდაციის შეტყობინებები ქართულად.
4. **კომპონენტი ≤ ~250 ხაზი, ≤ ~8 `useState`.** მეტია → დაყავი ქვე-კომპონენტებად / hook-ად.
5. **`view` = გვერდი, `component` = ნაწილი.** view-ში მხოლოდ კომპოზიცია და hooks; UI-ის დეტალები — components-ში.
6. **UI — მხოლოდ `components/ui` პრიმიტივები** (Button, Dialog, Select, DatePicker...). native `<select>`, `alert()`, `confirm()` — არა; `ConfirmDialog` და toast — კი.
7. **ლეიბლები/ფერები** (სტატუსი, პრიორიტეტი, დეპარტამენტი) — მხოლოდ `lib/labels.ts`-ში, ერთხელ.
8. **თარიღები** — მხოლოდ `lib/date.ts` (`formatDate`, `isOverdue`, `tbilisiToday`...). `toISOString().split('T')[0]` აკრძალულია.
9. **ხელმისაწვდომობა:** დასაკლიკებელი ელემენტი = `<button>` ან `<Link>`; modal-ს აქვს `role="dialog"` და Esc ხურავს მხოლოდ ზედა modal-ს.
10. **`'use client'`** — მხოლოდ views/components-ში, რომლებსაც state/hooks სჭირდებათ; `page.tsx` და `layout.tsx` server component-ებია.

---

## 4. საერთო წესები

### სახელდება
| რა | ფორმატი | მაგალითი |
| --- | --- | --- |
| React კომპონენტი | `PascalCase.tsx` | `TaskCard.tsx` |
| hook | `useCamelCase.ts` | `useCreateTask.ts` |
| სერვერის ფაილი | `kebab-case.<role>.ts` | `create-task.action.ts` |
| Action ფუნქცია | `<verb><Noun>Action` | `completeStageAction` |
| Repository | `<noun>Repository` | `taskRepository` |
| DTO | `<verb><Noun>Dto` | `updateTaskDto` |
| API ველები | `camelCase` (Prisma-ს მსგავსად) | `projectId`, `deadlineLocked` |

### ტესტები
- **Action-ის ტესტი** — Action-ს პირდაპირ იძახებს სატესტო ბაზაზე (`tests/actions/*.test.ts`).
- **Route-ის ტესტი** — route handler-ს იძახებს `Request`-ით და ამოწმებს სტატუსს + `{ data | error }` (`tests/api/*.test.ts`). უფლებების ტესტი **აუცილებლად** route-ის დონეზე — არა ლოგიკის თავიდან დაწერით ტესტში.
- ყველა ტესტი `tests/test-db.ts`-ის `testPrisma`-ს იყენებს; `new PrismaClient()` ტესტში აკრძალულია.
- სქემის ცვლილება = **მიგრაცია** (`npx prisma migrate dev --name ...`) იმავე commit-ში. `db push` მხოლოდ ლოკალურ ექსპერიმენტზე.

### Commit-ები
- Conventional: `feat(tasks): ...`, `fix(auth): ...`, `refactor(workload): ...`.
- ერთი commit = ერთი ლოგიკური ცვლილება. `main`-ში push = production deploy.

---

## 5. გადასვლის გეგმა (ძველი კოდიდან)

ერთბაშად არ გადავწერთ — ყოველი ნაბიჯი ცალკე PR-ია და აპლიკაცია ყოველ ნაბიჯზე მუშაობს.

1. **საფუძველი** — `src/server/http/{errors,route}.ts`, `src/server/auth/session.ts`, `src/lib/{api-client,date,labels}.ts`, TanStack Query provider, `useToastMutation`. (`department`-ის მიგრაცია უკვე დამატებულია — `20261110165000_add_department_and_audit_fixes`.)
2. **ერთი სანიმუშო მოდული: `projects`** (პატარაა) — ბექენდი ფენებად + ფრონტი `modules/projects`-ში. ეს ხდება შაბლონი დანარჩენისთვის.
3. **`tasks` ბექენდი** — `tasks/route.ts`, `tasks/[id]/route.ts`, `stages/[id]/complete` → Actions + Policy. ამ დროს სწორდება: ეტაპის დასრულება ტრანზაქციაში, ეტაპის დედლაინის დაბლოკვა, აუდიტის cascade, ბმულების ვალიდაცია.
4. **`tasks` ფრონტი** — `TaskDetailsDrawer.tsx` (2468 ხაზი) და `TaskModal.tsx` (1329 ხაზი) იშლება `modules/tasks/components/*` და `modules/task-stages/*`-ად.
5. **დანარჩენი მოდულები** რიგით: `kanban` → `workload` → `timeline` → `overview`/`reports` → `archive`/`audit` → `admin-users`/`settings`.
6. **გასუფთავება** — `app/page.tsx`-ის ხელით ნავიგაცია (`pushState`) იცვლება Next.js routes-ით; `SharedBacklog.tsx` (მკვდარი კოდი) იშლება; ძველი `src/lib/*` ფუნქციები, რომლებიც `src/server`-ში გადავიდა, იშლება.
