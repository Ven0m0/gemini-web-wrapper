import { test, expect } from '@playwright/test'

test.describe('Python Runner panel prints hello world', () => {
  test('run print("hello world") shows in output', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('chat-github-config', JSON.stringify({
        githubToken: 'ghp_dummy', owner: 'user', repo: 'repo', branch: 'main',
        openaiKey: 'sk-dummy', path: '', model: 'gpt-4o-mini', temperature: 0.3
      }))
      // Mock Pyodide to avoid network
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.loadPyodide = async () => {
        return {
          stdout_callback: null,
          stderr_callback: null,
          setStdout(fn) { this.stdout_callback = fn },
          setStderr(fn) { this.stderr_callback = fn },
          runPython(code) {
            if (code && code.includes('print("hello world")')) {
              this.stdout_callback && this.stdout_callback('hello world\n')
            }
            return null
          }
        }
      }
    })

    await page.goto('/')
    await page.waitForSelector('.cli-input')
    await page.fill('.cli-input', '/python')
    await page.press('.cli-input', 'Enter')

    await expect(page.getByText('🐍 Python Runner')).toBeVisible()
    const runButton = page.getByRole('button', { name: /Run/i })

    const textarea = page.locator('textarea')
    await textarea.fill('print("hello world")\n')
    await runButton.click()

    await expect(page.locator('text=stdout:')).toBeVisible()
    await expect(page.locator('pre')).toContainText('hello world')
  })
})

