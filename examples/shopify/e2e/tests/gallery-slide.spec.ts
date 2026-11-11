import { expect, type Page, test } from '@playwright/test'

/*
  SHOPIFY_HARNESS_EMBED_URL names a scene published with Start moving set to
  "After a tap" and the button language Deutsch, as the slide asks.
*/

const slide = (page: Page) => page.locator('vectreal-media')
const scene = (page: Page) => page.locator('.vectreal-slide__scene')
const gallery = (page: Page) => page.locator('#Slider-Gallery-main')
const inScene = (page: Page) => page.frameLocator('.vectreal-slide__scene')

async function showSlide(page: Page) {
	await page.locator('.slider-button--next').first().tap()
	await expect(slide(page)).toBeInViewport({ ratio: 0.9 })
}

const galleryScroll = (page: Page) =>
	gallery(page).evaluate((list) => list.scrollLeft)

/** Back to the slide after a swipe took the gallery past it. */
async function showSlideAgain(page: Page, scrollLeft: number) {
	await gallery(page).evaluate(
		(list, left) => list.scrollTo({ left, behavior: 'instant' }),
		scrollLeft
	)
	await expect(slide(page)).toBeInViewport({ ratio: 0.9 })
}

/**
 * A real touch swipe from right to left across the middle of the slide,
 * through the compositor as a finger's would go, so it reaches whatever the
 * browser hands touches to: the scene inside the frame or the gallery around
 * it. Chromium only: WebKit has no way to synthesize one.
 */
async function swipeAcrossSlide(page: Page) {
	const box = await slide(page).boundingBox()
	if (!box) throw new Error('the slide is not on screen')
	const session = await page.context().newCDPSession(page)
	await session.send('Input.synthesizeScrollGesture', {
		x: Math.round(box.x + box.width * 0.7),
		y: Math.round(box.y + box.height / 2),
		xDistance: -Math.round(box.width * 0.5),
		yDistance: 0,
		gestureSourceType: 'touch',
		speed: 800
	})
	await session.detach()
	await page.waitForTimeout(800)
}

test('the gallery slide shows its poster, then the scene once loaded, waiting for a tap', async ({
	page
}, testInfo) => {
	await page.goto('/')
	await expect(scene(page)).toHaveAttribute('src', /\/embed\//)

	await showSlide(page)
	await page.screenshot({ path: testInfo.outputPath('gallery-poster.png') })

	await expect(slide(page)).toHaveAttribute('data-open', '', {
		timeout: 120_000
	})
	const poster = page.locator('.vectreal-slide__poster')
	await expect(poster).toHaveCSS('opacity', '0')
	const posterTakesFocus = await poster.evaluate((button) => {
		button.focus()
		return document.activeElement === button
	})
	expect(posterTakesFocus).toBe(false)

	const start = inScene(page).getByRole('button', { name: 'Zum Drehen tippen' })
	await expect(start).toBeVisible({ timeout: 120_000 })
	await page.waitForTimeout(1_500)
	await page.screenshot({ path: testInfo.outputPath('gallery-waiting.png') })

	await start.tap()
	await expect(
		inScene(page).getByRole('button', {
			name: 'Fertig gedreht, zurück zum Scrollen'
		})
	).toBeVisible()
	await page.screenshot({ path: testInfo.outputPath('gallery-started.png') })
})

test('swipes move the gallery until the scene is tapped, and again after Fertig', async ({
	page,
	browserName
}) => {
	test.skip(browserName !== 'chromium', 'touch swipes need CDP')

	await page.goto('/')
	await showSlide(page)
	const start = inScene(page).getByRole('button', { name: 'Zum Drehen tippen' })
	await expect(start).toBeVisible({ timeout: 120_000 })

	const onSlide = await galleryScroll(page)
	await swipeAcrossSlide(page)
	expect(await galleryScroll(page)).toBeGreaterThan(onSlide)

	await showSlideAgain(page, onSlide)
	await start.tap()
	await swipeAcrossSlide(page)
	expect(await galleryScroll(page)).toBe(onSlide)

	await inScene(page)
		.getByRole('button', { name: 'Fertig gedreht, zurück zum Scrollen' })
		.tap()
	await expect(start).toBeVisible()
	await swipeAcrossSlide(page)
	expect(await galleryScroll(page)).toBeGreaterThan(onSlide)
})

test('a browser that asks to save data loads the slide only when the shopper opens it', async ({
	page
}) => {
	await page.addInitScript(() =>
		Object.defineProperty(navigator, 'connection', {
			value: { saveData: true }
		})
	)
	await page.goto('/')
	await page.waitForLoadState('load')
	await page.waitForTimeout(3_000)
	await expect(scene(page)).not.toHaveAttribute('src', /.+/)

	await showSlide(page)
	await page.locator('.vectreal-slide__poster').tap()
	await expect(scene(page)).toHaveAttribute('src', /\/embed\//)
})
