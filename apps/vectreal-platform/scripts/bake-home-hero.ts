/**
 * Bakes the home hero's static assets from the stage that draws them live.
 *
 * Run via: pnpm nx run vectreal-platform:bake-home-hero
 *
 * Needs the dev server (`pnpm nx dev vectreal-platform`): it opens the home
 * page with `?hero-bake`, where the stage draws the hero model's elevation
 * whole and unfaded and bakes its shadow live, and reads both back.
 *
 * Writes, into `app/assets/home/`:
 * - `camera-drawing-sheet.webp` and `camera-drawing-fold.webp`: the elevation
 *   as line coverage in the alpha channel, one per framing, because the wide
 *   sheet and the folded card frame the model differently.
 * - `camera-shadow.webp`: the directional shadow as a density image.
 *
 * Then prints each poster's ink bounds. Those go into `HERO_POSTERS` in
 * `app/components/home/hero/hero-assets.ts` by hand: the plot travels across
 * them, so they must match the file.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'
import sharp from 'sharp'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.resolve(scriptDir, '../app/assets/home')
const BASE_URL = process.env.BAKE_BASE_URL ?? 'http://localhost:4200'

// The wide sheet, and the folded card below 1100px. The frame's size follows from the layout.
const FRAMINGS = [
	{ name: 'sheet', viewport: { width: 1600, height: 1000 } },
	{ name: 'fold', viewport: { width: 720, height: 1000 } }
] as const

/** Alpha above which a pixel counts as ink when measuring the drawing's extent. */
const INK_ALPHA = 8

const fromDataUrl = (url: string) =>
	Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')

/**
 * The drawing as a mask: black, with the line coverage as alpha, so the page
 * can fill it with whatever ink the theme uses. And where the lines lie, as
 * fractions of the frame.
 */
async function toPoster(png: Buffer, file: string) {
	const { data, info } = await sharp(png)
		.ensureAlpha()
		.extractChannel('alpha')
		.raw()
		.toBuffer({ resolveWithObject: true })
	let l = info.width
	let r = 0
	let t = info.height
	let b = 0
	for (let y = 0; y < info.height; y++) {
		for (let x = 0; x < info.width; x++) {
			if (data[y * info.width + x] <= INK_ALPHA) continue
			l = Math.min(l, x)
			r = Math.max(r, x + 1)
			t = Math.min(t, y)
			b = Math.max(b, y + 1)
		}
	}
	if (r <= l) throw new Error(`${file}: the frame holds no drawing`)

	const black = Buffer.alloc(info.width * info.height * 3)
	await sharp(black, {
		raw: { width: info.width, height: info.height, channels: 3 }
	})
		.joinChannel(data, {
			raw: { width: info.width, height: info.height, channels: 1 }
		})
		.webp({ quality: 80, alphaQuality: 90 })
		.toFile(path.join(OUTPUT_DIR, file))

	const round = (v: number) => Math.round(v * 10_000) / 10_000
	return {
		l: round(l / info.width),
		r: round(r / info.width),
		t: round(t / info.height),
		b: round(b / info.height)
	}
}

async function main() {
	const { hostname } = new URL(BASE_URL)
	if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
		throw new Error(
			`Refusing to bake from ${hostname}: bake mode exists on the dev server only.`
		)
	}

	const browser = await chromium.launch({ args: ['--use-gl=angle'] })
	try {
		for (const [i, framing] of FRAMINGS.entries()) {
			const context = await browser.newContext({
				viewport: framing.viewport,
				deviceScaleFactor: 2
			})
			const page = await context.newPage()
			await page.goto(`${BASE_URL}/?hero-bake`)
			await page.waitForFunction(() => '__heroBake' in window, null, {
				timeout: 120_000
			})

			const { poster, shadow } = await page.evaluate(() => {
				const bake = (
					window as unknown as {
						__heroBake: { poster: () => string; shadow: () => string | null }
					}
				).__heroBake
				return { poster: bake.poster(), shadow: bake.shadow() }
			})

			const file = `camera-drawing-${framing.name}.webp`
			const ink = await toPoster(fromDataUrl(poster), file)
			console.log(`  wrote ${file}  ink: ${JSON.stringify(ink)}`)

			// The shadow does not depend on the framing, so one pass writes it.
			if (i === 0) {
				if (!shadow) throw new Error('The stage baked no shadow')
				await sharp(fromDataUrl(shadow))
					.webp({ quality: 90 })
					.toFile(path.join(OUTPUT_DIR, 'camera-shadow.webp'))
				console.log('  wrote camera-shadow.webp')
			}
			await context.close()
		}
	} finally {
		await browser.close()
	}
	console.log(
		'\nCopy the ink bounds above into HERO_POSTERS in app/components/home/hero/hero-assets.ts.'
	)
}

main().catch((error: unknown) => {
	console.error(error)
	process.exit(1)
})
