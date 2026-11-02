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

test('a model loads from a URL through src, and a bad one shows the fallback', async ({
	page
}) => {
	const pageErrors: string[] = []
	page.on('pageerror', (err) => pageErrors.push(err.message))

	await page.goto('/?src-case')

	// The lazy parser chunk resolved from the installed @vctrl/core, fetched the
	// file and parsed it: the published package's whole src path.
	await page.waitForFunction(
		() => window.__SRC_E2E__ !== undefined,
		undefined,
		{
			timeout: 30000
		}
	)
	const loaded = await page.evaluate(() => window.__SRC_E2E__)
	expect(loaded?.status, loaded?.error).toBe('loaded')
	expect(loaded?.meshes).toBe(1)

	// And the viewer framed and drew it.
	await page.waitForFunction(() => window.__SRC_READY__ === true, undefined, {
		timeout: 30000
	})

	// An address that is not a model ends in the fallback, not a crash, and
	// children of its own do not end the loader early.
	await page.waitForFunction(
		() => window.__SRC_MISSING__?.length === 2,
		undefined,
		{
			timeout: 30000
		}
	)
	await expect(page.getByTestId('src-missing').getByRole('alert')).toHaveText(
		'This model could not be loaded.'
	)
	// `errorFallback={null}` shows nothing.
	await expect(page.getByTestId('src-silent').getByRole('alert')).toHaveCount(0)

	expect(pageErrors, pageErrors.join('\n')).toEqual([])
})

test('publishing bakes occlusion on the GPU into the GLB, from the published core', async ({
	page
}) => {
	const pageErrors: string[] = []
	page.on('pageerror', (err) => pageErrors.push(err.message))
	// A shader that fails to compile is logged, not thrown.
	const consoleErrors: string[] = []
	page.on('console', (msg) => {
		if (msg.type() === 'error') consoleErrors.push(msg.text())
	})

	await page.goto('/?occlusion-bake')
	await page.waitForFunction(
		() => window.__BAKE_E2E__ !== undefined,
		undefined,
		{
			timeout: 30000
		}
	)
	const bake = await page.evaluate(() => window.__BAKE_E2E__)
	if (bake?.status !== 'baked') throw new Error(bake?.error ?? 'no bake')

	// The floor and leaf are baked; the box and canopy have no UVs, so they
	// only cast.
	expect(bake.baked).toEqual(['floor', 'leaf'])
	expect(bake.skipped).toEqual(['box:no-uv0', 'canopy:no-uv0'])

	// Dark under the box, partly open beside it, open far from it. The open
	// texel at the box's mirror image across v = 0.5 proves the bake is read
	// back the right way up: row 0 is v = 0.
	expect(bake.under).toBeLessThan(40)
	expect(bake.beside).toBeGreaterThan(bake.under)
	expect(bake.beside).toBeLessThan(235)
	expect(bake.far).toBeGreaterThan(245)
	expect(bake.mirrored).toBeGreaterThan(245)
	// About half the rays rise steeply enough to meet the canopy. A bake that
	// kept only some of its samples, or aimed them all one way, misses this.
	expect(bake.canopy).toBeGreaterThan(70)
	expect(bake.canopy).toBeLessThan(170)

	// Every texel above was read from the published GLB: a PNG in the floor's
	// occlusion slot, on the first UV set.
	expect(bake.storedPng).toBe(true)
	// The light map, baked after the occlusion on the same renderer, from one
	// small light overhead: full light in the open, none under the box or the
	// canopy, and the right way up. Stored as the square root of its share of
	// the scale, so full light reads 255.
	expect(bake.lights.baked).toEqual(['floor', 'leaf'])
	expect(bake.lights.scale).toBeCloseTo(1)
	expect(bake.lights.far).toBeGreaterThan(245)
	expect(bake.lights.mirrored).toBeGreaterThan(245)
	expect(bake.lights.under).toBeLessThan(10)
	expect(bake.lights.canopy).toBeLessThan(10)
	// The leaf shades the floor only under its opaque quadrant, the one at
	// low v: read upside down, the shadow lands on leafClearV instead. The
	// occlusion bake casts through the same ray test, but one quadrant of a
	// small card moves its wide-angle occlusion too little to assert here.
	expect(bake.lights.leafSolid).toBeLessThan(10)
	expect(bake.lights.leafClearU).toBeGreaterThan(245)
	expect(bake.lights.leafClearV).toBeGreaterThan(245)
	// Open floor and the scrap under the box share these texels: half lit,
	// which stores as the square root of a half, about 180. A sum would clip
	// to full light.
	expect(bake.lights.shared).toBeGreaterThan(140)
	expect(bake.lights.shared).toBeLessThan(215)
	// Three's loader reads it back as a switched-off light map carrying the
	// lights it was baked from.
	expect(bake.lights.loaded).toBe(true)
	// The bake is drawn in fenced slices: unsliced, two materials with four
	// occlusion and two light passes each took twelve draws, and the first ray
	// alone is split into tiles. No slice is drawn before the last one's fence
	// has signaled.
	expect(bake.slices.fences).toBeGreaterThan(12)
	expect(bake.slices.early).toBe(0)

	// A GPU reset mid-bake fails the bake rather than ship what it read back.
	expect(bake.contextLoss).toMatch(/GPU reset/)
	expect(pageErrors, pageErrors.join('\n')).toEqual([])
	expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
})

test('a lost WebGL context is redrawn when it comes back, and says so when it does not', async ({
	page
}) => {
	// What a phone does when a page runs short of graphics memory. The canvas
	// used to stay blank for good, with nothing on screen saying why.
	test.setTimeout(60000)
	const pageErrors: string[] = []
	page.on('pageerror', (err) => pageErrors.push(err.message))
	const assetRequests: string[] = []
	page.on('request', (request) => {
		if (/\.(hdr|glb|exr|ktx2|png|jpe?g|webp)(\?|$)/.test(request.url())) {
			assetRequests.push(request.url())
		}
	})

	await page.goto('/')
	await page.waitForFunction(
		() => window.__VIEWER_READY__ === true,
		undefined,
		{ timeout: 30000 }
	)
	const host = page.getByTestId('viewer-host')
	const failure = host.getByRole('alert')
	const loseContext = () =>
		page.evaluate(() => {
			const canvas = document.querySelector(
				'[data-testid="viewer-host"] canvas'
			) as HTMLCanvasElement
			canvas.dataset.lostOnce = 'true'
			const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
			const extension = gl?.getExtension('WEBGL_lose_context')
			if (!extension) throw new Error('WEBGL_lose_context is not available')
			window.__LOSE_CONTEXT__ = extension
			extension.loseContext()
		})
	const eventsSoFar = () => page.evaluate(() => window.__VIEWER_EVENTS__ ?? [])

	// Lost and handed back: a fresh canvas draws the scene the viewer already
	// holds, without asking the network for any of it again.
	const requestsBeforeLoss = assetRequests.length
	await loseContext()
	await page.evaluate(() => window.__LOSE_CONTEXT__?.restoreContext())
	await expect(host.locator('canvas:not([data-lost-once])')).toHaveCount(1)
	expect(await eventsSoFar()).toEqual(
		expect.arrayContaining(['context_lost', 'context_restored'])
	)
	await expect(failure).toHaveCount(0)
	await page.waitForTimeout(1500)
	expect(assetRequests.slice(requestsBeforeLoss)).toEqual([])

	// Lost again right after: the viewer stops and says so rather than leave
	// an empty frame.
	await loseContext()
	await expect(failure).toHaveText(
		"This scene couldn't be shown on this device.Try again"
	)
	await expect(host.locator('canvas')).toHaveCount(0)
	expect(await eventsSoFar()).toContain('render_failed')

	// And a visitor can ask for another go.
	await failure.getByRole('button', { name: 'Try again' }).click()
	await expect(failure).toHaveCount(0)
	await expect(host.locator('canvas')).toHaveCount(1)

	expect(pageErrors, pageErrors.join('\n')).toEqual([])
})

declare global {
	interface Window {
		__VIEWER_EVENTS__?: string[]
		__LOSE_CONTEXT__?: WEBGL_lose_context
		__VIEWER_E2E__?: { status: 'mounted' | 'crashed'; error?: string }
		__HOOKS_E2E__?: { status: 'ok' | 'crashed'; error?: string }
		__VIEWER_READY__?: boolean
		__SRC_E2E__?: {
			status: 'loaded' | 'error'
			meshes?: number
			error?: string
		}
		__SRC_READY__?: boolean
		__SRC_MISSING__?: string[]
		__BAKE_E2E__?:
			| {
					status: 'baked'
					baked: string[]
					skipped: string[]
					under: number
					beside: number
					far: number
					mirrored: number
					canopy: number
					storedPng: boolean
					lights: {
						baked: string[]
						scale: number
						under: number
						far: number
						mirrored: number
						canopy: number
						shared: number
						loaded: boolean
					}
					slices: { fences: number; early: number }
					contextLoss: string
			  }
			| { status: 'error'; error: string }
	}
}
