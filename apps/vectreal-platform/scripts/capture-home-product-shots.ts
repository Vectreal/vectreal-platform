/**
 * Captures the three product views the home page shows, in both themes.
 *
 * Run via: pnpm nx run vectreal-platform:capture-product-shots
 *
 * Needs the dev server (`pnpm nx dev vectreal-platform`) and the local
 * Supabase stack. Prepare needs no account. Manage and Embed are dashboard
 * pages, so they sign in with CAPTURE_EMAIL and CAPTURE_PASSWORD, a user in
 * your LOCAL database, and are skipped when those are unset. Local sign-in uses
 * Cloudflare's always-pass Turnstile keys, so it works headless.
 *
 * It refuses any origin other than localhost. These frames are shown to every
 * visitor, so what is in them has to be data you made to be looked at, and
 * production data never is.
 *
 * The output is the raw material. The frames on the page are composed from it
 * by hand and saved over these files under the same names, so rerunning this
 * overwrites a composite: rerun it when the interface has moved, and recompose.
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, type BrowserContext, type Page } from '@playwright/test'
import sharp from 'sharp'

import { CONSENT_POLICY_VERSION } from '../app/constants/consent-policy'
import {
	CONSENT_COOKIE_NAME,
	encodeConsentCookieValue
} from '../app/lib/consent/consent-cookie'
import {
	THEME_COOKIE_NAME,
	type ThemeMode
} from '../app/lib/theme/theme-cookie'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.resolve(scriptDir, '../public/assets/images/product')

const BASE_URL = process.env.CAPTURE_BASE_URL ?? 'http://localhost:4200'

/*
  1200 x 750 CSS pixels at 2x: the 2400 x 1500 frame the page lays out at
  16:10, sharp on a retina screen at the width the product window renders.
*/
const VIEWPORT = { width: 1200, height: 750 }
const SCALE = 2

const THEMES: Exclude<ThemeMode, 'system'>[] = ['light', 'dark']

type View = 'prepare' | 'manage' | 'embed'

function assertLocalOrigin(url: string) {
	const { hostname } = new URL(url)
	if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
		throw new Error(
			`Refusing to capture from ${hostname}: product shots come from a local stack only.`
		)
	}
}

async function newThemedContext(
	browser: Awaited<ReturnType<typeof chromium.launch>>,
	theme: Exclude<ThemeMode, 'system'>
) {
	const context = await browser.newContext({
		viewport: VIEWPORT,
		deviceScaleFactor: SCALE,
		colorScheme: theme,
		reducedMotion: 'reduce'
	})
	const { hostname } = new URL(BASE_URL)

	// Consent decided (necessary only) so no banner sits over the frame, and the
	// theme set the way the site's own toggle sets it.
	await context.addCookies([
		{
			name: CONSENT_COOKIE_NAME,
			value: encodeConsentCookieValue({
				version: CONSENT_POLICY_VERSION,
				choices: {
					necessary: true,
					functional: false,
					analytics: false,
					marketing: false
				}
			}),
			domain: hostname,
			path: '/'
		},
		{ name: THEME_COOKIE_NAME, value: theme, domain: hostname, path: '/' }
	])

	return context
}

async function save(page: Page, view: View, theme: string) {
	const png = await page.screenshot({ type: 'png' })
	const file = path.join(OUTPUT_DIR, `${view}-${theme}.webp`)
	await sharp(png).webp({ quality: 86 }).toFile(file)
	console.log(`  wrote ${path.relative(process.cwd(), file)}`)
}

/** Prepare: the publisher with the camera sample loaded, as anyone sees it. */
async function capturePrepare(context: BrowserContext, theme: string) {
	const page = await context.newPage()
	await page.goto(`${BASE_URL}/publisher`)
	await page.getByRole('button', { name: /Camera/ }).click()
	const canvas = page.locator('canvas').first()
	await canvas.waitFor({ state: 'visible' })
	// The viewer fits the camera and bakes its shadow after the first frames.
	await page.waitForTimeout(3000)

	// The opening view is straight on, which shows a product flat, as an elevation.
	// A short drag orbits it to three-quarters, the way a product is shot.
	const box = await canvas.boundingBox()
	if (box) {
		const x = box.x + box.width / 2
		const y = box.y + box.height / 2
		await page.mouse.move(x, y)
		await page.mouse.down()
		await page.mouse.move(x - 180, y - 40, { steps: 12 })
		await page.mouse.up()
	}

	// The optimization presets and the delivery size live behind the Publish
	// card, and they are what this view is about.
	await page.getByRole('button', { name: 'Open publishing panel' }).click()
	await page
		.getByRole('button', { name: /Optimization/ })
		.first()
		.click()
	await page.waitForTimeout(2000)
	await save(page, 'prepare', theme)
	await page.close()
}

async function signIn(page: Page, email: string, password: string) {
	await page.goto(`${BASE_URL}/sign-in`)
	await page.locator('#email').fill(email)
	await page.locator('#password').fill(password)
	await page.locator('button[type="submit"]').click()
	await page.waitForURL(/\/dashboard/)
}

/**
 * Manage: the first project's scene list. Embed: its first scene, where the
 * publish panel and the snippet live. Either can be pinned to a specific page
 * with CAPTURE_MANAGE_PATH or CAPTURE_EMBED_PATH.
 */
async function captureDashboard(
	context: BrowserContext,
	theme: string,
	email: string,
	password: string
) {
	const page = await context.newPage()
	await signIn(page, email, password)

	const managePath = process.env.CAPTURE_MANAGE_PATH
	if (managePath) {
		await page.goto(`${BASE_URL}${managePath}`)
	} else {
		await page.goto(`${BASE_URL}/dashboard/projects`)
		await page
			.locator('a[href^="/dashboard/projects/"]:not([href*="/edit"])')
			.first()
			.click()
		await page.waitForURL(/\/dashboard\/projects\/[^/]+$/)
	}
	await page.waitForLoadState('networkidle')
	await save(page, 'manage', theme)

	const embedPath = process.env.CAPTURE_EMBED_PATH
	if (embedPath) {
		await page.goto(`${BASE_URL}${embedPath}`)
	} else {
		const scenePath = await page.$$eval(
			'a[href^="/dashboard/projects/"]',
			(links) =>
				links
					.map((link) => link.getAttribute('href') ?? '')
					.find((href) =>
						/^\/dashboard\/projects\/[^/]+\/(?!edit$|folder\/)[^/]+$/.test(href)
					)
		)
		if (!scenePath)
			throw new Error('The first project has no scene to capture.')
		await page.goto(`${BASE_URL}${scenePath}`)
	}
	await page.waitForLoadState('networkidle')
	await save(page, 'embed', theme)
	await page.close()
}

async function main() {
	assertLocalOrigin(BASE_URL)
	await mkdir(OUTPUT_DIR, { recursive: true })

	const email = process.env.CAPTURE_EMAIL
	const password = process.env.CAPTURE_PASSWORD
	if (!email || !password) {
		console.log(
			'CAPTURE_EMAIL / CAPTURE_PASSWORD unset: capturing Prepare only.'
		)
	}

	const browser = await chromium.launch()
	try {
		for (const theme of THEMES) {
			console.log(`${theme}:`)
			const context = await newThemedContext(browser, theme)
			await capturePrepare(context, theme)
			if (email && password) {
				await captureDashboard(context, theme, email, password)
			}
			await context.close()
		}
	} finally {
		await browser.close()
	}
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
