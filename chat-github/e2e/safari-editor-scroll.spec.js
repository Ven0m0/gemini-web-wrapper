import { test, expect } from '@playwright/test'
import { PWATestHelpers } from './helpers'

test.describe('Safari Desktop Editor Scrolling', () => {
  test('should scroll CodeMirror in desktop Safari (WebKit)', async ({ page }) => {
    const browserName = page.context().browser()?.browserType().name()

    // Only meaningful on WebKit (Safari). Skip others to keep suite stable.
    test.skip(browserName !== 'webkit', 'This test targets Safari/WebKit specifically')

    const helpers = new PWATestHelpers(page)

    // Ensure app is loaded and CLI ready
    await helpers.waitForCLI()

    // Open a file and go to editor
    await helpers.executeCommand('/open test.txt')
    await helpers.executeCommand('/editor')
    await expect(page.locator('.editor-container')).toBeVisible()
    await expect(page.locator('.cm-editor')).toBeVisible()

    // Add substantial content via beforeinput to quickly populate CodeMirror
    await page.click('.cm-editor')
    await page.evaluate(() => {
      const cmContent = document.querySelector('.cm-content')
      if (cmContent) {
        const bigText = Array.from({ length: 120 }, (_, i) => `Safari desktop scroll line ${i + 1} — lorem ipsum dolor sit amet.`).join('\n')
        const ev = new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: bigText,
          bubbles: true,
          cancelable: true,
        })
        cmContent.dispatchEvent(ev)
      }
    })

    // Constrain editor height to guarantee overflow
    await page.evaluate(() => {
      const editorContent = document.querySelector('.editor-content')
      const cmScroller = document.querySelector('.cm-scroller')
      if (editorContent && cmScroller) {
        editorContent.setAttribute('data-test-height', 'desktop-safari')
        Object.assign(editorContent.style, {
          height: '320px',
          maxHeight: '320px',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
        })
        Object.assign((cmScroller as HTMLElement).style, {
          height: '300px',
          maxHeight: '300px',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        })
      }
    })

    const cmScroller = page.locator('.cm-scroller')
    await expect(cmScroller).toBeVisible()

    // Verify computed properties indicate scrollable area
    const props = await cmScroller.evaluate((el) => {
      const cs = window.getComputedStyle(el)
      return {
        overflowY: cs.overflowY,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        canScroll: el.scrollHeight > el.clientHeight,
      }
    })

    expect(props.overflowY).toBe('auto')
    expect(props.canScroll).toBe(true)

    // Programmatic scroll (should work on Safari desktop)
    const initialTop = await cmScroller.evaluate((el) => el.scrollTop)
    await cmScroller.evaluate((el) => (el.scrollTop = el.clientHeight))
    const afterProgTop = await cmScroller.evaluate((el) => el.scrollTop)
    expect(afterProgTop).toBeGreaterThan(initialTop)

    // Wheel scroll gesture
    await cmScroller.hover()
    await page.mouse.wheel(0, 200)
    const afterWheelTop = await cmScroller.evaluate((el) => el.scrollTop)
    expect(afterWheelTop).toBeGreaterThan(afterProgTop)

    // Final assertion confirming scrolling works
    expect(afterWheelTop).toBeGreaterThan(initialTop)
  })
})

