import { test, expect } from '@playwright/test'

test.describe('CLI /img image generation', () => {
  test('should generate and upload image, then insert Markdown reference', async ({ page }) => {
    // Preload config so the app has tokens/owner/repo/branch and Markdown path
    await page.addInitScript(() => {
      localStorage.setItem('chat-github-config', JSON.stringify({
        githubToken: 'ghp_dummy',
        openaiKey: 'sk-dummy',
        owner: 'user',
        repo: 'repo',
        branch: 'main',
        path: 'README.md',
        model: 'gpt-4o-mini',
        temperature: 0.3
      }))
    })

    // Mock OpenAI image generation
    const tinyPngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3ZsGkAAAAASUVORK5CYII='
    await page.route('https://api.openai.com/v1/images/generations', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ b64_json: tinyPngB64 }] })
      })
    })

    // Mock GitHub upload
    await page.route('https://api.github.com/repos/*/*/contents/assets/*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: { sha: 'abc123', download_url: 'https://raw.githubusercontent.com/user/repo/main/assets/test.png' } })
      })
    })

    await page.goto('/')

    // Ensure CLI is ready
    await page.waitForSelector('.cli-input')

    // Run the command
    await page.fill('.cli-input', '/img test image from e2e')
    await page.press('.cli-input', 'Enter')

    // Assertions from CLI history
    const history = page.locator('.cli-history')
    await expect(history).toContainText('Generating image:')
    await expect(history).toContainText('Image generated. Uploading to repository')
    await expect(history).toContainText('Uploaded: assets/')
    await expect(history).toContainText('https://raw.githubusercontent.com')
    await expect(history).toContainText('Inserted image reference')
  })
})

