import { TaskStatus, Priority, Department, TaskType, Role, AuditAction } from '@prisma/client'

export const TASK_STATUS_LABELS: Record<TaskStatus, { label: string; color: string; bg: string; border: string }> = {
  BACKLOG: {
    label: 'ბექლოგი',
    color: 'text-stone-700',
    bg: 'bg-stone-100',
    border: 'border-stone-200',
  },
  PLANNED: {
    label: 'დაგეგმილი',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
  IN_PROGRESS: {
    label: 'პროცესში',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  PAUSED: {
    label: 'შეჩერებული',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  BLOCKED: {
    label: 'დაბლოკილი',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  DONE: {
    label: 'დასრულებული',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  CANCELLED: {
    label: 'გაუქმებული',
    color: 'text-stone-500',
    bg: 'bg-stone-100',
    border: 'border-stone-200',
  },
}

export const PRIORITY_LABELS: Record<Priority, { label: string; color: string; bg: string; border: string }> = {
  LOW: {
    label: 'დაბალი',
    color: 'text-stone-600',
    bg: 'bg-stone-100',
    border: 'border-stone-200',
  },
  MEDIUM: {
    label: 'საშუალო',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  HIGH: {
    label: 'მაღალი',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  CRITICAL: {
    label: 'კრიტიკული',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
}

export const DEPARTMENT_LABELS: Record<Department, { label: string; color: string; bg: string; border: string }> = {
  DEVELOPMENT: {
    label: 'დეველოპმენტი',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  CONTENT: {
    label: 'კონტენტი',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
}

export const TASK_TYPE_LABELS: Record<TaskType, { label: string; color: string; bg: string; border: string }> = {
  FEATURE: {
    label: 'ფუნქციონალი',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  BUG: {
    label: 'ბაგი',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  HOTFIX: {
    label: 'ჰოტფიქსი',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
}

export const ROLE_LABELS: Record<Role, { label: string; color: string; bg: string }> = {
  ADMIN: {
    label: 'ადმინისტრატორი',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
  },
  USER: {
    label: 'წევრი',
    color: 'text-stone-700',
    bg: 'bg-stone-100',
  },
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  TASK_CREATED: 'დავალების შექმნა',
  TASK_UPDATED: 'დავალების რედაქტირება',
  TASK_DELETED: 'დავალების წაშლა',
  DEPARTMENT_CHANGED: 'გუნდის ცვლილება',
  TASK_ASSIGNED: 'შემსრულებლის მინიჭება',
  TASK_UNASSIGNED: 'შემსრულებლის მოხსნა',
  STAGE_CREATED: 'ეტაპის დამატება',
  STAGE_REORDERED: 'ეტაპების გადალაგება',
  STAGE_COMPLETED: 'ეტაპის დასრულება',
  STAGE_DELETED: 'ეტაპის წაშლა',
  SUBTASK_CREATED: 'საბტასკის დამატება',
  SUBTASK_COMPLETED: 'საბტასკის დასრულება',
  SUBTASK_REOPENED: 'საბტასკის ხელახლა გახსნა',
  SUBTASK_DELETED: 'საბტასკის წაშლა',
  STATUS_CHANGED: 'სტატუსის ცვლილება',
  WORK_PAUSED: 'მუშაობის შეჩერება (პაუზა)',
  WORK_RESUMED: 'მუშაობის განახლება',
  DEADLINE_CHANGED: 'დედლაინის ცვლილება',
  SCHEDULE_CHANGED: 'გრაფიკის გადავადება',
  PRIORITY_CHANGED: 'პრიორიტეტის ცვლილება',
  ATTACHMENT_ADDED: 'ფაილის/ბმულის მიმაგრება',
  ATTACHMENT_REMOVED: 'ფაილის წაშლა',
  COMMENT_ADDED: 'კომენტარის დამატება',
  COMMENT_DELETED: 'კომენტარის წაშლა',
  DAILY_UPDATE_ADDED: 'დღიური ანგარიში',
  USER_CREATED: 'მომხმარებლის დამატება',
  USER_STATUS_CHANGED: 'მომხმარებლის სტატუსი',
  CALENDAR_UPDATED: 'კალენდრის განახლება',
}
