import { spawn } from 'child_process'

async function main() {
  console.log('🚀 Starting GTU Team Workspace Browser Smoke Tests...')

  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', '--test', '--test-concurrency=1', 'tests/smoke/pages.smoke.test.ts'],
    {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    }
  )

  child.on('close', (code) => {
    process.exit(code ?? 0)
  })
}

main().catch((err) => {
  console.error('Smoke tests runner failure:', err)
  process.exit(1)
})

