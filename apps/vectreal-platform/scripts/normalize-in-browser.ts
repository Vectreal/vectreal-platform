import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { chromium } from '@playwright/test'

import type { NormalizeReport } from '../app/lib/normalize-model/normalize-model-shared'
import type { NormalizePageResult } from '../app/routes/normalize-model-page'

const BASE_URL = process.env.NORMALIZE_BASE_URL ?? 'http://localhost:4200'
const TIMEOUT_MS = 10 * 60 * 1000

/**
 * Runs `app/lib/normalize-model` on one GLB in the dev server's `/__normalize`
 * page, in headless Chromium, and writes `<name>.glb`, `<name>.usdz` and
 * `<name>.report.json` into `out`, whether or not the result fits the budget.
 */
export async function normalizeInBrowser({
	input,
	out,
	longestEdgeCm
}: {
	input: string
	out: string
	longestEdgeCm?: number
}): Promise<{ name: string; glb: string; report: NormalizeReport }> {
	const name = path.basename(input, path.extname(input))

	const url = new URL('/__normalize', BASE_URL)
	if (longestEdgeCm !== undefined) {
		url.searchParams.set('longestEdgeMeters', String(longestEdgeCm / 100))
	}

	const browser = await chromium.launch()
	let result: NormalizePageResult
	try {
		const page = await browser.newPage()
		await page.goto(url.toString())
		await page.setInputFiles('[data-normalize-input="ready"]', input)
		const handle = await page.waitForFunction(
			() => window.__normalizeResult,
			undefined,
			{ timeout: TIMEOUT_MS, polling: 500 }
		)
		result = (await handle.jsonValue()) as NormalizePageResult
	} finally {
		await browser.close()
	}

	if (!result.ok) throw new Error(`Normalizing ${name} failed: ${result.error}`)

	await mkdir(out, { recursive: true })
	const glb = path.join(out, `${name}.glb`)
	await writeFile(glb, Buffer.from(result.glb, 'base64'))
	await writeFile(
		path.join(out, `${name}.usdz`),
		Buffer.from(result.usdz, 'base64')
	)
	await writeFile(
		path.join(out, `${name}.report.json`),
		`${JSON.stringify(result.report, null, '\t')}\n`
	)
	return { name, glb, report: result.report }
}
