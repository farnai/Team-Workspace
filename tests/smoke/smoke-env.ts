import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

export function extractDatabaseName(urlStr: string): string {
  try {
    const url = new URL(urlStr)
    return url.pathname.replace(/^\//, '').split('?')[0].trim()
  } catch {
    const match = urlStr.match(/\/([^/?#]+)(\?|$)/)
    return match ? match[1].trim() : ''
  }
}

const DEFAULT_TEST_DB_URL =
  'postgresql://workspace_user:workspace_secret_password@localhost:5434/team_workspace_test_db?schema=public'

export const SMOKE_TEST_DB_URL = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DB_URL
export const SMOKE_TARGET_DB_NAME = extractDatabaseName(SMOKE_TEST_DB_URL)

// Strict fail-closed verification
if (SMOKE_TARGET_DB_NAME === 'team_workspace_db') {
  throw new Error(
    `CRITICAL DATA SAFETY FAILURE: Smoke tests attempted to run against primary application database '${SMOKE_TARGET_DB_NAME}'! Aborting immediately.`
  )
}

if (!SMOKE_TARGET_DB_NAME.endsWith('_test_db') && !SMOKE_TARGET_DB_NAME.endsWith('_test')) {
  throw new Error(
    `CRITICAL DATA SAFETY FAILURE: Smoke tests must point to a dedicated test database ending with '_test_db' or '_test'. Resolved to: '${SMOKE_TARGET_DB_NAME}' (${SMOKE_TEST_DB_URL})`
  )
}

export const SMOKE_PORT = parseInt(process.env.SMOKE_PORT || '3005', 10)
export const SMOKE_BASE_URL = `http://localhost:${SMOKE_PORT}`

// Single dedicated Prisma client for smoke test fixtures
export const smokePrisma = new PrismaClient({
  datasources: {
    db: { url: SMOKE_TEST_DB_URL },
  },
  log: ['error'],
})

export function getBrowserExecutablePath(): string {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN
  }

  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    'No Chromium, Google Chrome, or Microsoft Edge browser executable found on the host system. Please install Chrome or set PUPPETEER_EXECUTABLE_PATH.'
  )
}

