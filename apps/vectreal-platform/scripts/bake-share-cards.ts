/**
 * Bakes the link previews (`og:image`) for the cards in `app/lib/share-cards.ts`.
 *
 * Run via: pnpm nx run vectreal-platform:bake-share-cards
 *
 * Needs the dev server (`pnpm nx dev vectreal-platform`, or BAKE_BASE_URL for
 * another port). Each card is drawn by `ShareCard` itself, served by the dev
 * server so it has the real wordmark, the site's fonts and the page heads'
 * drafting floor, and captured at 1200 by 630.
 *
 * Writes `public/media/images/share/<slug>.png` for every card, and
 * `app/lib/share-cards.baked.json`, the text each card was baked from.
 * `share-cards.spec.ts` compares that with the page copy, so a card whose page
 * has changed since fails until this is run again.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'
import sharp from 'sharp'

import {
	SHARE_CARD_SIZE,
	shareCardImagePath
} from '../app/lib/share-card-paths'
import { SHARE_CARDS } from '../app/lib/share-cards'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.resolve(scriptDir, '../public')
const BAKED_RECORD = path.resolve(
	scriptDir,
	'../app/lib/share-cards.baked.json'
)
const BASE_URL = process.env.BAKE_BASE_URL ?? 'http://localhost:4200'
const PAGE_URL = `${BASE_URL}/__share-card`

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL)) {
	throw new Error(
		`Refusing to bake against ${BASE_URL}: only a local dev server.`
	)
}

/*
  Served by the script, so no route has to exist for it. The dev server
  answers the module requests. Its React transform refuses to run without the
  refresh preamble a route's document installs, so this page loads the same
  one.
*/
const pageHtml = (card: unknown) => `<!doctype html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8" />
<script type="module" src="/@id/__x00__virtual:react-router/inject-hmr-runtime"></script>
<script>window.__SHARE_CARD__ = ${JSON.stringify(card)}</script>
<script type="module" src="/app/components/share-card/share-card-bake.tsx"></script>
<style>body { margin: 0 }</style>
</head>
<body><div id="root"></div></body>
</html>`

async function main(): Promise<void> {
	await mkdir(path.join(PUBLIC_DIR, path.dirname(shareCardImagePath('x'))), {
		recursive: true
	})

	const browser = await chromium.launch()
	const page = await browser.newPage({
		viewport: {
			width: SHARE_CARD_SIZE.width / 2,
			height: SHARE_CARD_SIZE.height / 2
		},
		deviceScaleFactor: 2,
		colorScheme: 'dark',
		reducedMotion: 'reduce'
	})

	let current: unknown
	await page.route(PAGE_URL, (route) =>
		route.fulfill({ contentType: 'text/html', body: pageHtml(current) })
	)

	const baked: Record<string, { eyebrow?: string; caption: string }> = {}

	try {
		for (const card of SHARE_CARDS) {
			current = card
			await page.goto(PAGE_URL)
			await page.waitForSelector('canvas[data-painted]', { timeout: 30_000 })

			const png = await page.locator('#root > div').screenshot()
			const { width, height } = await sharp(png).metadata()
			if (
				width !== SHARE_CARD_SIZE.width ||
				height !== SHARE_CARD_SIZE.height
			) {
				throw new Error(`${card.slug}: captured ${width}x${height}`)
			}

			// A palette PNG: about 70 KB, well under what chat apps fetch, and no JPEG blur on the floor's lines.
			await sharp(png)
				.png({ palette: true, quality: 90, effort: 10 })
				.toFile(path.join(PUBLIC_DIR, shareCardImagePath(card.slug)))

			baked[card.slug] = {
				...('eyebrow' in card ? { eyebrow: card.eyebrow } : {}),
				caption: card.caption
			}
			console.log(`  ${card.slug}`)
		}
	} finally {
		await browser.close()
	}

	await writeFile(BAKED_RECORD, `${JSON.stringify(baked, null, '\t')}\n`)
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error)
	process.exit(1)
})
