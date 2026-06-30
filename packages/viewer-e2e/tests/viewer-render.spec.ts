import { expect, test } from '@playwright/test'

// These assertions run against a throwaway Vite app that installed
// @vctrl/viewer from the local Verdaccio registry (i.e. the real published
// tarball, not the workspace source). A green run proves the package can be
// installed, bundled, and rendered on a clean integration site.

test('viewer mounts without a runtime crash', async ({ page }) => {
	const consoleErrors: string[] = []
	page.on('console', (msg) => {
		if (msg.type() === 'error') consoleErrors.push(msg.text())
	})
	const pageErrors: string[] = []
	page.on('pageerror', (err) => pageErrors.push(err.message))

	await page.goto('/')

	// The host element renders synchronously; its presence proves the bundle
	// loaded and the module graph resolved.
	await expect(page.getByTestId('viewer-host')).toBeVisible()

	// The error boundary swaps in this node on a render-time crash.
	await expect(page.getByTestId('viewer-crashed')).toHaveCount(0)

	// Wait for the viewer to report a successful mount via the imperative API.
	await page.waitForFunction(
		() => window.__VIEWER_E2E__?.status === 'mounted',
		undefined,
		{ timeout: 15000 }
	)

	const flag = await page.evaluate(() => window.__VIEWER_E2E__)
	expect(flag?.status, flag?.error).toBe('mounted')

	// @vctrl/hooks probe: proves the published hooks package resolves its
	// externalized @vctrl/core dependency at runtime (and that the root export
	// works), not just that viewer renders.
	await expect(page.getByTestId('hooks-crashed')).toHaveCount(0)
	await page.waitForFunction(
		() => window.__HOOKS_E2E__?.status === 'ok',
		undefined,
		{ timeout: 15000 }
	)
	const hooksFlag = await page.evaluate(() => window.__HOOKS_E2E__)
	expect(hooksFlag?.status, hooksFlag?.error).toBe('ok')

	expect(pageErrors, pageErrors.join('\n')).toEqual([])
})

declare global {
	interface Window {
		__VIEWER_E2E__?: { status: 'mounted' | 'crashed'; error?: string }
		__HOOKS_E2E__?: { status: 'ok' | 'crashed'; error?: string }
	}
}
