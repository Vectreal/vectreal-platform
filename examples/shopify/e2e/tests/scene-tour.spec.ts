import { expect, test, type Page, type TestInfo } from '@playwright/test'

import { HARNESS_CAMERAS, HARNESS_STEPS, SCENE_CAMERAS } from '../src/harness'

const THROTTLED = 'android-chromium-throttled'

/** Lighthouse's "Slow 4G" and its mid-range phone CPU. */
async function throttle(page: Page, testInfo: TestInfo) {
	if (testInfo.project.name !== THROTTLED) return
	const cdp = await page.context().newCDPSession(page)
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
	await cdp.send('Network.enable')
	await cdp.send('Network.emulateNetworkConditions', {
		offline: false,
		latency: 150,
		downloadThroughput: (1.6 * 1024 * 1024) / 8,
		uploadThroughput: (750 * 1024) / 8
	})
}

/**
 * A finger dragging up the screen from (x, y): a real touch gesture, which
 * honours `touch-action` all the way into the iframe. Chromium only: WebKit
 * has no gesture API, so there the tests hit-test the point instead.
 */
async function swipeUp(
	page: Page,
	at: { x: number; y: number },
	distance: number
) {
	const cdp = await page.context().newCDPSession(page)
	await cdp.send('Input.synthesizeScrollGesture', {
		x: at.x,
		y: at.y,
		yDistance: -distance,
		gestureSourceType: 'touch',
		speed: 1600
	})
	await cdp.detach()
	await page.waitForTimeout(400)
}

const hasTouchGestures = (testInfo: TestInfo) =>
	testInfo.project.name === THROTTLED

/**
 * Whether the browser may scroll the page from a touch on the scene: `none`
 * when the canvas or any element above it claims the touch, as OrbitControls
 * does on the element it connects to.
 */
const sceneTouchAction = (page: Page) =>
	page
		.frameLocator('.vectreal-tour__scene')
		.locator('canvas')
		.first()
		.evaluate((canvas) => {
			for (
				let element: Element | null = canvas;
				element;
				element = element.parentElement
			) {
				if (getComputedStyle(element).touchAction === 'none') return 'none'
			}
			return 'auto'
		})

/** The element a touch at (x, y) lands on. */
const touchTarget = (page: Page, at: { x: number; y: number }) =>
	page.evaluate(({ x, y }) => {
		const element = document.elementFromPoint(x, y)
		return { tagName: element?.tagName }
	}, at)

/** A drag sideways across (x, y): an orbit, if the scene takes it. */
async function dragAcross(page: Page, at: { x: number; y: number }) {
	await page.mouse.move(at.x - 100, at.y)
	await page.mouse.down()
	await page.mouse.move(at.x + 100, at.y, { steps: 10 })
	await page.mouse.up()
	await page.waitForTimeout(800)
}

const tour = (page: Page) => page.locator('vectreal-scene-tour')
const frame = (page: Page) => page.locator('.vectreal-tour__frame')
const stage = (page: Page) => page.locator('.vectreal-tour__stage')

async function centerOf(page: Page) {
	const box = await frame(page).boundingBox()
	if (!box) throw new Error('The frame is not on screen.')
	return { x: box.x + box.width / 2, y: box.y + box.height / 2, box }
}

/** Scrolls to the section, waits for the scene and starts recording camera changes. */
async function openTour(page: Page, testInfo: TestInfo, path = '/') {
	await throttle(page, testInfo)
	await page.goto(path)
	const started = Date.now()
	await tour(page).evaluate((element) =>
		window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY)
	)
	await expect(tour(page)).toHaveAttribute('data-state', 'ready', {
		timeout: 150_000
	})
	testInfo.annotations.push({
		type: 'scene ready after',
		description: `${((Date.now() - started) / 1000).toFixed(1)} s`
	})
	await tour(page).evaluate((element) => {
		const host = element as HTMLElement & {
			embed: {
				on: (
					type: string,
					handler: (data: { cameraId: string }) => void
				) => void
			}
			cameras: string[]
		}
		host.cameras = []
		host.embed.on('camera_changed', ({ cameraId }) =>
			host.cameras.push(cameraId)
		)
	})
}

/** Scrolls to the middle of a tour step, measured in the section's own step lengths. */
const goToStep = (page: Page, step: number) =>
	tour(page).evaluate((element, step) => {
		const runway = element.querySelector<HTMLElement>('.vectreal-tour__runway')!
		const svh =
			runway.querySelector<HTMLElement>('.vectreal-tour__stage')!.offsetHeight /
			100
		const style = getComputedStyle(element)
		const length = (name: string) =>
			parseFloat(style.getPropertyValue(name)) * svh
		const top = runway.getBoundingClientRect().top + window.scrollY
		window.scrollTo(
			0,
			top +
				length('--vectreal-tour-lead') +
				(step + 0.5) * length('--vectreal-tour-step-length')
		)
	}, step)

/** The cameras the tour moved to: the viewer also reports the one it opens on, whenever it frames it. */
const camerasToured = async (page: Page) =>
	(await camerasShown(page)).filter((camera) => camera !== HARNESS_CAMERAS[0])

/** Each caption's state, in step order: `past`, `active` or `next`. */
const captionStates = (page: Page) =>
	page
		.locator('.vectreal-tour__caption')
		.evaluateAll((captions) =>
			captions.map((caption) => (caption as HTMLElement).dataset.state)
		)

const activeCaption = (page: Page) =>
	page.locator('.vectreal-tour__caption[data-state="active"]')

const camerasShown = (page: Page) =>
	tour(page).evaluate(
		(element) => (element as HTMLElement & { cameras: string[] }).cameras
	)

test('shows the poster first and loads the scene only once the section comes into view', async ({
	page
}, testInfo) => {
	await throttle(page, testInfo)
	const device = page.viewportSize()!
	// A short window keeps the section beyond its load margin on every device.
	await page.setViewportSize({ width: device.width, height: 420 })
	await page.goto('/')
	const scene = page.locator('.vectreal-tour__scene')
	const placeSectionBelowFold = (viewports: number) =>
		tour(page).evaluate((element, viewports) => {
			const top = element.getBoundingClientRect().top + window.scrollY
			window.scrollTo(0, top - window.innerHeight * (1 + viewports))
		}, viewports)

	await expect(scene).not.toHaveAttribute('src', /.+/)
	await placeSectionBelowFold(0.75)
	await page.waitForTimeout(1_000)
	await expect(scene).not.toHaveAttribute('src', /.+/)

	await placeSectionBelowFold(0)
	await expect(scene).toHaveAttribute('src', /\/embed\//)
	await page.setViewportSize(device)
	await tour(page).scrollIntoViewIfNeeded()
	await expect(page.locator('.vectreal-tour__poster')).toBeVisible()
	await expect(tour(page)).toHaveAttribute('data-state', 'ready', {
		timeout: 150_000
	})
	await expect(page.locator('.vectreal-tour__poster')).toHaveCSS('opacity', '0')
})

test('scrolling tours the cameras in order while the stage stays pinned, and the page scrolls on past it', async ({
	page
}, testInfo) => {
	await openTour(page, testInfo)

	for (let step = 0; step < HARNESS_CAMERAS.length; step++) {
		await goToStep(page, step)
		await expect.poll(() => camerasToured(page)).toHaveLength(step)
		expect((await stage(page).boundingBox())!.y).toBe(0)
		await expect(activeCaption(page)).toContainText(HARNESS_STEPS[step].heading)
		await expect(activeCaption(page)).toContainText(`0${step + 1} / 03`)
		await expect(page.locator('.vectreal-tour__caption:visible')).toHaveCount(1)
		expect(await captionStates(page)).toEqual(
			HARNESS_STEPS.map((_, index) =>
				index < step ? 'past' : index === step ? 'active' : 'next'
			)
		)
		await page.waitForTimeout(1_500)
		await page.screenshot({ path: testInfo.outputPath(`step-${step + 1}.png`) })
	}

	expect(await camerasToured(page)).toEqual(HARNESS_CAMERAS.slice(1))
	// The captions stand in for the scene's own hotspot labels.
	await expect(page.locator('.vectreal-tour__scene')).toHaveAttribute(
		'src',
		/hotspots=0/
	)
	await expect(page.locator('[data-handover]')).toBeVisible()

	await goToStep(page, HARNESS_CAMERAS.length + 1)
	expect((await stage(page).boundingBox())!.y).toBeLessThan(0)
})

test('a section that starts hidden, as in a closed theme tab, tours once it is shown', async ({
	page
}, testInfo) => {
	await throttle(page, testInfo)
	await page.goto('/')
	const wrapper = page.locator('.shopify-section:has(vectreal-scene-tour)')
	await wrapper.evaluate(
		(element: HTMLElement) => (element.style.display = 'none')
	)
	await page.waitForTimeout(500)
	await wrapper.evaluate((element: HTMLElement) => (element.style.display = ''))
	await tour(page).evaluate((element) =>
		window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY)
	)
	await expect(tour(page)).toHaveAttribute('data-state', 'ready', {
		timeout: 150_000
	})

	await goToStep(page, 1)
	await expect(activeCaption(page)).toContainText(HARNESS_STEPS[1].heading)
	await expect
		.poll(() =>
			tour(page).evaluate((element: HTMLElement) =>
				element.style.getPropertyValue('--vectreal-tour-open')
			)
		)
		.toBe('1.000')
})

test('each station gets its turn, even two on one camera, and a blank one or one the scene lacks is skipped', async ({
	page
}, testInfo) => {
	await openTour(page, testInfo, '/?stations=default,,detail,nope,detail')

	const shown = []
	for (let step = 0; step < 3; step++) {
		await goToStep(page, step)
		await expect(activeCaption(page)).toContainText(`0${step + 1} / 03`)
		shown.push(await activeCaption(page).locator('h3').textContent())
	}
	expect(shown).toEqual(['Station 1', 'Station 3', 'Station 5'])
})

test("a plain camera list tours without captions and keeps the scene's hotspots", async ({
	page
}, testInfo) => {
	await openTour(page, testInfo, '/?cameras=default,context,detail')

	for (let step = 1; step < 3; step++) {
		await goToStep(page, step)
		await expect.poll(() => camerasToured(page)).toHaveLength(step)
	}
	expect(await camerasToured(page)).toEqual(['context', 'detail'])
	await expect(page.locator('.vectreal-tour__captions')).toHaveCount(0)
	await expect(page.locator('.vectreal-tour__scene')).not.toHaveAttribute(
		'src',
		/hotspots=0/
	)
})

test('the scene takes no touch during the tour, so a finger on it scrolls the page', async ({
	page
}, testInfo) => {
	await openTour(page, testInfo)
	const { x, y } = await centerOf(page)

	expect(await touchTarget(page, { x, y })).toEqual({ tagName: 'IFRAME' })
	expect(await sceneTouchAction(page)).toBe('auto')

	if (hasTouchGestures(testInfo)) {
		const before = await page.evaluate(() => window.scrollY)
		await swipeUp(page, { x, y }, 200)
		expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(
			before + 100
		)
	}
})

test('"Selbst drehen" appears once scrolling pauses, hands the scene over, and the next step takes it back', async ({
	page
}, testInfo) => {
	await openTour(page, testInfo)
	await goToStep(page, 1)
	const { x, y } = await centerOf(page)
	const onHeader = { x, y: 8 }
	const handover = page.locator('[data-handover]')

	await expect(handover).toBeHidden()
	await expect(handover).toBeVisible()
	await expect(handover).toHaveText('Selbst drehen')
	await page.waitForTimeout(1_000)
	await page.screenshot({ path: testInfo.outputPath('paused-mid-tour.png') })
	await handover.tap()

	await expect(tour(page)).toHaveAttribute('data-control', 'shopper')
	await expect(handover).toBeHidden()
	await expect.poll(() => sceneTouchAction(page)).toBe('none')
	expect(await touchTarget(page, onHeader)).not.toEqual({ tagName: 'IFRAME' })

	if (hasTouchGestures(testInfo)) {
		// Orbiting redraws every frame. Here that is software GL on a throttled
		// CPU, which starves the renderer; a phone draws it on its GPU.
		const cdp = await page.context().newCDPSession(page)
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
		await cdp.detach()

		const onScene = await page.evaluate(() => window.scrollY)
		await swipeUp(page, { x, y }, 200)
		expect(await page.evaluate(() => window.scrollY)).toBe(onScene)

		await swipeUp(page, onHeader, 60)
		expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(
			onScene + 30
		)
	} else {
		await page.waitForTimeout(2_000)
		const view = await frame(page).screenshot()
		await page.waitForTimeout(800)
		expect(await frame(page).screenshot()).toEqual(view)
		await dragAcross(page, { x, y })
		expect(await frame(page).screenshot()).not.toEqual(view)
		await page.screenshot({
			path: testInfo.outputPath('after-selbst-drehen.png')
		})
	}

	await goToStep(page, 2)
	await expect(tour(page)).toHaveAttribute('data-control', 'tour')
	await expect.poll(() => sceneTouchAction(page)).toBe('auto')
	await expect.poll(() => camerasShown(page)).toContain(HARNESS_CAMERAS[2])
})

test('a theme editor re-render while the scene loads leaves one working tour', async ({
	page
}, testInfo) => {
	await page.addInitScript(() => {
		type Sdk = { VectrealEmbed: new (...args: unknown[]) => object }
		const counted = window as unknown as { embeds: number }
		counted.embeds = 0
		let sdk: Sdk | undefined
		Object.defineProperty(window, 'VectrealEmbed', {
			configurable: true,
			get: () => sdk,
			set: (loaded: Sdk) => {
				sdk = {
					...loaded,
					VectrealEmbed: class extends loaded.VectrealEmbed {
						constructor(...args: unknown[]) {
							super(...args)
							counted.embeds++
						}
					}
				}
			}
		})
	})
	let releaseSdk = () => {}
	const rerendered = new Promise<void>((resolve) => (releaseSdk = resolve))
	await page.route('**/vectreal-embed.umd.js', async (route) => {
		await rerendered
		await route.continue()
	})
	await throttle(page, testInfo)
	await page.goto('/', { waitUntil: 'domcontentloaded' })
	await tour(page).scrollIntoViewIfNeeded()
	await expect(page.locator('.vectreal-tour__scene')).toHaveAttribute(
		'src',
		/\/embed\//
	)
	await tour(page).evaluate((element) => {
		const parent = element.parentElement!
		element.remove()
		parent.append(element)
	})
	releaseSdk()

	await expect(tour(page)).toHaveAttribute('data-state', 'ready', {
		timeout: 150_000
	})
	expect(
		await page.evaluate(() => (window as unknown as { embeds: number }).embeds)
	).toBe(1)
	await goToStep(page, HARNESS_CAMERAS.length - 1)
	await expect(page.locator('[data-handover]')).toBeVisible()
})

test('without a scene URL the section keeps its poster and no runway', async ({
	page
}) => {
	await page.goto('/?scene_url=')
	await tour(page).scrollIntoViewIfNeeded()

	await expect(tour(page)).toHaveAttribute('data-state', 'failed')
	await expect(stage(page)).toHaveCSS('position', 'static')
	await expect(page.locator('.vectreal-tour__poster')).toBeVisible()
	await expect(page.locator('[data-handover]')).toBeHidden()
})

test('when no tour camera matches the scene, the shopper turns it from the start', async ({
	page
}, testInfo) => {
	await throttle(page, testInfo)
	await page.goto('/?cameras=nope')
	await tour(page).scrollIntoViewIfNeeded()

	await expect(tour(page)).toHaveAttribute('data-state', 'ready', {
		timeout: 150_000
	})
	await expect(stage(page)).toHaveCSS('position', 'static')
	await expect(tour(page)).toHaveAttribute('data-control', 'shopper')
	await expect.poll(() => sceneTouchAction(page)).toBe('none')
	// No stations, no captions: the scene keeps its own hotspots.
	await expect(page.locator('.vectreal-tour__scene')).not.toHaveAttribute(
		'src',
		/hotspots=0/
	)
})

test.describe('with reduced motion', () => {
	test.use({ contextOptions: { reducedMotion: 'reduce' } })

	test('the scene keeps its own camera buttons, the shopper turns it, and scrolling moves nothing', async ({
		page
	}, testInfo) => {
		await openTour(page, testInfo)

		await expect(activeCaption(page)).toContainText(HARNESS_STEPS[0].heading)
		await expect(tour(page)).toHaveAttribute('data-mode', 'static')
		await expect(stage(page)).toHaveCSS('position', 'static')
		await expect(tour(page)).toHaveAttribute('data-control', 'shopper')
		await expect(page.locator('[data-handover]')).toBeHidden()

		await page.evaluate(() => window.scrollBy(0, -400))
		for (let step = 0; step < 6; step++) {
			await page.evaluate(() => window.scrollBy(0, 200))
			await page.waitForTimeout(200)
		}
		// The viewer reports its opening camera again whenever it comes back
		// into view; anything else would be the section moving it.
		expect(
			(await camerasShown(page)).every(
				(camera) => camera === HARNESS_CAMERAS[0]
			)
		).toBe(true)

		await tour(page).scrollIntoViewIfNeeded()
		await page
			.frameLocator('.vectreal-tour__scene')
			.getByRole('button', { name: 'Next camera' })
			.tap()
		await expect
			.poll(async () => (await camerasShown(page)).at(-1))
			.toBe(SCENE_CAMERAS[1])
		// The caption follows the camera the shopper picked, not the step order.
		await expect(activeCaption(page)).toContainText(
			HARNESS_STEPS.find((step) => step.camera === SCENE_CAMERAS[1])!.heading
		)
		await page.waitForTimeout(1_000)
		await page.screenshot({ path: testInfo.outputPath('reduced-motion.png') })
	})
})
