import type {
  Task,
  Project,
  User,
  WorkflowStage,
  Subtask,
  Comment,
  DailyUpdate,
  Attachment,
  AuditEvent,
  TaskType,
  TaskStatus,
  Priority,
  Department,
} from '@prisma/client';

export type TaskSummary = Task & {
  project?: Project | null;
  creator?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl' | 'role'> | null;
  assignments?: Array<{
    id: string;
    userId: string;
    user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl' | 'role'>;
  }>;
  stages?: Array<
    WorkflowStage & {
      assignments?: Array<{
        id: string;
        userId: string;
        user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl' | 'role'>;
      }>;
    }
  >;
  subtasks?: Array<Pick<Subtask, 'id' | 'title' | 'status' | 'deadline'>>;
};

export type TaskDetails = Task & {
  project?: Project | null;
  creator?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl' | 'role'> | null;
  assignments: Array<{
    id: string;
    userId: string;
    user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl' | 'role'>;
  }>;
  stages: Array<
    WorkflowStage & {
      assignments: Array<{
        id: string;
        userId: string;
        user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl' | 'role'>;
      }>;
    }
  >;
  subtasks: Array<
    Subtask & {
      completedBy?: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
      assignments: Array<{
        user: Pick<User, 'id' | 'name' | 'avatarUrl'>;
      }>;
    }
  >;
  comments: Array<
    Comment & {
      user: Pick<User, 'id' | 'name' | 'avatarUrl'>;
    }
  >;
  dailyUpdates: Array<
    DailyUpdate & {
      user: Pick<User, 'id' | 'name' | 'avatarUrl'>;
    }
  >;
  attachments: Array<
    Attachment & {
      user: Pick<User, 'id' | 'name' | 'avatarUrl'>;
    }
  >;
  auditEvents: Array<
    AuditEvent & {
      actor?: Pick<User, 'id' | 'name' | 'avatarUrl' | 'role'> | null;
    }
  >;
};

export interface TaskFilterParams {
  projectId?: string;
  status?: TaskStatus;
  priority?: Priority;
  department?: Department;
  assigneeId?: string;
  type?: TaskType;
  search?: string;
}
