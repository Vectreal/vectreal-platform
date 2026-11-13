import { expect, type Page, test } from '@playwright/test'

/*
  The gallery slide and the tour section in Horizon, the theme Savor runs
  on, rendered from Horizon's own snippets with the slide's documented
  install lines added. SHOPIFY_HARNESS_EMBED_URL names a scene published with
  Start moving set to "After a tap" and the button language Deutsch.
*/

/** The harness product's media, as Horizon lists it: two photos, then Shopify's 3D slot. */
const MEDIA = [
	{ id: '101', image: '/product-hero.jpg' },
	{ id: '102', image: '/product-detail.jpg' },
	{ id: '103', image: '/product-context.jpg' }
]

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 750

const carousel = (page: Page) =>
	page.locator('media-gallery slideshow-component')
const slides = (page: Page) => carousel(page).locator('slideshow-slide')
const scroller = (page: Page) => carousel(page).locator('slideshow-slides')
/** The slide this layout shows: the carousel's, or the desktop grid's. */
const slide = (page: Page) =>
	page.locator('vectreal-media').filter({ visible: true })
const inScene = (page: Page) =>
	slide(page).locator('.vectreal-slide__scene').contentFrame()

/** What each item of a list shows: a media id, or `vectreal` for the scene. */
const contents = (items: ReturnType<Page['locator']>) =>
	items.evaluateAll((elements) =>
		elements.map((element) =>
			element.querySelector('vectreal-media')
				? 'vectreal'
				: element
						.querySelector('.product-media[data-media-id]')
						?.getAttribute('data-media-id')
		)
	)

/** Brings the scene's slide into view with the gallery's own controls. */
async function showSlide(page: Page, presentation: string) {
	if (presentation === 'grid' && isDesktop(page)) {
		await slide(page).scrollIntoViewIfNeeded()
	} else if (isDesktop(page)) {
		const next = carousel(page)
			.locator('slideshow-arrows .slideshow-control--next')
			.filter({ visible: true })
		for (let step = 0; step < MEDIA.length; step++) await next.click()
	} else {
		await carousel(page)
			.locator('.slideshow-controls__dots button')
			.filter({ visible: true })
			.last()
			.click()
	}
	await expect(slide(page)).toBeInViewport({ ratio: 0.9 })
}

/**
 * A real touch swipe across the middle of the slide, through the compositor
 * as a finger's would go. It drags right, back to the photos: the slide is
 * the last one, so that is the only way off it. Chromium only.
 */
async function swipeAcrossSlide(page: Page) {
	const box = await slide(page).locator('.vectreal-slide__scene').boundingBox()
	if (!box) throw new Error('the slide is not on screen')
	const session = await page.context().newCDPSession(page)
	await session.send('Input.synthesizeScrollGesture', {
		x: Math.round(box.x + box.width * 0.3),
		y: Math.round(box.y + box.height / 2),
		xDistance: Math.round(box.width * 0.5),
		yDistance: 0,
		gestureSourceType: 'touch',
		speed: 800
	})
	await session.detach()
	await page.waitForTimeout(1_500)
}

const galleryScroll = (page: Page) =>
	scroller(page).evaluate((list) => list.scrollLeft)

/** Waits out Horizon's slide animation: a click during it can go unheard. */
async function settled(page: Page) {
	let last = Number.NaN
	await expect
		.poll(async () => {
			const now = await galleryScroll(page)
			const still = now === last
			last = now
			return still
		})
		.toBe(true)
}

for (const presentation of ['carousel', 'grid']) {
	test.describe(`${presentation} presentation`, () => {
		test('the slide comes after the photos and Shopify’s 3D slot, which keep their places', async ({
			page
		}) => {
			await page.goto(`/horizon?presentation=${presentation}`)
			const media = [...MEDIA.map((item) => item.id), 'vectreal']
			expect(await contents(slides(page))).toEqual(media)

			if (presentation === 'grid') {
				const items = page.locator('.media-gallery__grid > li')
				expect(await contents(items)).toEqual(media)
				// Zoom counts the grid's media refs: the scene adds none.
				await expect(
					page.locator('.media-gallery__grid > li[ref="media[]"]')
				).toHaveCount(MEDIA.length)
				const zooms = await page
					.locator('.media-gallery__grid [on\\:click^="/zoom/"]')
					.evaluateAll((buttons) =>
						buttons.map((button) => button.getAttribute('on:click'))
					)
				expect(zooms).toEqual(['/zoom/0', '/zoom/1'])
			}

			// The template's controls: a counter on desktop, dots on phones.
			if (presentation === 'carousel' && isDesktop(page)) {
				await expect(
					carousel(page)
						.locator('.slideshow-controls__counter')
						.filter({ visible: true })
				).toHaveText(/1\s*\/\s*4$/)
			}
			if (!isDesktop(page)) {
				const dots = carousel(page)
					.locator('.slideshow-controls__dots button')
					.filter({ visible: true })
				await expect(dots).toHaveCount(4)
				await dots.last().click()
				await expect(slides(page).last()).toHaveAttribute(
					'aria-hidden',
					'false'
				)
				await expect(dots.last()).toHaveAttribute('aria-selected', 'true')
				await dots.first().click()
				await expect(slides(page).first()).toHaveAttribute(
					'aria-hidden',
					'false'
				)
				await expect(dots.last()).toHaveAttribute('aria-selected', 'false')
			}
		})

		test('the slide shows its poster, then the scene, waiting for a tap', async ({
			page
		}, testInfo) => {
			await page.goto(`/horizon?presentation=${presentation}`)
			await showSlide(page, presentation)
			await page.screenshot({
				path: testInfo.outputPath(`horizon-${presentation}-poster.png`)
			})

			await expect(slide(page)).toHaveAttribute('data-open', '', {
				timeout: 120_000
			})
			const start = inScene(page).getByRole('button', {
				name: /Zum Drehen (tippen|klicken)/
			})
			await expect(start).toBeVisible({ timeout: 120_000 })
			await page.waitForTimeout(1_500)
			await page.screenshot({
				path: testInfo.outputPath(`horizon-${presentation}-waiting.png`)
			})
		})
	})
}

test('thumbnails point at their own media, and the scene’s at the scene', async ({
	page
}, testInfo) => {
	await page.goto('/horizon?presentation=carousel&controls=thumbnails')
	const thumbnails = carousel(page)
		.locator('.slideshow-controls__thumbnail')
		.filter({ visible: true })
	await expect(thumbnails).toHaveCount(MEDIA.length + 1)

	const images = await thumbnails.evaluateAll((buttons) =>
		buttons.map((button) => button.querySelector('img')?.getAttribute('src'))
	)
	MEDIA.forEach(({ image }, index) => expect(images[index]).toContain(image))
	// No poster metafield: the product's featured image stands in.
	expect(images[MEDIA.length]).toContain(MEDIA[0].image)
	await expect(
		thumbnails.last().locator('.slideshow-controls__thumbnail-badge svg')
	).toBeAttached()

	for (const index of [3, 0, 2, 1, 3]) {
		// Horizon now and then drops a click that lands during a jump of
		// several slides, between photos as much as to the scene; a shopper
		// clicks again.
		await expect(async () => {
			await thumbnails.nth(index).click()
			await expect(slides(page).nth(index)).toHaveAttribute(
				'aria-hidden',
				'false',
				{ timeout: 3_000 }
			)
		}).toPass()
		await expect(thumbnails.nth(index)).toHaveAttribute('aria-selected', 'true')
		await expect(slides(page).nth(index)).toBeInViewport({ ratio: 0.9 })
		await settled(page)
	}
	await page.screenshot({
		path: testInfo.outputPath('horizon-carousel-thumbnails.png')
	})
})

test('with a single photo, the slide follows it and Horizon shows no controls', async ({
	page
}) => {
	await page.goto('/horizon?presentation=carousel&controls=thumbnails&media=1')
	expect(await contents(slides(page))).toEqual([MEDIA[0].id, 'vectreal'])
	await expect(carousel(page).locator('slideshow-controls')).toHaveCount(0)
	await expect(carousel(page).locator('[data-vectreal-control]')).toHaveCount(0)
	if (!isDesktop(page)) {
		await scroller(page).evaluate((list) =>
			list.scrollTo({ left: list.scrollWidth, behavior: 'instant' })
		)
		await expect(slide(page)).toBeInViewport({ ratio: 0.9 })
	}
})

test('swipes move the gallery past the slide until the scene is tapped, and again after Fertig', async ({
	page,
	browserName
}) => {
	test.skip(browserName !== 'chromium', 'touch swipes need CDP')
	test.skip(isDesktop(page), 'the carousel swipes on phones')

	await page.goto('/horizon?presentation=carousel')
	await showSlide(page, 'carousel')
	const start = inScene(page).getByRole('button', { name: 'Zum Drehen tippen' })
	await expect(start).toBeVisible({ timeout: 120_000 })

	const onSlide = await galleryScroll(page)
	await swipeAcrossSlide(page)
	expect(await galleryScroll(page)).toBeLessThan(onSlide)

	await showSlide(page, 'carousel')
	await start.tap()
	await swipeAcrossSlide(page)
	expect(await galleryScroll(page)).toBe(onSlide)

	await inScene(page)
		.getByRole('button', { name: 'Fertig gedreht, zurück zum Scrollen' })
		.tap()
	await expect(start).toBeVisible()
	await swipeAcrossSlide(page)
	expect(await galleryScroll(page)).toBeLessThan(onSlide)
})

/**
 * Each theme's content column, which the tour's frame should settle to: the
 * box a page-width section gives its content, here the harness footer's.
 */
const THEMES = [
	{ name: 'Dawn', path: '/', column: '.harness-footer .page-width' },
	{ name: 'Horizon', path: '/horizon', column: '.harness-footer > p' }
]

for (const theme of THEMES) {
	test(`in ${theme.name}, the tour's frame settles to the page's content column`, async ({
		page
	}, testInfo) => {
		await page.goto(theme.path)
		const column = await page
			.locator(theme.column)
			.first()
			.evaluate((element) => {
				const style = getComputedStyle(element)
				return (
					element.clientWidth -
					parseFloat(style.paddingLeft) -
					parseFloat(style.paddingRight)
				)
			})
		const tour = page.locator('vectreal-scene-tour')
		await tour.scrollIntoViewIfNeeded()
		await expect
			.poll(() =>
				tour.evaluate((element) => {
					const rest = parseFloat(
						getComputedStyle(element).getPropertyValue('--vectreal-tour-rest')
					)
					const runway = element.querySelector('.vectreal-tour__runway')
					return rest * (runway?.clientWidth ?? 0)
				})
			)
			.toBeCloseTo(column, -1)
		await page.screenshot({
			path: testInfo.outputPath(`${theme.name.toLowerCase()}-tour.png`)
		})
	})
}
