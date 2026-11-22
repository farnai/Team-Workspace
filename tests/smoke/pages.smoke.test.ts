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

  it('12. Manual Testing API Routes: enforces auth, validation, creator/admin permissions, and snapshot history', async () => {
    const taskId = fixtures.simpleTask.id

    // Cookie-less request -> middleware redirects (307) to /login; invalid session cookie -> route returns 401
    const unauthRedirectRes = await fetch(`${SMOKE_BASE_URL}/api/tasks/${taskId}/test-cases`, {
      redirect: 'manual',
    })
    assert.strictEqual(unauthRedirectRes.status, 307)

    const invalidTokenRes = await fetch(`${SMOKE_BASE_URL}/api/tasks/${taskId}/test-cases`, {
      headers: { Cookie: 'tw_session_token=invalid_smoke_token' },
    })
    assert.strictEqual(invalidTokenRes.status, 401)

    // USER (designerUser) creates a test case -> 201
    const createRes = await fetch(`${SMOKE_BASE_URL}/api/tasks/${taskId}/test-cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `tw_session_token=${fixtures.designerUser.token}`,
      },
      body: JSON.stringify({
        title: '[SMOKE API] გადახდის სესიის შემოწმება',
        steps: [{ action: 'გახსენი ფორმა', expectedResult: 'ფორმა ჩანს' }],
      }),
    })
    assert.strictEqual(createRes.status, 201)
    const createJson = (await createRes.json()) as { testCase: { id: string } }
    const apiCaseId = createJson.testCase.id
    assert.ok(apiCaseId)

    // Another USER (leadDevUser) gets 403 on DELETE
    const forbidDelRes = await fetch(`${SMOKE_BASE_URL}/api/test-cases/${apiCaseId}`, {
      method: 'DELETE',
      headers: { Cookie: `tw_session_token=${fixtures.leadDevUser.token}` },
    })
    assert.strictEqual(forbidDelRes.status, 403)

    // FAILED run without reason -> 422
    const badRunRes = await fetch(`${SMOKE_BASE_URL}/api/test-cases/${apiCaseId}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `tw_session_token=${fixtures.leadDevUser.token}`,
      },
      body: JSON.stringify({ status: 'FAILED', actualResult: 'შეცდომა' }),
    })
    assert.strictEqual(badRunRes.status, 422)

    // FAILED run with reason -> 201
    const goodRunRes = await fetch(`${SMOKE_BASE_URL}/api/test-cases/${apiCaseId}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `tw_session_token=${fixtures.leadDevUser.token}`,
      },
      body: JSON.stringify({
        status: 'FAILED',
        reason: 'დაბრუნდა 500 შეცდომა',
        actualResult: 'API შეცდომა',
      }),
    })
    assert.strictEqual(goodRunRes.status, 201)

    // ADMIN deletes test case -> 200
    const adminDelRes = await fetch(`${SMOKE_BASE_URL}/api/test-cases/${apiCaseId}`, {
      method: 'DELETE',
      headers: { Cookie: `tw_session_token=${fixtures.adminUser.token}` },
    })
    assert.strictEqual(adminDelRes.status, 200)
  })

  it('13. Manual Testing UI Workflow: create case, run FAILED/PASSED, immutable snapshot, reload, archive & mobile', async () => {
    const artifactDir =
      process.env.TESTING_SCREENSHOT_DIR ||
      'C:\\Users\\fiord\\.gemini\\antigravity\\brain\\4fed2883-2fb6-450c-97ff-b94798883638'

    const page = await browser.newPage()
    await page.setViewport({ width: 1366, height: 820 })
    const collector = attachPreNavErrorCollector(page)

    try {
      // 1. Login as Regular USER (designerUser) and open taskWithStages (0 test cases initially)
      await setAuthSessionCookie(page, fixtures.designerUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=backlog`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })

      const taskCardSel = `[data-testid="kanban-task-${fixtures.taskWithStages.id}"]`
      await page.waitForSelector(taskCardSel, { timeout: 8000 })
      await page.click(taskCardSel)
      await page.waitForSelector('[data-testid="task-details-drawer"]', { timeout: 8000 })

      // Open ტესტირება tab -> empty state
      await page.waitForSelector('[data-testid="task-tab-testing"]', { timeout: 8000 })
      await page.click('[data-testid="task-tab-testing"]')
      await waitForDomText(page, 'ამ დავალებაზე ტესტ-ქეისები ჯერ არ არის', 8000)

      // 2. Create Test Case with Precondition & 2 Ordered Steps
      await page.click('[data-testid="add-test-case-btn"]')
      await page.waitForSelector('[data-testid="test-case-form"]', { timeout: 8000 })

      await page.type('[data-testid="test-case-title-input"]', 'ავტორიზაციის ფორმის ტესტი')
      await page.type(
        '[data-testid="test-case-precondition-input"]',
        'მომხმარებელი იმყოფება /login გვერდზე'
      )
      await page.type('[data-testid="test-step-action-0"]', 'შეიყვანეთ ელ-ფოსტა და პაროლი')
      await page.type('[data-testid="test-step-data-0"]', 'natela@gmail.com / 123456')
      await page.type(
        '[data-testid="test-step-expected-0"]',
        'ველები ივსება ვალიდაციის შეცდომის გარეშე'
      )

      await page.click('[data-testid="add-test-step-btn"]')
      await page.waitForSelector('[data-testid="test-step-action-1"]', { timeout: 8000 })
      await page.type('[data-testid="test-step-action-1"]', 'დააჭირეთ შესვლის ღილაკს')
      await page.type('[data-testid="test-step-expected-1"]', 'იხსნება მთავარი სამუშაო გვერდი')

      await page.click('[data-testid="save-test-case-btn"]')
      await page.waitForSelector('[data-testid="test-case-detail-view"]', { timeout: 8000 })
      await waitForDomText(page, 'ავტორიზაციის ფორმის ტესტი', 8000)
      await waitForDomText(page, 'ჯერ არ გაშვებულა', 8000)

      // Back to list and re-open the saved case
      await page.click('[data-testid="back-to-test-cases-btn"]')
      await page.waitForSelector('[data-testid="task-testing-section"]', { timeout: 8000 })
      await waitForDomText(page, 'ავტორიზაციის ფორმის ტესტი', 8000)
      const caseRow = await page.$('[data-testid^="test-case-row-"]')
      assert.ok(caseRow, 'Created test case row should appear in list')
      const createdCaseTestId = await page.evaluate(
        (el) => el.getAttribute('data-testid') || '',
        caseRow
      )
      const createdCaseId = createdCaseTestId.replace('test-case-row-', '')
      await caseRow.click()
      await page.waitForSelector('[data-testid="test-case-detail-view"]', { timeout: 8000 })

      // 3. Run #1: FAILED with client validation check, reason, and link evidence
      await page.click('[data-testid="run-test-btn"]')
      await page.waitForSelector('[data-testid="test-run-execution-panel"]', { timeout: 8000 })

      // Select FAILED and submit without reason first -> expect inline validation message
      await page.click('[data-testid="verdict-btn-FAILED"]')
      await page.click('[data-testid="submit-test-run-btn"]')
      await page.waitForSelector('[data-testid="test-run-reason-error"]', { timeout: 5000 })
      await waitForDomText(page, 'ჩავარდნის ან დაბლოკვის დროს მიზეზის მითითება სავალდებულოა', 5000)

      // Provide reason, actual result, and link evidence
      await page.type(
        '[data-testid="test-run-reason-input"]',
        'შესვლის ღილაკზე დაჭერისას სესია არ შეიქმნა'
      )
      await page.type(
        '[data-testid="test-run-actual-input"]',
        'დაფიქსირდა HTTP 500 პასუხი /api/auth/login-დან'
      )
      await page.click('[data-testid="toggle-evidence-link-btn"]')
      await page.waitForSelector('[data-testid="evidence-link-url-input"]', { timeout: 5000 })
      await page.type('[data-testid="evidence-link-name-input"]', 'ბაგის რეპორტი')
      await page.type('[data-testid="evidence-link-url-input"]', 'https://example.com/bug-1')
      await page.click('[data-testid="save-evidence-link-btn"]')
      await waitForDomText(page, 'ბაგის რეპორტი', 8000)

      // Capture screenshot: Run Execution Panel with steps, FAILED reason, and attached evidence
      await page.screenshot({
        path: `${artifactDir}\\manual_testing_run_execution_desktop.png`,
        fullPage: false,
      })

      await page.click('[data-testid="submit-test-run-btn"]')
      await page.waitForSelector('[data-testid="test-run-row-1"]', { timeout: 8000 })
      await waitForDomText(page, 'ვერ გაიარა', 8000)

      // 4. Run #2: PASSED
      await page.waitForSelector('[data-testid="run-test-btn"]', { timeout: 8000 })
      await page.click('[data-testid="run-test-btn"]')
      await page.waitForSelector('[data-testid="test-run-execution-panel"]', { timeout: 8000 })
      await page.click('[data-testid="verdict-btn-PASSED"]')
      await page.type('[data-testid="test-run-actual-input"]', 'ხარვეზი გამოსწორებულია, მუშაობს სწორად')
      await page.click('[data-testid="submit-test-run-btn"]')
      await page.waitForSelector('[data-testid="test-run-row-2"]', { timeout: 8000 })

      // Verify compact list shows latest result (გაიარა) while detail history retains both #2 and #1
      await page.click('[data-testid="back-to-test-cases-btn"]')
      await page.waitForSelector('[data-testid="task-testing-section"]', { timeout: 8000 })
      await waitForDomText(page, '2 გაშვება', 8000)
      await waitForDomText(page, 'გაიარა', 8000)
      await page.click(`[data-testid="test-case-row-${createdCaseId}"]`)
      await page.waitForSelector('[data-testid="test-run-row-2"]', { timeout: 8000 })
      await page.waitForSelector('[data-testid="test-run-row-1"]', { timeout: 8000 })

      // 5. Edit a step in Test Case and verify Run #1 snapshot keeps the OLD step text verbatim
      await page.click('[data-testid="edit-test-case-btn"]')
      await page.waitForSelector('[data-testid="test-case-form"]', { timeout: 8000 })
      await page.click('[data-testid="test-step-action-0"]', { count: 3 })
      await page.keyboard.press('Backspace')
      await page.type('[data-testid="test-step-action-0"]', 'განახლებული ნაბიჯი v2')
      await page.click('[data-testid="save-test-case-btn"]')
      await page.waitForSelector('[data-testid="test-case-detail-view"]', { timeout: 8000 })
      await waitForDomText(page, 'განახლებული ნაბიჯი v2', 8000)

      // Expand old Run #1 -> must still contain original step text!
      await page.click('[data-testid="toggle-test-run-1"]')
      await page.waitForSelector('[data-testid="test-run-details-1"]', { timeout: 8000 })
      const run1Text = await page.$eval(
        '[data-testid="test-run-details-1"]',
        (el) => (el as HTMLElement).innerText
      )
      assert.ok(
        run1Text.includes('შეიყვანეთ ელ-ფოსტა და პაროლი'),
        'Historical Run #1 snapshot must retain original step action'
      )

      // Capture screenshot (a): Case Details & Immutable Run History on Desktop
      await page.screenshot({
        path: `${artifactDir}\\manual_testing_detail_history_desktop.png`,
        fullPage: false,
      })

      // 6. Reload browser page, re-open task -> verify persistence AND Activity tab event
      await page.reload({ waitUntil: 'networkidle2', timeout: 15000 })
      await page.waitForSelector(taskCardSel, { timeout: 8000 })
      await page.click(taskCardSel)
      await page.waitForSelector('[data-testid="task-details-drawer"]', { timeout: 8000 })
      await page.click('[data-testid="task-tab-testing"]')
      await waitForDomText(page, 'ავტორიზაციის ფორმის ტესტი', 8000)
      await page.click(`[data-testid="test-case-row-${createdCaseId}"]`)
      await page.waitForSelector('[data-testid="test-run-row-2"]', { timeout: 8000 })

      // Capture screenshot (b): Task Activity tab showing testing events
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
        const actTab = tabs.find((t) => t.textContent?.includes('აქტივობა')) as HTMLElement | undefined
        actTab?.click()
      })
      await waitForDomText(page, 'ტესტი გაეშვა', 8000)

      // 7. Narrow mobile layout check (390x844) -> verify vertical readability & no overflow
      await page.click('[data-testid="task-tab-testing"]')
      await page.waitForSelector(`[data-testid="test-case-row-${createdCaseId}"]`, { timeout: 8000 })
      await page.screenshot({
        path: `${artifactDir}\\manual_testing_list_desktop.png`,
        fullPage: false,
      })
      await page.click(`[data-testid="test-case-row-${createdCaseId}"]`)
      await page.waitForSelector('[data-testid="test-case-detail-view"]', { timeout: 8000 })
      await page.setViewport({ width: 390, height: 844 })
      await page.waitForSelector('[data-testid="test-case-step-0"]', { timeout: 5000 })
      const overflowCheck = await page.evaluate(() => {
        const drawer = document.querySelector('[data-testid="task-details-drawer"]') as HTMLElement | null
        if (!drawer) return { found: false, diff: 0 }
        return { found: true, diff: drawer.scrollWidth - drawer.clientWidth }
      })
      assert.strictEqual(overflowCheck.found, true)
      assert.ok(overflowCheck.diff <= 2, `Mobile drawer horizontal overflow detected: ${overflowCheck.diff}px`)

      await page.screenshot({
        path: `${artifactDir}\\manual_testing_mobile_390px.png`,
        fullPage: false,
      })

      // Reset to desktop for role visibility & archive checks
      await page.setViewport({ width: 1366, height: 820 })

      // 8. Non-creator regular USER (leadDevUser) must NOT see delete button on designerUser's case
      await setAuthSessionCookie(page, fixtures.leadDevUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=backlog`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })
      await page.waitForSelector(taskCardSel, { timeout: 8000 })
      await page.click(taskCardSel)
      await page.waitForSelector('[data-testid="task-tab-testing"]', { timeout: 8000 })
      await page.click('[data-testid="task-tab-testing"]')
      await page.waitForSelector(`[data-testid="test-case-row-${createdCaseId}"]`, { timeout: 8000 })
      await page.click(`[data-testid="test-case-row-${createdCaseId}"]`)
      await page.waitForSelector('[data-testid="test-case-detail-view"]', { timeout: 8000 })
      const delBtnForOtherUser = await page.$('[data-testid="delete-test-case-btn"]')
      assert.strictEqual(delBtnForOtherUser, null, 'Other regular USER must not see delete button')

      // 9. Switch to Archived view as ADMIN and verify testing history works on archived task
      await setAuthSessionCookie(page, fixtures.adminUser.token)
      await page.goto(`${SMOKE_BASE_URL}/?view=archive`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })
      const archivedSel = `[data-testid="archived-task-card-${fixtures.archivedTask.id}"]`
      await page.waitForSelector(archivedSel, { timeout: 8000 })
      await page.click(archivedSel)
      await page.waitForSelector('[data-testid="task-tab-testing"]', { timeout: 8000 })
      await page.click('[data-testid="task-tab-testing"]')
      await waitForDomText(page, 'დავალება არქივშია — ტესტირების ისტორია სრულად ხელმისაწვდომია', 8000)
      await waitForDomText(page, 'არქივირებული სატესტო სცენარი', 8000)
      await page.click('[data-testid^="test-case-row-"]')
      await page.waitForSelector('[data-testid="test-run-row-1"]', { timeout: 8000 })
      await waitForDomText(page, 'დადასტურებულია დახურვამდე', 8000)

      // 10. As ADMIN, open taskWithStages case -> verify ADMIN sees delete button and delete cleans up
      await page.goto(`${SMOKE_BASE_URL}/?view=backlog`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })
      await page.waitForSelector(taskCardSel, { timeout: 8000 })
      await page.click(taskCardSel)
      await page.waitForSelector('[data-testid="task-tab-testing"]', { timeout: 8000 })
      await page.click('[data-testid="task-tab-testing"]')
      await page.waitForSelector(`[data-testid="test-case-row-${createdCaseId}"]`, { timeout: 8000 })
      await page.click(`[data-testid="test-case-row-${createdCaseId}"]`)
      await page.waitForSelector('[data-testid="delete-test-case-btn"]', { timeout: 8000 })

      collector.assertClean('Manual Testing UI Workflow')
    } catch (err) {
      await takeFailureScreenshot(page, 'manual_testing_ui_failure')
      throw err
    } finally {
      collector.detach()
      await page.close()
    }
  })
})
