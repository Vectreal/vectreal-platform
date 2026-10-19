/**
 * Normalizes one generated model before hand cleanup: placed on the ground at
 * the origin, at real size when given, with Draco geometry and WebP textures,
 * and a GLB and a USDZ that both fit the 15 MB budget.
 *
 * Run via:
 *   pnpm nx run vectreal-platform:normalize-model --in=<model.glb> --out=<dir> [--longest-edge-cm=<n>]
 *
 * Needs the dev server (`pnpm nx dev vectreal-platform`): Draco encoding and
 * the USDZ exporter need a browser, so this drives the dev-only `/__normalize`
 * page in headless Chromium, which runs `app/lib/normalize-model`.
 *
 * Writes `<name>.glb`, `<name>.usdz` and `<name>.report.json` into `--out`,
 * and exits 1 when no attempt fits the budget. The files are written either
 * way, so the report and the model can be looked at.
 *
 * Relative paths are read from the repository root.
 *
 *   --in=<path>              the generated GLB
 *   --out=<dir>              where the results go (created if missing)
 *   --longest-edge-cm=<n>    the product's longest real-world edge; omitted,
 *                            the model keeps its own size
 *
 * Environment: NORMALIZE_BASE_URL (default http://localhost:4200).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { chromium } from '@playwright/test'

import { MODEL_SIZE_BUDGET_BYTES } from '../app/lib/normalize-model/normalize-model-shared'

import type { NormalizePageResult } from '../app/routes/normalize-model-page'

const BASE_URL = process.env.NORMALIZE_BASE_URL ?? 'http://localhost:4200'
const TIMEOUT_MS = 10 * 60 * 1000

function flag(name: string): string | undefined {
	const prefix = `--${name}=`
	return process.argv
		.find((arg) => arg.startsWith(prefix))
		?.slice(prefix.length)
}

function parseOptions() {
	const input = flag('in')
	const out = flag('out')
	const cm = flag('longest-edge-cm')
	if (!input || !out) {
		throw new Error(
			'Usage: --in=<model.glb> --out=<dir> [--longest-edge-cm=<n>]'
		)
	}
	const longestEdgeCm = cm === undefined ? undefined : Number(cm)
	if (
		longestEdgeCm !== undefined &&
		!(Number.isFinite(longestEdgeCm) && longestEdgeCm > 0)
	) {
		throw new Error(`--longest-edge-cm must be a positive number, got "${cm}"`)
	}
	// nx runs this from the app's directory, so a relative path means the
	// repository root, where the command was typed.
	const root = process.env.NX_WORKSPACE_ROOT ?? process.cwd()
	return {
		input: path.resolve(root, input),
		out: path.resolve(root, out),
		longestEdgeCm
	}
}

const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`

async function main() {
	const { input, out, longestEdgeCm } = parseOptions()
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
	await writeFile(
		path.join(out, `${name}.glb`),
		Buffer.from(result.glb, 'base64')
	)
	await writeFile(
		path.join(out, `${name}.usdz`),
		Buffer.from(result.usdz, 'base64')
	)
	await writeFile(
		path.join(out, `${name}.report.json`),
		`${JSON.stringify(result.report, null, '\t')}\n`
	)

	const { report } = result
	const kept = report.attempts[report.attempts.length - 1]
	console.log(
		`${name}: ${megabytes(report.inputBytes)}, ${report.inputTriangles} triangles in`
	)
	for (const attempt of report.attempts) {
		console.log(
			`  textures ${attempt.textureSize}px, ${attempt.simplifyRatio * 100}% of triangles:` +
				` GLB ${megabytes(attempt.glbBytes)}, USDZ ${megabytes(attempt.usdzBytes)},` +
				` ${attempt.triangles} triangles, ${(attempt.milliseconds / 1000).toFixed(1)}s` +
				(attempt.fits ? '  <- kept' : '')
		)
	}
	console.log(
		`Wrote ${name}.glb, ${name}.usdz and ${name}.report.json to ${out}`
	)

	if (!report.fits) {
		console.error(
			`No attempt fits ${megabytes(MODEL_SIZE_BUDGET_BYTES)}; the last one ` +
				`(GLB ${megabytes(kept.glbBytes)}, USDZ ${megabytes(kept.usdzBytes)}) was written.`
		)
		process.exitCode = 1
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error)
	process.exitCode = 1
})
