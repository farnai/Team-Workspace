import { spawn, execSync, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import {
  SMOKE_PORT,
  SMOKE_BASE_URL,
  SMOKE_TEST_DB_URL,
  SMOKE_TARGET_DB_NAME,
  smokePrisma,
} from './smoke-env'

let serverProcess: ChildProcess | null = null

export async function ensureSmokeServer(): Promise<{
  baseUrl: string
  stop: () => Promise<void>
}> {
  // Fail-closed verification
  if (SMOKE_TARGET_DB_NAME === 'team_workspace_db') {
    throw new Error(
      `CRITICAL ISOLATION FAILURE: Attempted to start smoke server against primary database '${SMOKE_TARGET_DB_NAME}'`
    )
  }

  // Check if a server is already running on SMOKE_PORT
  let alreadyRunning = false
  try {
    const res = await fetch(`${SMOKE_BASE_URL}/api/auth/me`, { signal: AbortSignal.timeout(1000) })
    alreadyRunning = res.status === 401 || res.status === 200
  } catch {
    alreadyRunning = false
  }

  if (!alreadyRunning) {
    const nextBuildDir = path.join(process.cwd(), '.next')
    const hasBuild = fs.existsSync(nextBuildDir) && fs.existsSync(path.join(nextBuildDir, 'BUILD_ID'))
    const nextCmd = hasBuild ? 'start' : 'dev'

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: SMOKE_TEST_DB_URL,
      PORT: String(SMOKE_PORT),
      NODE_ENV: hasBuild ? 'production' : 'development',
    }

    const proc = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['next', nextCmd, '-p', String(SMOKE_PORT)],
      {
        shell: true,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )
    serverProcess = proc

    proc.stdout?.on('data', (d) => {
      const msg = d.toString()
      if (process.env.DEBUG_SMOKE) console.log('[SmokeServer]', msg)
    })
    proc.stderr?.on('data', (d) => {
      const msg = d.toString()
      if (process.env.DEBUG_SMOKE) console.error('[SmokeServer ERR]', msg)
    })

    // Poll until ready
    let ready = false
    const start = Date.now()
    const timeoutMs = 25000

    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(`${SMOKE_BASE_URL}/api/auth/me`, {
          signal: AbortSignal.timeout(1000),
        })
        if (res.status === 401 || res.status === 200) {
          ready = true
          break
        }
      } catch {
        // waiting for server boot
      }
      await new Promise((r) => setTimeout(r, 400))
    }

    if (!ready) {
      if (serverProcess) serverProcess.kill()
      throw new Error(`Smoke test server failed to start within ${timeoutMs}ms on port ${SMOKE_PORT}`)
    }
  }

  // Two-way Database Handshake Verification
  const canaryId = `canary_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const canaryEmail = `${canaryId}@canary.local`
  const canaryToken = `tw_canary_${crypto.randomBytes(16).toString('hex')}`

  const canaryUser = await smokePrisma.user.create({
    data: {
      email: canaryEmail,
      name: 'Isolation Canary',
      role: 'USER',
      passwordHash: 'dummy',
      isActive: true,
      sessions: {
        create: {
          token: canaryToken,
          expiresAt: new Date(Date.now() + 60000),
        },
      },
    },
  })

  try {
    const handshakeRes = await fetch(`${SMOKE_BASE_URL}/api/auth/me`, {
      headers: {
        Cookie: `tw_session_token=${canaryToken}`,
      },
      signal: AbortSignal.timeout(3000),
    })

    if (!handshakeRes.ok) {
      throw new Error(
        `Database handshake failed with status ${handshakeRes.status}: ${await handshakeRes.text()}`
      )
    }

    const handshakeData = (await handshakeRes.json()) as { user?: { email: string } }
    if (handshakeData.user?.email !== canaryEmail) {
      throw new Error(
        `CRITICAL ISOLATION FAILURE: Server at ${SMOKE_BASE_URL} resolved to '${handshakeData.user?.email}' instead of test canary '${canaryEmail}'. Server is NOT reading from isolated test database!`
      )
    }
  } finally {
    await smokePrisma.user.delete({ where: { id: canaryUser.id } }).catch(() => {})
  }

  const stop = async () => {
    if (serverProcess && serverProcess.pid) {
      if (process.platform === 'win32') {
        try {
          execSync(`taskkill /pid ${serverProcess.pid} /T /F`, { stdio: 'ignore' })
        } catch {}
      } else {
        serverProcess.kill('SIGTERM')
      }
      serverProcess = null
    }
  }

  return {
    baseUrl: SMOKE_BASE_URL,
    stop,
  }
}
