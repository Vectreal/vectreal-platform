import { expect, type Page, test } from '@playwright/test'

const slide = (page: Page) => page.locator('vectreal-media')
const scene = (page: Page) => page.locator('.vectreal-slide__scene')

async function showSlide(page: Page) {
	await page.locator('.slider-button--next').first().tap()
	await expect(slide(page)).toBeInViewport({ ratio: 0.9 })
}

test('the gallery slide shows its poster, loads the scene once the page is idle, and opens it on tap', async ({
	page
}, testInfo) => {
	await page.goto('/')
	await expect(scene(page)).toHaveAttribute('src', /\/embed\//)

	await showSlide(page)
	const open = page.locator('.vectreal-slide__poster')
	await expect(open).toBeVisible()
	await expect(open.getByText('3D-Ansicht öffnen')).toBeAttached()
	await page.screenshot({ path: testInfo.outputPath('gallery-poster.png') })

	await open.tap()
	await expect(slide(page)).toHaveAttribute('data-open')
	await expect(open).toHaveCSS('opacity', '0')
	const posterTakesFocus = await open.evaluate((poster) => {
		poster.focus()
		return document.activeElement === poster
	})
	expect(posterTakesFocus).toBe(false)
	await expect(
		page
			.frameLocator('.vectreal-slide__scene')
			.getByRole('button', { name: 'Next camera' })
	).toBeVisible({ timeout: 120_000 })
	await page.waitForTimeout(1_500)
	await page.screenshot({ path: testInfo.outputPath('gallery-open.png') })
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
