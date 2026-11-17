import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { Role, TaskType, Priority, TaskStatus, Department, SubtaskStatus } from '@prisma/client'
import { smokePrisma } from './smoke-env'

export interface SmokeFixtures {
  runId: string
  adminUser: { id: string; name: string; email: string; token: string }
  designerUser: { id: string; name: string; email: string; token: string }
  leadDevUser: { id: string; name: string; email: string }
  project: { id: string; name: string }
  taskWithStages: { id: string; title: string; taskNumber: number }
  simpleTask: { id: string; title: string; taskNumber: number }
  datelessTask: { id: string; title: string; taskNumber: number }
  archivedTask: { id: string; title: string; taskNumber: number }
}

export async function createSmokeFixtures(): Promise<{
  fixtures: SmokeFixtures
  cleanup: () => Promise<void>
}> {
  const ts = Date.now()
  const runId = `smoke_${ts}_${crypto.randomBytes(4).toString('hex')}`
  const passwordHash = await bcrypt.hash('SmokeSecret123!', 10)

  const createdUserIds: string[] = []
  const createdProjectIds: string[] = []
  const createdTaskIds: string[] = []

  // 1. Users
  const admin = await smokePrisma.user.create({
    data: {
      email: `${runId}_admin@team.local`,
      name: `გიორგი ადმინი (${ts})`,
      role: Role.ADMIN,
      department: Department.DEVELOPMENT,
      passwordHash,
      isActive: true,
    },
  })
  createdUserIds.push(admin.id)

  const designer = await smokePrisma.user.create({
    data: {
      email: `${runId}_designer@team.local`,
      name: `მარიამ დიზაინერი (${ts})`,
      role: Role.USER,
      department: Department.DEVELOPMENT,
      passwordHash,
      isActive: true,
    },
  })
  createdUserIds.push(designer.id)

  const leadDev = await smokePrisma.user.create({
    data: {
      email: `${runId}_dev@team.local`,
      name: `დავით დეველოპერი (${ts})`,
      role: Role.USER,
      department: Department.DEVELOPMENT,
      passwordHash,
      isActive: true,
    },
  })
  createdUserIds.push(leadDev.id)

  // 2. Sessions (valid for 30 days)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const adminToken = `tw_admin_${crypto.randomBytes(24).toString('hex')}`
  const designerToken = `tw_user_${crypto.randomBytes(24).toString('hex')}`

  await smokePrisma.session.createMany({
    data: [
      { userId: admin.id, token: adminToken, expiresAt },
      { userId: designer.id, token: designerToken, expiresAt },
    ],
  })

  // 3. Project
  const project = await smokePrisma.project.create({
    data: {
      name: `პლატფორმის მოდული [${runId}]`,
      description: 'სატესტო პროექტი ბრაუზერის smoke ტესტებისთვის',
      color: '#EA580C',
    },
  })
  createdProjectIds.push(project.id)

  // Dates
  const today = new Date()
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0)
  const deadlineDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7, 18, 0, 0)

  // 4. Representative Task 1: Stages + Multi-Assignees + Stage Subtasks + Direct Subtasks
  const task1 = await smokePrisma.task.create({
    data: {
      projectId: project.id,
      title: `[SMOKE] ავთენტიფიკაციის სრული მოდული (${ts})`,
      description: 'სრული ფუნქციონალი ეტაპებითა და საბტასკებით',
      type: TaskType.FEATURE,
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      department: Department.DEVELOPMENT,
      startDate,
      deadline: deadlineDate,
      progress: 35,
      createdById: admin.id,
      assignments: {
        create: [{ userId: designer.id }, { userId: leadDev.id }],
      },
    },
  })
  createdTaskIds.push(task1.id)

  // Stage 1 (Active, assigned to Mariam Designer)
  const stage1 = await smokePrisma.workflowStage.create({
    data: {
      taskId: task1.id,
      position: 0,
      title: 'ეტაპი 1: UI/UX დიზაინი',
      isActive: true,
      isCompleted: false,
      deadline: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 18, 0, 0),
      assignments: {
        create: [{ userId: designer.id }],
      },
    },
  })

  // Stage 1 Subtasks
  await smokePrisma.subtask.create({
    data: {
      taskId: task1.id,
      stageId: stage1.id,
      position: 0,
      title: 'Figma მაკეტის მომზადება',
      status: SubtaskStatus.DONE,
      completedById: designer.id,
      completedAt: new Date(),
      assignments: {
        create: [{ userId: designer.id }],
      },
    },
  })

  await smokePrisma.subtask.create({
    data: {
      taskId: task1.id,
      stageId: stage1.id,
      position: 1,
      title: 'დიზაინ სისტემის შეთანხმება',
      status: SubtaskStatus.TODO,
      deadline: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 18, 0, 0),
      assignments: {
        create: [{ userId: designer.id }],
      },
    },
  })

  // Stage 2 (Waiting, assigned to David Dev)
  await smokePrisma.workflowStage.create({
    data: {
      taskId: task1.id,
      position: 1,
      title: 'ეტაპი 2: Frontend იმპლემენტაცია',
      isActive: false,
      isCompleted: false,
      deadline: deadlineDate,
      assignments: {
        create: [{ userId: leadDev.id }],
      },
    },
  })

  // Direct Subtask (stageId: null)
  await smokePrisma.subtask.create({
    data: {
      taskId: task1.id,
      stageId: null,
      position: 0,
      title: 'API დოკუმენტაციის მომზადება',
      status: SubtaskStatus.TODO,
      assignments: {
        create: [{ userId: leadDev.id }],
      },
    },
  })

  // 5. Representative Task 2: Task without subtasks
  const task2 = await smokePrisma.task.create({
    data: {
      projectId: project.id,
      title: `[SMOKE] მარტივი დავალება საბტასკების გარეშე (${ts})`,
      type: TaskType.FEATURE,
      priority: Priority.MEDIUM,
      status: TaskStatus.PLANNED,
      department: Department.DEVELOPMENT,
      startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
      deadline: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4),
      createdById: admin.id,
      assignments: {
        create: [{ userId: leadDev.id }],
      },
    },
  })
  createdTaskIds.push(task2.id)

  // 6. Representative Task 3: Dateless Task (No deadline / no startDate)
  const task3 = await smokePrisma.task.create({
    data: {
      projectId: project.id,
      title: `[SMOKE] იდეების განხილვა ვადის გარეშე (${ts})`,
      type: TaskType.FEATURE,
      priority: Priority.LOW,
      status: TaskStatus.BACKLOG,
      department: Department.DEVELOPMENT,
      startDate: null,
      deadline: null,
      createdById: admin.id,
      assignments: {
        create: [{ userId: designer.id }],
      },
    },
  })
  createdTaskIds.push(task3.id)

  // 7. Representative Task 4: Completed Task for Archive
  const task4 = await smokePrisma.task.create({
    data: {
      projectId: project.id,
      title: `[SMOKE] არქივირებული დავალება (${ts})`,
      type: TaskType.BUG,
      priority: Priority.MEDIUM,
      status: TaskStatus.DONE,
      department: Department.DEVELOPMENT,
      completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      createdById: admin.id,
      assignments: {
        create: [{ userId: designer.id }],
      },
    },
  })
  createdTaskIds.push(task4.id)

  const fixtures: SmokeFixtures = {
    runId,
    adminUser: { id: admin.id, name: admin.name, email: admin.email, token: adminToken },
    designerUser: { id: designer.id, name: designer.name, email: designer.email, token: designerToken },
    leadDevUser: { id: leadDev.id, name: leadDev.name, email: leadDev.email },
    project: { id: project.id, name: project.name },
    taskWithStages: { id: task1.id, title: task1.title, taskNumber: task1.taskNumber },
    simpleTask: { id: task2.id, title: task2.title, taskNumber: task2.taskNumber },
    datelessTask: { id: task3.id, title: task3.title, taskNumber: task3.taskNumber },
    archivedTask: { id: task4.id, title: task4.title, taskNumber: task4.taskNumber },
  }

  const cleanup = async () => {
    try {
      if (createdTaskIds.length > 0) {
        await smokePrisma.task.deleteMany({ where: { id: { in: createdTaskIds } } })
      }
      if (createdProjectIds.length > 0) {
        await smokePrisma.project.deleteMany({ where: { id: { in: createdProjectIds } } })
      }
      if (createdUserIds.length > 0) {
        await smokePrisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
      }
    } catch (err) {
      console.error('Smoke fixtures cleanup warning:', err)
    }
  }

  return { fixtures, cleanup }
}

