/**
 * Renders the Lighting tool's thumbnails: one per lighting setup and one per
 * environment map, written as small WebP files with a transparent background.
 *
 * Run via: pnpm nx run vectreal-platform:render-lighting-thumbnails
 *
 * Needs Storybook running (`pnpm nx storybook storybook`, or set
 * STORYBOOK_URL). Each thumbnail is the `Viewer/Lighting reference` story
 * captured through `@vctrl/viewer` itself, so it matches what the viewer
 * draws, tone mapping included. Rerun it whenever a setup or a hosted map
 * changes; `lighting-thumbnails.spec.ts` fails while any is missing.
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, type Page } from '@playwright/test'
import { ENVIRONMENT_KEYS, LIGHTING_SETUPS } from '@vctrl/core'
import sharp from 'sharp'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.resolve(scriptDir, '../public/media/images/lighting')
const STORYBOOK_URL = process.env.STORYBOOK_URL ?? 'http://localhost:6006'

/** The story's frame is 320 CSS pixels; written at this size, 2x a card. */
const OUTPUT_SIZE = 240

/*
  After the viewer reports the frame final it still converges at rest: it
  accumulates jittered samples for a moment before it stops drawing.
*/
const SETTLE_MS = 1500

/*
  Fades a setup's floor out before the frame's edge, so a long shadow ends
  softly inside the card instead of being cut by it. The balls sit well
  inside the opaque center.
*/
const EDGE_FADE = Buffer.from(
	`<svg xmlns="http://www.w3.org/2000/svg" width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE}">
		<defs><radialGradient id="f" cx="50%" cy="50%" r="50%">
			<stop offset="62%" stop-color="#fff" stop-opacity="1"/>
			<stop offset="100%" stop-color="#fff" stop-opacity="0"/>
		</radialGradient></defs>
		<rect width="100%" height="100%" fill="url(#f)"/>
	</svg>`
)

async function capture(
	page: Page,
	storyId: string,
	args: string,
	file: string,
	{ fadeEdges }: { fadeEdges: boolean }
) {
	await page.goto(
		`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story&args=${args}`
	)
	await page.waitForSelector(
		'body[data-reference-ready="true"], body[data-reference-error]',
		{ timeout: 60_000 }
	)
	const error = await page.evaluate(() => document.body.dataset.referenceError)
	if (error) throw new Error(`${storyId} ${args}: ${error}`)
	await page.waitForTimeout(SETTLE_MS)
	// Storybook paints its page; the thumbnail is the viewer's canvas alone.
	await page.addStyleTag({
		content:
			'html, body, #storybook-root, #storybook-root * { background: transparent !important; }'
	})
	const frame = await page.locator('#storybook-root > div').screenshot({
		omitBackground: true
	})
	const resized = sharp(frame).resize(OUTPUT_SIZE, OUTPUT_SIZE)
	const faded = fadeEdges
		? sharp(await resized.toBuffer()).composite([
				{ input: EDGE_FADE, blend: 'dest-in' }
			])
		: resized
	await faded.webp({ quality: 82, alphaQuality: 90 }).toFile(file)
	console.log(`wrote ${path.relative(process.cwd(), file)}`)
}

const browser = await chromium.launch({
	args: ['--use-angle=metal', '--enable-gpu']
})
try {
	const page = await browser.newPage({
		viewport: { width: 400, height: 400 },
		deviceScaleFactor: 2
	})

	await mkdir(path.join(OUTPUT_DIR, 'setups'), { recursive: true })
	for (const { id } of LIGHTING_SETUPS) {
		await capture(
			page,
			'viewer-lighting-reference--setup',
			`setup:${id}`,
			path.join(OUTPUT_DIR, 'setups', `${id}.webp`),
			{ fadeEdges: true }
		)
	}

	await mkdir(path.join(OUTPUT_DIR, 'environments'), { recursive: true })
	for (const key of ENVIRONMENT_KEYS) {
		await capture(
			page,
			'viewer-lighting-reference--environment',
			`map:${key}`,
			path.join(OUTPUT_DIR, 'environments', `${key}.webp`),
			{ fadeEdges: false }
		)
	}
} finally {
	await browser.close()
}
