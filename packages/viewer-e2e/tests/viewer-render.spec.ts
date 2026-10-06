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

	// `mounted` fires before the scene has framed; markers draw once it has,
	// which on a cold dev load can take longer than an assertion's timeout.
	await page.waitForFunction(
		() => window.__VIEWER_READY__ === true,
		undefined,
		{
			timeout: 30000
		}
	)

	// Hotspots, in a real browser, from the published tarball. The seam test in
	// the platform app asserts which props are handed over; this asserts what the
	// package actually draws when it gets them - and that the two markers a
	// visitor must never see are not among them.
	const markers = page.locator('.vctrl-viewer-hotspot')
	await expect(markers).toHaveCount(2)
	await expect(page.getByRole('img', { name: 'Public marker' })).toBeVisible()
	await expect(page.getByLabel('Internal marker')).toHaveCount(0)
	await expect(page.getByLabel('Hidden marker')).toHaveCount(0)

	// The published stylesheet is scoped to the viewer, so a page element
	// outside it keeps its own meaning for a class the viewer also uses.
	await expect(page.getByTestId('host-utility')).toBeVisible()

	expect(pageErrors, pageErrors.join('\n')).toEqual([])
})

test('a visitor can leave the camera a hotspot flew them to', async ({
	page
}) => {
	// Framing, then three flights, each a few seconds under software GL. It
	// took 21s of the default 30s on a built consumer in CI.
	test.setTimeout(60000)

	await page.goto('/')
	await page.waitForFunction(
		() => window.__VIEWER_E2E__?.status === 'mounted',
		undefined,
		{ timeout: 15000 }
	)

	const marker = page.getByRole('button', { name: 'Camera marker' })
	const back = page.getByRole('button', { name: 'Back to scene view' })

	// No way back is offered where there is nothing to come back from.
	await expect(back).toHaveCount(0)

	// `mounted` fires before the scene has framed, so this click usually lands
	// early, as a visitor's can: the viewer holds it and flies once framing is
	// done. The first wait therefore spans framing, which in a dev build under
	// software GL can outlast the default five seconds.
	await marker.click()
	await expect(back).toBeVisible({ timeout: 20000 })
	await expect(page.getByRole('status')).toHaveText('Viewing Camera marker')

	// An open card claims the first Escape; the view stays where it is.
	await expect(marker).toHaveAttribute('aria-expanded', 'true')
	await page.keyboard.press('Escape')
	await expect(marker).toHaveAttribute('aria-expanded', 'false')
	await expect(back).toBeVisible()

	// The second leaves the hotspot's camera.
	await page.keyboard.press('Escape')
	await expect(back).toHaveCount(0)
	await expect(page.getByRole('status')).toHaveText('Back to scene view')

	// And the control does the same, taking the hotspot's card with it: the
	// card describes a place the visitor is no longer standing at.
	await marker.click()
	await expect(marker).toHaveAttribute('aria-expanded', 'true')
	await back.click()
	await expect(back).toHaveCount(0)
	await expect(marker).toHaveAttribute('aria-expanded', 'false')
})

test('a scene whose environment map cannot be downloaded still renders', async ({
	page
}) => {
	// The default map lives on a third-party bucket that a visitor's network, an
	// ad blocker or an outage can take away. The scene is lit from a local room
	// instead of falling to the host page's error boundary.
	test.setTimeout(60000)
	const pageErrors: string[] = []
	page.on('pageerror', (err) => pageErrors.push(err.message))
	let blockedMaps = 0
	await page.route('**/*.hdr', (route) => {
		blockedMaps += 1
		return route.abort()
	})

	await page.goto('/')
	await page.waitForFunction(
		() => window.__VIEWER_READY__ === true,
		undefined,
		{ timeout: 30000 }
	)

	await expect(page.getByTestId('viewer-crashed')).toHaveCount(0)
	await expect(page.locator('.vctrl-viewer-hotspot')).toHaveCount(2)

	// Asked for once: the failure is not retried while the room is on screen.
	await page.waitForTimeout(1000)
	expect(blockedMaps).toBe(1)

	// Contained, not hidden: R3F reports what a boundary in its tree catches
	// through `reportError`, so the host's error monitoring still hears of the
	// missing map, and of nothing else.
	expect(pageErrors.length).toBeGreaterThan(0)
	for (const message of pageErrors) {
		expect(message).toMatch(/^Could not load \S+\.hdr/)
	}
})

declare global {
	interface Window {
		__VIEWER_E2E__?: { status: 'mounted' | 'crashed'; error?: string }
		__HOOKS_E2E__?: { status: 'ok' | 'crashed'; error?: string }
		__VIEWER_READY__?: boolean
	}
}
