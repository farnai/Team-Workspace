import fs from 'fs'
import path from 'path'
import puppeteer, { Browser, Page, HTTPRequest, HTTPResponse } from 'puppeteer-core'
import { getBrowserExecutablePath, SMOKE_BASE_URL, SMOKE_PORT } from './smoke-env'

export interface PageErrorCollector {
  pageErrors: Error[]
  consoleErrors: string[]
  failedRequests: { url: string; errorText: string }[]
  badResponses: { url: string; status: number; statusText: string }[]
  detach: () => void
  assertClean: (context: string) => void
  reset: () => void
}

export async function launchSmokeBrowser(): Promise<Browser> {
  const executablePath = getBrowserExecutablePath()

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1366,768',
    ],
  })

  return browser
}

export function attachPreNavErrorCollector(page: Page): PageErrorCollector {
  const pageErrors: Error[] = []
  const consoleErrors: string[] = []
  const failedRequests: { url: string; errorText: string }[] = []
  const badResponses: { url: string; status: number; statusText: string }[] = []

  const onPageError = (err: any) => {
    pageErrors.push(err instanceof Error ? err : new Error(String(err)))
  }

  const onConsole = (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      // Ignore favicon not found or harmless non-app browser warnings
      if (text.includes('favicon.ico')) return
      consoleErrors.push(text)
    }
  }

  const onRequestFailed = (req: HTTPRequest) => {
    const url = req.url()
    if (url.includes('/api/')) {
      failedRequests.push({
        url,
        errorText: req.failure()?.errorText || 'Unknown request failure',
      })
    }
  }

  const onResponse = (res: HTTPResponse) => {
    const url = res.url()
    const status = res.status()
    // Catch unexpected 4xx and 5xx on internal app API endpoints
    if (url.includes('/api/') && status >= 400) {
      badResponses.push({
        url,
        status,
        statusText: res.statusText(),
      })
    }
  }

  page.on('pageerror', onPageError)
  page.on('console', onConsole)
  page.on('requestfailed', onRequestFailed)
  page.on('response', onResponse)

  const detach = () => {
    page.off('pageerror', onPageError)
    page.off('console', onConsole)
    page.off('requestfailed', onRequestFailed)
    page.off('response', onResponse)
  }

  const reset = () => {
    pageErrors.length = 0
    consoleErrors.length = 0
    failedRequests.length = 0
    badResponses.length = 0
  }

  const assertClean = (context: string) => {
    if (pageErrors.length > 0) {
      throw new Error(
        `[${context}] Unhandled browser runtime error: ${pageErrors.map((e) => e.message).join(' | ')}`
      )
    }
    if (consoleErrors.length > 0) {
      throw new Error(
        `[${context}] Console error logged in browser: ${consoleErrors.join(' | ')}`
      )
    }
    if (failedRequests.length > 0) {
      throw new Error(
        `[${context}] Network request failed: ${failedRequests
          .map((r) => `${r.url} (${r.errorText})`)
          .join(' | ')}`
      )
    }
    if (badResponses.length > 0) {
      throw new Error(
        `[${context}] Unexpected API error status returned: ${badResponses
          .map((r) => `${r.status} ${r.url}`)
          .join(' | ')}`
      )
    }
  }

  return {
    pageErrors,
    consoleErrors,
    failedRequests,
    badResponses,
    detach,
    assertClean,
    reset,
  }
}

export async function setAuthSessionCookie(page: Page, token: string): Promise<void> {
  await page.setCookie({
    name: 'tw_session_token',
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  })
}

export async function takeFailureScreenshot(page: Page, testName: string): Promise<string> {
  const screenshotsDir = path.join(process.cwd(), 'tests', 'smoke', 'screenshots')
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true })
  }
  const cleanName = testName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filePath = path.join(screenshotsDir, `${cleanName}_${Date.now()}.png`)
  await page.screenshot({ path: filePath, fullPage: true })
  return filePath
}

export async function waitForDomText(page: Page, text: string, timeoutMs = 8000): Promise<void> {
  const normalizedTarget = text.replace(/\s+/g, ' ').trim()
  await page.waitForFunction(
    (target) => {
      if (!document.body) return false
      const bodyText = document.body.innerText.replace(/\s+/g, ' ')
      return bodyText.includes(target)
    },
    { timeout: timeoutMs },
    normalizedTarget
  )
}
