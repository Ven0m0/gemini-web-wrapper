import { test, expect } from '@playwright/test'

test.describe('Python Runner (/python)', () => {
  test('runs a Python file and prints stdout', async ({ page }) => {
    // Polyfill config and mock Pyodide loader to avoid network
    await page.addInitScript(() => {
      localStorage.setItem('chat-github-config', JSON.stringify({
        githubToken: 'ghp_dummy', owner: 'user', repo: 'repo', branch: 'main',
        openaiKey: 'sk-dummy', path: '', model: 'gpt-4o-mini', temperature: 0.3
      }))
      // Mock loadPyodide with a minimal API for runPython
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.loadPyodide = async () => {
        return {
          stdout_callback: null,
          stderr_callback: null,
          setStdout(fn) { this.stdout_callback = fn },
          setStderr(fn) { this.stderr_callback = fn },
          runPython(code) {
            if (code.includes("print('Hello')")) {
              this.stdout_callback && this.stdout_callback('Hello\n')
              return null
            }
            return null
          }
        }
      }
    })

    // Mock GitHub API for a python file
    await page.route('https://api.github.com/repos/*/*/contents/main.py*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: btoa("print('Hello')\n"), sha: 'mocksha' })
      })
    })

    await page.goto('/')
    await page.waitForSelector('.cli-input')

    await page.fill('.cli-input', '/python main.py')
    await page.press('.cli-input', 'Enter')

    const history = page.locator('.cli-history')
    await expect(history).toContainText('🐍 Running Python via Pyodide')
    await expect(history).toContainText('Hello')
    await expect(history).toContainText('✅ Python execution complete')
  })
})

