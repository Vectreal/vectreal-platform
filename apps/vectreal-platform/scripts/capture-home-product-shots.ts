/**
 * Captures the product window's two app views, in both themes, and where the
 * home page's live camera goes in each.
 *
 * Run via: pnpm nx run vectreal-platform:capture-product-shots
 *
 * Needs the dev server (`pnpm nx dev vectreal-platform`) and the local
 * Supabase stack. Prepare needs no account. Manage is a dashboard page, so it
 * needs a signed-in user in your LOCAL database: CAPTURE_EMAIL and
 * CAPTURE_PASSWORD sign in headless, and CAPTURE_SIGN_IN=browser opens a
 * window to sign in by hand, for an account with social sign-in. Without
 * either, Manage is skipped. Local sign-in uses Cloudflare's always-pass
 * Turnstile keys, so it works headless.
 *
 * It refuses any origin other than localhost. These frames are shown to every
 * visitor, so what is in them has to be data you made to be looked at, and
 * production data never is.
 *
 * The window shows these screenshots with the hero's camera live on top, moving
 * from view to view: it stands in the publisher's viewport, then shrinks into
 * its scene card on the dashboard. So each capture hides the one thing the live
 * camera replaces, the viewer canvas and the scene's thumbnail, and records
 * where it was, into `app/components/home/product-shots.json`. Everything else
 * in the frame is the app as it renders.
 *
 * Manage needs a recent scene named "camera", made from the camera sample, or
 * name another with CAPTURE_MANAGE_SCENE.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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
const OUTPUT_DIR = path.resolve(scriptDir, '../app/assets/home/product')
const STAGES_FILE = path.resolve(
	scriptDir,
	'../app/components/home/product-shots.json'
)

const BASE_URL = process.env.CAPTURE_BASE_URL ?? 'http://localhost:4200'

/*
  1200 x 750 CSS pixels at 2x: the 2400 x 1500 frame the page lays out at
  16:10, sharp on a retina screen at the width the product window renders.
*/
const VIEWPORT = { width: 1200, height: 750 }
const SCALE = 2

const THEMES: Exclude<ThemeMode, 'system'>[] = ['light', 'dark']

type View = 'prepare' | 'manage'

/** A box as fractions of the frame, so the page can place it at any size. */
interface Rect {
	x: number
	y: number
	w: number
	h: number
}

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
	theme: Exclude<ThemeMode, 'system'>,
	session: Session | null
) {
	const context = await browser.newContext({
		viewport: VIEWPORT,
		deviceScaleFactor: SCALE,
		colorScheme: theme,
		reducedMotion: 'reduce',
		storageState: session ?? undefined
	})
	const { hostname } = new URL(BASE_URL)

	// tsx compiles this file keeping function names, which wraps each named
	// helper in `__name()`. Functions sent into the page carry those calls, and
	// the page has no `__name`, so it is given a no-op one.
	await context.addInitScript('window.__name = (fn) => fn')

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

function toRect(box: { x: number; y: number; width: number; height: number }) {
	const round = (v: number) => Math.round(v * 10_000) / 10_000
	return {
		x: round(box.x / VIEWPORT.width),
		y: round(box.y / VIEWPORT.height),
		w: round(box.width / VIEWPORT.width),
		h: round(box.height / VIEWPORT.height)
	}
}

/*
  Chromium refuses a screenshot ("Unable to capture screenshot") while the page
  has no frame to give, such as mid-navigation: the dashboard can revalidate or
  refresh its session just after it loads. Each attempt waits for the page to
  settle and for a painted frame first.
*/
async function screenshot(page: Page) {
	for (let attempt = 1; ; attempt++) {
		await page.waitForLoadState('networkidle')
		// Thumbnails load lazily, after the network has gone quiet once, so every image in view is waited for.
		await page.waitForFunction(
			() =>
				[...document.images]
					.filter((image) => {
						const box = image.getBoundingClientRect()
						return (
							box.bottom > 0 &&
							box.top < window.innerHeight &&
							getComputedStyle(image).visibility !== 'hidden'
						)
					})
					.every((image) => image.complete && image.naturalWidth > 0),
			null,
			{ timeout: 20_000 }
		)
		await page.evaluate(
			() => new Promise((resolve) => requestAnimationFrame(resolve))
		)
		try {
			return await page.screenshot({ type: 'png', animations: 'disabled' })
		} catch (error) {
			if (attempt === 3)
				throw new Error(`Could not capture ${page.url()}`, { cause: error })
			console.log(`  screenshot of ${page.url()} failed, retrying`)
			await page.waitForTimeout(1500)
		}
	}
}

async function save(page: Page, view: View, theme: string) {
	const png = await screenshot(page)
	const file = path.join(OUTPUT_DIR, `${view}-${theme}.webp`)
	await sharp(png).webp({ quality: 86 }).toFile(file)
	console.log(`  wrote ${path.relative(process.cwd(), file)}`)
}

/**
 * Prepare: the publisher with the camera sample loaded and its optimization
 * presets open, as anyone sees it. The canvas is hidden for the shot. The stage
 * is the part of it no panel covers, found by asking the page what is on top
 * along the canvas's middle, so it holds however the panels are laid out.
 */
async function capturePrepare(context: BrowserContext, theme: string) {
	const page = await context.newPage()
	await page.goto(`${BASE_URL}/publisher`)
	await page.getByRole('button', { name: /Camera/ }).click()
	const canvas = page.locator('canvas').first()
	await canvas.waitFor({ state: 'visible' })
	await page.waitForTimeout(3000)

	// The optimizer, with its result: this view is about what preparing a file
	// does to it. The camera the page puts in this viewport is the Balanced
	// result, so the drawer shows the preset applied to this very file. The
	// size line on the publish card opens the drawer on its own, leaving the
	// rest of the viewport free for the stage.
	await page.getByRole('button', { name: /MB · / }).click()
	await page.getByRole('button', { name: 'Apply Optimizations' }).click()
	await page
		.getByText('Optimization result', { exact: false })
		.waitFor({ timeout: 180_000 })
	await page.waitForTimeout(2000)

	const box = await canvas.evaluate((node) => {
		const r = node.getBoundingClientRect()
		const open = (x: number, y: number) =>
			document.elementFromPoint(x, y) === node
		const middle = r.top + r.height / 2
		let best = { from: 0, to: 0 }
		let from: number | null = null
		for (let x = Math.ceil(r.left); x <= Math.floor(r.right); x++) {
			const clear = open(x, middle) && x < Math.floor(r.right)
			if (clear) from ??= x
			else if (from !== null) {
				if (x - from > best.to - best.from) best = { from, to: x }
				from = null
			}
		}
		// Then down several columns of that span, so a card in one corner is left out too.
		let top = r.top
		let bottom = r.bottom
		for (let i = 1; i <= 7; i++) {
			const x = best.from + ((best.to - best.from) * i) / 8
			let y = middle
			while (y > top && open(x, y - 1)) y--
			top = y
			y = middle
			while (y < bottom && open(x, y + 1)) y++
			bottom = y
		}
		node.style.visibility = 'hidden'
		return {
			x: best.from,
			y: top,
			width: best.to - best.from,
			height: bottom - top
		}
	})
	if (box.width < 100 || box.height < 100)
		throw new Error(
			`The publisher left no room for the stage: ${JSON.stringify(box)}`
		)
	await save(page, 'prepare', theme)
	await page.close()
	return toRect(box)
}

type Session = Awaited<ReturnType<BrowserContext['storageState']>>

/**
 * A signed-in session for the dashboard, kept in memory and never written out.
 *
 * With CAPTURE_EMAIL and CAPTURE_PASSWORD it signs in headless. With
 * CAPTURE_SIGN_IN=browser it opens a visible window on the sign-in page and
 * waits for you to sign in there, by whatever method your account uses,
 * social sign-in included: the script never sees how. Otherwise there is no
 * session, and only Prepare is captured.
 */
async function signedInSession(): Promise<Session | null> {
	const email = process.env.CAPTURE_EMAIL
	const password = process.env.CAPTURE_PASSWORD
	if (email && password) {
		const browser = await chromium.launch()
		try {
			const context = await browser.newContext()
			const page = await context.newPage()
			await page.goto(`${BASE_URL}/sign-in`)
			await page.locator('#email').fill(email)
			await page.locator('#password').fill(password)
			await page.locator('button[type="submit"]').click()
			await page.waitForURL(/\/dashboard/)
			return await context.storageState()
		} finally {
			await browser.close()
		}
	}

	if (process.env.CAPTURE_SIGN_IN === 'browser') {
		// Launched without the automation flags, which some identity providers refuse to sign in.
		const browser = await chromium.launch({
			headless: false,
			ignoreDefaultArgs: ['--enable-automation'],
			args: ['--disable-blink-features=AutomationControlled']
		})
		try {
			const context = await browser.newContext({ viewport: VIEWPORT })
			const page = await context.newPage()
			await page.goto(`${BASE_URL}/sign-in`)
			console.log(
				'Sign in in the window that opened. Waiting up to 10 minutes.'
			)
			await page.waitForURL(
				(url) =>
					url.origin === new URL(BASE_URL).origin &&
					url.pathname.startsWith('/dashboard'),
				{ timeout: 600_000 }
			)
			return await context.storageState()
		} finally {
			await browser.close()
		}
	}

	console.log(
		'No sign-in given (CAPTURE_EMAIL and CAPTURE_PASSWORD, or CAPTURE_SIGN_IN=browser): capturing Prepare only.'
	)
	return null
}

/**
 * Manage: the dashboard overview, with the camera's scene among the recent
 * work. Its thumbnail is blanked for the shot and its box recorded: the live
 * camera shrinks into it. CAPTURE_MANAGE_PATH pins a different page.
 */
async function captureManage(context: BrowserContext, theme: string) {
	const page = await context.newPage()

	await page.goto(
		`${BASE_URL}${process.env.CAPTURE_MANAGE_PATH ?? '/dashboard'}`
	)
	await page.waitForLoadState('networkidle')

	/*
	  The overview features the most recently edited scene under "Jump back in",
	  with the other recent ones as cards below. The camera's thumbnail is taken
	  from the featured band when it is the one featured, and from its card when
	  it is not.
	*/
	const name = process.env.CAPTURE_MANAGE_SCENE ?? 'camera'
	const featured = page
		.locator('section')
		.filter({ has: page.getByText('Jump back in') })
		.filter({ has: page.getByRole('heading', { name, exact: true }) })
	const card = page
		.locator('.group\\/card')
		.filter({ has: page.getByText(name, { exact: true }) })
	const thumbnail = (await featured.count())
		? featured.locator('div.relative > div').first()
		: (await card.count())
			? card.first().locator('a > div').first()
			: null
	if (!thumbnail)
		throw new Error(
			`No scene named "${name}" among the recent scenes on ${page.url()}. Open it in the publisher once so it is recent, or set CAPTURE_MANAGE_SCENE.`
		)
	const box = await thumbnail.boundingBox()
	if (!box) throw new Error(`The "${name}" card has no thumbnail to replace.`)
	await thumbnail.evaluate((node) => {
		for (const child of node.children)
			(child as HTMLElement).style.visibility = 'hidden'
	})
	await save(page, 'manage', theme)
	await page.close()
	return toRect(box)
}

/** Both themes must put the stage in one place: the page reads one box per view. */
function assertSameRect(view: View, a: Rect, b: Rect) {
	const off = Math.max(
		Math.abs(a.x - b.x),
		Math.abs(a.y - b.y),
		Math.abs(a.w - b.w),
		Math.abs(a.h - b.h)
	)
	if (off > 0.004)
		throw new Error(
			`${view}: the stage is ${JSON.stringify(a)} in one theme and ${JSON.stringify(b)} in the other.`
		)
}

async function main() {
	assertLocalOrigin(BASE_URL)
	await mkdir(OUTPUT_DIR, { recursive: true })

	const session = await signedInSession()

	// A Prepare-only run keeps the Manage box an earlier run recorded.
	const stages: Partial<Record<View, Rect>> = JSON.parse(
		await readFile(STAGES_FILE, 'utf8').catch(() => '{}')
	)
	const browser = await chromium.launch()
	try {
		for (const [i, theme] of THEMES.entries()) {
			console.log(`${theme}:`)
			const context = await newThemedContext(browser, theme, session)
			const found: Partial<Record<View, Rect>> = {
				prepare: await capturePrepare(context, theme)
			}
			if (session) found.manage = await captureManage(context, theme)
			for (const [view, rect] of Object.entries(found) as [View, Rect][]) {
				if (i === 0) stages[view] = rect
				else assertSameRect(view, stages[view] as Rect, rect)
			}
			await context.close()
		}
	} finally {
		await browser.close()
	}
	await writeFile(STAGES_FILE, `${JSON.stringify(stages, null, '\t')}\n`)
	console.log(`  wrote ${path.relative(process.cwd(), STAGES_FILE)}`)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
