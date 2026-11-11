import test from 'node:test'
import assert from 'node:assert'
import { testPrisma } from '../test-db'
import { Role } from '@prisma/client'
import { createProjectDto } from '@/server/dto/project.dto'
import { createProjectAction } from '@/server/actions/projects/create-project.action'
import { updateProjectAction } from '@/server/actions/projects/update-project.action'
import { deleteProjectAction } from '@/server/actions/projects/delete-project.action'
import { listProjectsAction } from '@/server/actions/projects/list-projects.action'
import bcrypt from 'bcryptjs'

test('Actions: Projects Lifecycle & Governance', async (t) => {
  const ts = Date.now()
  const passwordHash = await bcrypt.hash('Password123!', 10)

  const admin = await testPrisma.user.create({
    data: {
      email: `admin_proj_act_${ts}@team.local`,
      name: 'Admin Proj Act',
      role: Role.ADMIN,
      passwordHash,
      isActive: true,
    },
  })

  const member = await testPrisma.user.create({
    data: {
      email: `member_proj_act_${ts}@team.local`,
      name: 'Member Proj Act',
      role: Role.USER,
      passwordHash,
      isActive: true,
    },
  })

  let createdProjectId = ''

  await t.test('createProjectAction: creates a new project', async () => {
    const proj = await createProjectAction(
      {
        name: `Action Project ${ts}`,
        description: 'Test project description',
        color: '#2563EB',
      },
      admin
    )

    assert.ok(proj.id)
    assert.strictEqual(proj.name, `Action Project ${ts}`)
    assert.strictEqual(proj.color, '#2563EB')
    createdProjectId = proj.id
  })

  await t.test('createProjectAction: creates a project with optional/null description', async () => {
    const parsedInput = createProjectDto.parse({
      name: `Action Project Null Desc ${ts}`,
      description: null,
      color: '#EA580C',
    })
    const proj = await createProjectAction(parsedInput, admin)

    assert.ok(proj.id)
    assert.strictEqual(proj.description, null)
  })

  await t.test('listProjectsAction: includes the created project with task metrics', async () => {
    const list = await listProjectsAction()
    const found = list.find((p) => p.id === createdProjectId)
    assert.ok(found)
    assert.strictEqual(found.taskCount, 0)
    assert.strictEqual(found.progress, 0)
  })

  await t.test('updateProjectAction: non-admin cannot update project', async () => {
    await assert.rejects(
      async () => {
        await updateProjectAction(
          createdProjectId,
          { name: 'Hacked Name' },
          member
        )
      },
      /პროექტის რედაქტირების უფლება აქვს მხოლოდ ადმინისტრატორს/
    )
  })

  await t.test('updateProjectAction: admin can update project details', async () => {
    const updated = await updateProjectAction(
      createdProjectId,
      {
        name: `Updated Project ${ts}`,
        color: '#10B981',
      },
      admin
    )

    assert.strictEqual(updated.name, `Updated Project ${ts}`)
    assert.strictEqual(updated.color, '#10B981')
  })

  await t.test('deleteProjectAction: non-admin cannot delete project', async () => {
    await assert.rejects(
      async () => {
        await deleteProjectAction(createdProjectId, member)
      },
      /პროექტის წაშლის უფლება აქვს მხოლოდ ადმინისტრატორს/
    )
  })

  await t.test('deleteProjectAction: admin can delete project', async () => {
    const res = await deleteProjectAction(createdProjectId, admin)
    assert.strictEqual(res.success, true)

    const check = await testPrisma.project.findUnique({ where: { id: createdProjectId } })
    assert.strictEqual(check, null)
  })

  // Cleanup
  await testPrisma.user.deleteMany({ where: { id: { in: [admin.id, member.id] } } })
})

