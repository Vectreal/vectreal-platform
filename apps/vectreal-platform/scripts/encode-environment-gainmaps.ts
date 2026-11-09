/**
 * Encodes the compressed version of every hosted environment map that has
 * one, and writes what each map costs a visitor into `@vctrl/core` as
 * `ENVIRONMENT_MAP_BYTES`.
 *
 * Run via: pnpm nx run vectreal-platform:encode-environment-gainmaps
 * Then upload with terraform/scripts/upload-environment-gainmaps.sh <out>.
 *
 * Each compressed map is a single gain map JPEG (Ultra HDR): an 8-bit picture
 * of the map plus a gain map that restores its range, 7 to 25 times smaller than
 * the HDR. It is written beside the HDR under the name
 * `resolveEnvironmentFiles` gives it, so the out directory mirrors the bucket.
 * The encode runs in headless Chromium, because gainmap-js encodes on the GPU.
 *
 * The lossless size is the HDR as the bucket sends it to a browser: gzipped
 * once compress-environment-maps.sh has run, which this reads back from the
 * bucket. Before that it is estimated with a local gzip, and says so.
 *
 * Usage: encode-environment-gainmaps.ts [out]  (default: <tmp>/environment-gainmaps)
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

import { chromium } from '@playwright/test'
import {
	ENVIRONMENT_KEYS,
	ENVIRONMENT_MAP_ROOT,
	hasCompressedEnvironment,
	resolveEnvironmentFiles,
	type EnvironmentResolution
} from '@vctrl/core'
import { createServer } from 'vite'

const RESOLUTIONS: EnvironmentResolution[] = ['1k', '4k']

const scriptDir = import.meta.dirname
const OUT = path.resolve(
	process.argv[2] ?? path.join(tmpdir(), 'environment-gainmaps')
)
const OUTPUT = path.join(
	scriptDir,
	'../../../packages/core/src/scene-environment/environment-map-bytes.ts'
)

declare global {
	interface Window {
		encodeGainmap: (url: string) => Promise<string>
		encoderReady?: boolean
	}
}

/** The HDR's bytes, and what the bucket sends a browser for it. */
async function fetchHdr(url: string) {
	const head = await fetch(url, {
		method: 'HEAD',
		headers: { 'accept-encoding': 'gzip' }
	})
	if (!head.ok) throw new Error(`${url}: ${head.status}`)
	const response = await fetch(url)
	if (!response.ok) throw new Error(`${url}: ${response.status}`)
	const bytes = Buffer.from(await response.arrayBuffer())

	const gzipped = head.headers.get('x-goog-stored-content-encoding') === 'gzip'
	const stored = Number(head.headers.get('x-goog-stored-content-length'))
	if (gzipped && stored > 0) return { bytes, onTheWire: stored }
	console.warn(`${url} is not served gzipped yet; estimating its gzip size.`)
	return { bytes, onTheWire: gzipSync(bytes, { level: 9 }).length }
}

const server = await createServer({
	root: path.join(scriptDir, 'encode-environment-gainmaps'),
	configFile: false,
	logLevel: 'error',
	server: { port: 0 },
	optimizeDeps: {
		include: [
			'three',
			'three/examples/jsm/loaders/HDRLoader.js',
			'@monogrid/gainmap-js/encode',
			'@monogrid/gainmap-js/libultrahdr'
		]
	}
})
await server.listen()
const browser = await chromium.launch({
	// The encode renders the map on the GPU; software GL is slower and not
	// what the measurements behind JPEG_QUALITY ran on.
	args: ['--enable-gpu', '--ignore-gpu-blocklist']
})

const rows: string[] = []
try {
	const page = await browser.newPage()
	page.on('pageerror', (error) => console.error(error))
	// The page asks for each HDR by its bucket URL; it is answered from the
	// download already made here rather than fetched twice.
	const hdrs = new Map<string, Buffer>()
	await page.route(`${ENVIRONMENT_MAP_ROOT}/**`, (route) =>
		route.fulfill({
			body: hdrs.get(route.request().url()),
			headers: { 'access-control-allow-origin': '*' }
		})
	)
	await page.goto(server.resolvedUrls?.local[0] ?? '')
	await page.waitForFunction(() => window.encoderReady, undefined, {
		timeout: 60_000
	})

	for (const preset of ENVIRONMENT_KEYS) {
		const sizes: string[] = []
		for (const resolution of RESOLUTIONS) {
			const hdrUrl = resolveEnvironmentFiles({
				preset,
				environmentResolution: resolution
			}) as string
			const { bytes, onTheWire } = await fetchHdr(hdrUrl)

			let compressed: number | null = null
			if (hasCompressedEnvironment(preset)) {
				hdrs.set(hdrUrl, bytes)
				const jpeg = Buffer.from(
					await page.evaluate((url) => window.encodeGainmap(url), hdrUrl),
					'base64'
				)
				hdrs.delete(hdrUrl)
				const jpegUrl = resolveEnvironmentFiles({
					preset,
					environmentResolution: resolution,
					environmentQuality: 'compressed'
				}) as string
				const file = path.join(OUT, jpegUrl.slice(ENVIRONMENT_MAP_ROOT.length))
				await mkdir(path.dirname(file), { recursive: true })
				await writeFile(file, jpeg)
				compressed = jpeg.length
			}

			console.log(
				`${preset} ${resolution}: ${(onTheWire / 1024).toFixed(0)} KB lossless, ${
					compressed === null
						? 'no compressed version'
						: `${(compressed / 1024).toFixed(0)} KB compressed`
				}`
			)
			sizes.push(
				`'${resolution}': { lossless: ${onTheWire}, compressed: ${compressed} }`
			)
		}
		rows.push(`\t'${preset}': { ${sizes.join(', ')} },`)
	}
} finally {
	await browser.close()
	await server.close()
}

await writeFile(
	OUTPUT,
	`// Generated by apps/vectreal-platform/scripts/encode-environment-gainmaps.ts.
// Do not edit by hand: rerun the script when a hosted map changes.
import type { EnvironmentKey, EnvironmentResolution } from '../types'

/**
 * What each hosted environment map costs a visitor, in bytes on the wire: the
 * HDR as the bucket serves it (gzip), and its compressed gain map JPEG, null
 * for a map that has none.
 */
export const ENVIRONMENT_MAP_BYTES: Record<
	EnvironmentKey,
	Record<EnvironmentResolution, { lossless: number; compressed: number | null }>
> = {
${rows.join('\n')}
}
`
)
console.log(`Wrote ${OUT} and ${path.relative(process.cwd(), OUTPUT)}`)
