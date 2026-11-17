import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testPrisma } from '../test-db';
import { updateUserAction } from '@/server/actions/admin-users/update-user.action';
import { deleteUserAction } from '@/server/actions/admin-users/delete-user.action';
import { userRepository } from '@/server/repositories/user.repository';
import {
  Role,
  Department,
  TaskType,
  Priority,
  TaskStatus,
  SubtaskStatus,
  AuditAction,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

test('User Deactivation & Deletion Governance: Unassign from active tasks, clear active deadlines, and preserve archive history', async () => {
  const ts = Date.now();
  const passwordHash = await bcrypt.hash('TestPass123!', 10);

  // 1. Create admin and member
  const admin = await testPrisma.user.create({
    data: {
      email: `admin_${ts}@team.local`,
      name: 'Super Admin',
      role: Role.ADMIN,
      department: Department.DEVELOPMENT,
      passwordHash,
      isActive: true,
    },
  });

  const member = await testPrisma.user.create({
    data: {
      email: `member_${ts}@team.local`,
      name: 'გიორგი დეველოპერი',
      role: Role.USER,
      department: Department.DEVELOPMENT,
      passwordHash,
      isActive: true,
    },
  });

  const project = await testPrisma.project.create({
    data: {
      name: `Project ${ts}`,
      color: '#EA580C',
    },
  });

  // 2. Create an ACTIVE task assigned to member with a deadline, active stage, and active subtask
  const activeTask = await testPrisma.task.create({
    data: {
      title: 'Active Task Assigned to Member',
      type: TaskType.FEATURE,
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      projectId: project.id,
      createdById: admin.id,
      startDate: new Date(),
      deadline: new Date(Date.now() + 86400000 * 5),
      deadlineLocked: true,
      assignments: {
        create: { userId: member.id },
      },
      stages: {
        create: {
          title: 'Active Design Stage',
          position: 0,
          isActive: true,
          isCompleted: false,
          deadline: new Date(Date.now() + 86400000 * 2),
          deadlineLocked: true,
          assignments: {
            create: { userId: member.id },
          },
        },
      },
      subtasks: {
        create: {
          title: 'Active Frontend Subtask',
          position: 0,
          status: SubtaskStatus.TODO,
          deadline: new Date(Date.now() + 86400000 * 2),
          deadlineLocked: true,
          assignments: {
            create: { userId: member.id },
          },
        },
      },
    },
    include: {
      assignments: true,
      stages: { include: { assignments: true } },
      subtasks: { include: { assignments: true } },
    },
  });

  // 3. Create a COMPLETED / ARCHIVED task with completed subtask
  const archivedTask = await testPrisma.task.create({
    data: {
      title: 'Archived Completed Task by Member',
      type: TaskType.FEATURE,
      priority: Priority.MEDIUM,
      status: TaskStatus.DONE,
      projectId: project.id,
      createdById: admin.id,
      startDate: new Date(Date.now() - 86400000 * 10),
      deadline: new Date(Date.now() - 86400000 * 2),
      completedAt: new Date(),
      assignments: {
        create: { userId: member.id },
      },
      subtasks: {
        create: {
          title: 'Completed Subtask in Archive',
          position: 0,
          status: SubtaskStatus.DONE,
          completedById: member.id,
          completedAt: new Date(),
          assignments: {
            create: { userId: member.id },
          },
        },
      },
    },
    include: {
      assignments: true,
      subtasks: true,
    },
  });

  // Sanity check initial state
  assert.strictEqual(activeTask.assignments.length, 1);
  assert.strictEqual(activeTask.stages[0].assignments.length, 1);
  assert.strictEqual(activeTask.subtasks[0].assignments.length, 1);
  assert.ok(activeTask.deadline);
  assert.ok(activeTask.stages[0].deadline);
  assert.ok(activeTask.subtasks[0].deadline);

  // 4. TEST DEACTIVATION: Deactivate member
  await updateUserAction(member.id, { isActive: false }, admin);

  // Verify member is now inactive
  const deactivatedMember = await testPrisma.user.findUnique({
    where: { id: member.id },
  });
  assert.strictEqual(deactivatedMember?.isActive, false);

  // Verify active task was unassigned and its deadlines cleared
  const updatedActiveTask = await testPrisma.task.findUnique({
    where: { id: activeTask.id },
    include: {
      assignments: true,
      stages: { include: { assignments: true } },
      subtasks: { include: { assignments: true } },
    },
  });

  assert.strictEqual(updatedActiveTask?.assignments.length, 0, 'Active task assignment should be cleared');
  assert.strictEqual(updatedActiveTask?.deadline, null, 'Active task deadline should be reset to null');
  assert.strictEqual(updatedActiveTask?.startDate, null, 'Active task startDate should be reset to null');

  assert.strictEqual(updatedActiveTask?.stages[0].assignments.length, 0, 'Active stage assignment should be cleared');
  assert.strictEqual(updatedActiveTask?.stages[0].deadline, null, 'Active stage deadline should be reset to null');

  assert.strictEqual(updatedActiveTask?.subtasks[0].assignments.length, 0, 'Active subtask assignment should be cleared');
  assert.strictEqual(updatedActiveTask?.subtasks[0].deadline, null, 'Active subtask deadline should be reset to null');

  // Verify ARCHIVED / COMPLETED task is 100% PRESERVED
  const preservedArchivedTask = await testPrisma.task.findUnique({
    where: { id: archivedTask.id },
    include: {
      assignments: { include: { user: true } },
      subtasks: { include: { completedBy: true } },
    },
  });

  assert.strictEqual(preservedArchivedTask?.assignments.length, 1, 'Archived task assignment must be kept');
  assert.strictEqual(preservedArchivedTask?.assignments[0].user.name, 'გიორგი დეველოპერი');
  assert.ok(preservedArchivedTask?.deadline, 'Archived task deadline must be kept');
  assert.strictEqual(preservedArchivedTask?.subtasks[0].completedBy?.name, 'გიორგი დეველოპერი');

  // 5. TEST DELETION: Create another member and delete them
  const memberToDelete = await testPrisma.user.create({
    data: {
      email: `delete_me_${ts}@team.local`,
      name: 'დავით წასაშლელი',
      role: Role.USER,
      department: Department.CONTENT,
      passwordHash,
      isActive: true,
    },
  });

  const taskForDelete = await testPrisma.task.create({
    data: {
      title: 'Task for member about to be deleted',
      type: TaskType.FEATURE,
      priority: Priority.MEDIUM,
      status: TaskStatus.PLANNED,
      projectId: project.id,
      createdById: admin.id,
      deadline: new Date(Date.now() + 86400000 * 3),
      assignments: {
        create: { userId: memberToDelete.id },
      },
    },
  });

  // Admin cannot delete self
  await assert.rejects(
    async () => {
      await deleteUserAction(admin.id, admin);
    },
    { message: /საკუთარი ადმინისტრატორის ანგარიშის წაშლა შეუძლებელია/ }
  );

  // Delete member
  const deleteResult = await deleteUserAction(memberToDelete.id, admin);
  assert.strictEqual(deleteResult.success, true);

  // Verify memberToDelete is marked isDeleted: true
  const deletedUserRecord = await testPrisma.user.findUnique({
    where: { id: memberToDelete.id },
  });
  assert.strictEqual(deletedUserRecord?.isDeleted, true);
  assert.strictEqual(deletedUserRecord?.isActive, false);
  assert.ok(deletedUserRecord?.deletedAt);

  // Verify taskForDelete had member unassigned and deadline cleared
  const taskAfterDelete = await testPrisma.task.findUnique({
    where: { id: taskForDelete.id },
    include: { assignments: true },
  });
  assert.strictEqual(taskAfterDelete?.assignments.length, 0);
  assert.strictEqual(taskAfterDelete?.deadline, null);

  // Verify deleted user does NOT appear in active users list or admin users list
  const allActiveUsers = await userRepository.findAllActiveUsers(testPrisma);
  assert.ok(!allActiveUsers.some((u) => u.id === memberToDelete.id));

  const allAdminTableUsers = await userRepository.findAllAdminUsers(testPrisma);
  assert.ok(!allAdminTableUsers.some((u) => u.id === memberToDelete.id));

  // Verify audit event was logged
  const auditLogs = await testPrisma.auditEvent.findMany({
    where: { entityId: memberToDelete.id, action: AuditAction.USER_DELETED },
  });
  assert.strictEqual(auditLogs.length, 1);
  assert.strictEqual(auditLogs[0].actorId, admin.id);
});
