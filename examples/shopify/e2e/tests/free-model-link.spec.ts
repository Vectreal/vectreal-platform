import { expect, type Page, test } from '@playwright/test'

const freeModelLink = async (page: Page, search: string) => {
	await page.goto(`/${search}`)
	const link = page.getByRole('link', { name: 'Kostenloses Modell anfragen' })
	await expect(link).toBeVisible()
	return new URL((await link.getAttribute('href')) ?? '')
}

test('a letter code on the product page is carried to the free-model form, uppercased', async ({
	page
}) => {
	const url = await freeModelLink(page, '?c=k7q2m9ab')
	expect(url.origin + url.pathname).toBe('https://vectreal.com/free-model')
	expect(url.searchParams.get('lang')).toBe('de')
	expect(url.searchParams.get('c')).toBe('K7Q2M9AB')
})

test('a malformed code is dropped and the link stays plain', async ({
	page
}) => {
	// O, I and L are outside the alphabet; the others are the wrong length.
	for (const code of ['K7Q2M9AO', 'K7Q2M9A', 'K7Q2M9ABC', '<b>x</b>']) {
		const url = await freeModelLink(page, `?c=${encodeURIComponent(code)}`)
		expect(url.searchParams.has('c'), code).toBe(false)
		expect(url.searchParams.get('lang')).toBe('de')
	}
})

test('without a code the link stays plain', async ({ page }) => {
	const url = await freeModelLink(page, '')
	expect([...url.searchParams.keys()]).toEqual(['lang'])
})
