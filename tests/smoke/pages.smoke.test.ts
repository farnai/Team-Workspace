import test, { before, after, describe, it } from 'node:test'
import assert from 'node:assert'
import { Browser, Page } from 'puppeteer-core'
import { ensureSmokeServer } from './server-manager'
import { createSmokeFixtures, SmokeFixtures } from './smoke-fixtures'
import {
  launchSmokeBrowser,
  attachPreNavErrorCollector,
  setAuthSessionCookie,
  takeFailureScreenshot,
  waitForDomText,
} from './browser-helpers'
import { SMOKE_BASE_URL, smokePrisma } from './smoke-env'

describe('GTU Team Workspace: Automated Browser Smoke Tests', () => {
  let serverStop: (() => Promise<void>) | null = null
  let fixturesCleanup: (() => Promise<void>) | null = null
  let fixtures: SmokeFixtures
  let browser: Browser

  before(async () => {
    // 1. Ensure Next.js test server running with test DB
    const server = await ensureSmokeServer()
    serverStop = server.stop

    // 2. Setup deterministic representative test fixtures
    const fixData = await createSmokeFixtures()
    fixtures = fixData.fixtures
    fixturesCleanup = fixData.cleanup

    // 3. Launch headless browser
    browser = await launchSmokeBrowser()
  })

  after(async () => {
    if (browser) {
      await browser.close().catch(() => {})
    }
    if (fixturesCleanup) {
      await fixturesCleanup()
    }
    if (serverStop) {
      await serverStop()
    }
    await smokePrisma.$disconnect().catch(() => {})
  })

  it('1. Overview Dashboard: loads authenticated with real metrics and tasks', async () => {
    const page = await browser.newPage()
    const collector = attachPreNavErrorCollector(page)

    try {
      await setAuthSessionCookie(page, fixtures.adminUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=overview`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })

      // Must not display error boundary or remain stuck loading
      await page.waitForFunction(
        () => !document.body.innerText.includes('იტვირთება...') || document.body.innerText.includes('საერთო მიმოხილვა'),
        { timeout: 8000 }
      )

      // Verify core overview content & metrics
      await waitForDomText(page, 'საერთო მიმოხილვა (Overview)', 8000)
      await waitForDomText(page, 'აქტიური გუნდი', 8000)
      await waitForDomText(page, 'ვინ რაზე მუშაობს?', 8000)

      // Verify logged-in admin identity appears in header
      await waitForDomText(page, fixtures.adminUser.name, 8000)

      collector.assertClean('Overview Dashboard')
    } catch (err) {
      await takeFailureScreenshot(page, 'overview_failure')
      throw err
    } finally {
      collector.detach()
      await page.close()
    }
  })

  it('2. Backlog & Kanban Board: renders columns, tasks and filters cleanly', async () => {
    const page = await browser.newPage()
    const collector = attachPreNavErrorCollector(page)

    try {
      await setAuthSessionCookie(page, fixtures.adminUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=backlog`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })

      // Must render Kanban columns
      await waitForDomText(page, 'To Do', 8000)
      await waitForDomText(page, 'In Progress', 8000)

      // Representative Task 1 (In Progress)
      await waitForDomText(page, fixtures.taskWithStages.title, 8000)

      // Representative Task 2 (Planned / Todo)
      await waitForDomText(page, fixtures.simpleTask.title, 8000)

      // Representative Task 3 (Backlog / Dateless)
      await waitForDomText(page, fixtures.datelessTask.title, 8000)

      collector.assertClean('Backlog & Kanban Board')
    } catch (err) {
      await takeFailureScreenshot(page, 'backlog_failure')
      throw err
    } finally {
      collector.detach()
      await page.close()
    }
  })

  it('3. TaskDetailsDrawer: opens representative task, renders stages, assignees, subtasks, and closes cleanly', async () => {
    const page = await browser.newPage()
    const collector = attachPreNavErrorCollector(page)

    try {
      await setAuthSessionCookie(page, fixtures.adminUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=backlog`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })

      // Locate and click on the representative task card
      const taskSelector = `[data-testid="kanban-task-${fixtures.taskWithStages.id}"]`
      await page.waitForSelector(taskSelector, { timeout: 8000 })
      await page.click(taskSelector)

      // Wait for TaskDetailsDrawer container
      await page.waitForSelector('[data-testid="task-details-drawer"]', { timeout: 8000 })

      // Verify Drawer Title
      await waitForDomText(page, fixtures.taskWithStages.title, 8000)

      // Verify Active Stage 1 is rendered
      await waitForDomText(page, 'ეტაპი 1: UI/UX დიზაინი', 8000)

      // CRITICAL: Verify assignee name is actually rendered in the DOM (not hidden by empty arrays)
      await waitForDomText(page, fixtures.designerUser.name, 8000)

      // Verify Stage Subtasks are rendered
      await waitForDomText(page, 'Figma მაკეტის მომზადება', 8000)
      await waitForDomText(page, 'დიზაინ სისტემის შეთანხმება', 8000)

      // Verify Direct Subtask is rendered
      await waitForDomText(page, 'API დოკუმენტაციის მომზადება', 8000)

      // Close the drawer
      const closeBtn = await page.$('[data-testid="close-task-drawer"]')
      assert.ok(closeBtn, 'Close button must exist on TaskDetailsDrawer')
      await closeBtn.click()

      // Confirm drawer closes and page remains functional
      await page.waitForFunction(
        () => !document.querySelector('[data-testid="task-details-drawer"]'),
        { timeout: 8000 }
      )

      collector.assertClean('TaskDetailsDrawer')
    } catch (err) {
      await takeFailureScreenshot(page, 'task_drawer_failure')
      throw err
    } finally {
      collector.detach()
      await page.close()
    }
  })

  it('4. Timeline: renders schedule view and strictly excludes dateless tasks', async () => {
    const page = await browser.newPage()
    const collector = attachPreNavErrorCollector(page)

    try {
      await setAuthSessionCookie(page, fixtures.adminUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=timeline`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })

      // Scheduled task with dates MUST appear
      await waitForDomText(page, fixtures.taskWithStages.title, 8000)

      // Dateless task MUST NOT appear on schedule timeline
      const domText = await page.evaluate(() => document.body.innerText)
      assert.strictEqual(
        domText.includes(fixtures.datelessTask.title),
        false,
        'Dateless task must NOT be projected onto schedule timeline'
      )

      collector.assertClean('Timeline View')
    } catch (err) {
      await takeFailureScreenshot(page, 'timeline_failure')
      throw err
    } finally {
      collector.detach()
      await page.close()
    }
  })

  it('5. Projects View: displays projects list and metrics', async () => {
    const page = await browser.newPage()
    const collector = attachPreNavErrorCollector(page)

    try {
      await setAuthSessionCookie(page, fixtures.adminUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=projects`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })

      // Verify smoke test project name is rendered
      await waitForDomText(page, fixtures.project.name, 8000)

      collector.assertClean('Projects View')
    } catch (err) {
      await takeFailureScreenshot(page, 'projects_failure')
      throw err
    } finally {
      collector.detach()
      await page.close()
    }
  })

  it('6. My Work View: displays user-specific assigned active tasks', async () => {
    const page = await browser.newPage()
    const collector = attachPreNavErrorCollector(page)

    try {
      // Authenticated as Mariam Designer
      await setAuthSessionCookie(page, fixtures.designerUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=my-work`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })

      // Mariam is assigned to active Stage 1 of taskWithStages -> must appear
      await waitForDomText(page, fixtures.taskWithStages.title, 8000)

      collector.assertClean('My Work View')
    } catch (err) {
      await takeFailureScreenshot(page, 'my_work_failure')
      throw err
    } finally {
      collector.detach()
      await page.close()
    }
  })

  it('7. Workload Dashboard: renders team member assignment grid', async () => {
    const page = await browser.newPage()
    const collector = attachPreNavErrorCollector(page)

    try {
      await setAuthSessionCookie(page, fixtures.adminUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=workload`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })

      // Verify team members appear in workload
      await waitForDomText(page, fixtures.designerUser.name, 8000)

      collector.assertClean('Workload Dashboard')
    } catch (err) {
      await takeFailureScreenshot(page, 'workload_failure')
      throw err
    } finally {
      collector.detach()
      await page.close()
    }
  })

  it('8. Archive View: displays completed and archived tasks', async () => {
    const page = await browser.newPage()
    const collector = attachPreNavErrorCollector(page)

    try {
      await setAuthSessionCookie(page, fixtures.adminUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=archive`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })

      // Must show completed archive task
      await waitForDomText(page, fixtures.archivedTask.title, 8000)

      collector.assertClean('Archive View')
    } catch (err) {
      await takeFailureScreenshot(page, 'archive_failure')
      throw err
    } finally {
      collector.detach()
      await page.close()
    }
  })

  it('9. Reports Dashboard: renders analytics and productivity statistics', async () => {
    const page = await browser.newPage()
    const collector = attachPreNavErrorCollector(page)

    try {
      await setAuthSessionCookie(page, fixtures.adminUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=reports`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })

      // Verify reports page content loaded
      await waitForDomText(page, 'პროდუქტიულობა', 8000)

      collector.assertClean('Reports Dashboard')
    } catch (err) {
      await takeFailureScreenshot(page, 'reports_failure')
      throw err
    } finally {
      collector.detach()
      await page.close()
    }
  })

  it('10. Permissions & User Management: Admin manages users, Regular user is restricted', async () => {
    const page = await browser.newPage()
    const collector = attachPreNavErrorCollector(page)

    try {
      // 1. As Admin: can access Users view
      await setAuthSessionCookie(page, fixtures.adminUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=users`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })

      await waitForDomText(page, fixtures.adminUser.name, 8000)
      await waitForDomText(page, fixtures.designerUser.name, 8000)
      collector.assertClean('Admin Users Management')

      // 2. As Regular User: sidebar does not show admin-only Users link
      collector.reset()
      await setAuthSessionCookie(page, fixtures.designerUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=overview`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })

      const hasAdminLink = await page.evaluate(() => {
        return Boolean(document.querySelector('button[aria-label="მომხმარებლები"]'))
      })
      assert.strictEqual(hasAdminLink, false, 'Regular user sidebar must not display Admin Users navigation')

      collector.assertClean('Regular User Navigation')
    } catch (err) {
      await takeFailureScreenshot(page, 'permissions_failure')
      throw err
    } finally {
      collector.detach()
      await page.close()
    }
  })

  it('11. Quality Control (QA View): renders dedicated QA board without console or runtime errors', async () => {
    const page = await browser.newPage()
    const collector = attachPreNavErrorCollector(page)

    try {
      await setAuthSessionCookie(page, fixtures.adminUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=qa`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })

      // Verify QA board title and new QA test button
      await waitForDomText(page, 'ხარისხის კონტროლი', 8000)
      await waitForDomText(page, 'ახალი QA შემოწმება', 8000)

      collector.assertClean('Quality Control QA View')
    } catch (err) {
      await takeFailureScreenshot(page, 'qa_view_failure')
      throw err
    } finally {
      collector.detach()
      await page.close()
    }
  })
})
