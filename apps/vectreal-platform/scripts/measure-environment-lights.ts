/**
 * Finds the lights in every hosted environment map and writes them into
 * `@vctrl/core` as `ENVIRONMENT_LIGHTS`.
 *
 * Run via: pnpm nx run vectreal-platform:measure-environment-lights, which also
 * formats the output, so a rerun with unchanged maps changes nothing.
 *
 * A lighting setup places its studio lights where its environment map's own
 * bright regions are, so a softbox reflected in a chrome surface sits where
 * the light that casts the model's shadow stands. That only holds if the
 * regions are measured rather than eyeballed, which is this script's job.
 * Rerun it whenever a hosted map changes; the output is committed.
 *
 * A pixel belongs to a light when it is brighter than both 8 times the upper
 * hemisphere's 90th percentile, so a uniformly bright sky (overcast) has no
 * lights, and 2% of the brightest pixel, so a sun leaves the sky around it
 * out. Connected pixels (8-neighborhood, wrapping around the seam) form one
 * region, reduced to its energy-weighted direction, the angular diameter of a
 * disc of the same solid angle, and its share of the whole map's energy.
 * Only the upper hemisphere is read: a light below the horizon lights no
 * ground and no product shot.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

<<<<<<< HEAD
import {
	ENVIRONMENT_KEYS,
	resolveEnvironmentFiles,
	type EnvironmentKey
} from '@vctrl/core'
import { FloatType } from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'

=======
import { resolveEnvironmentFiles, type EnvironmentKey } from '@vctrl/core'
import { FloatType } from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'

const ENVIRONMENT_KEYS: readonly EnvironmentKey[] = [
	'nature-moonlit',
	'nature-park',
	'nature-park-overcast',
	'nature-snow',
	'night-building',
	'night-city',
	'night-pure-sky',
	'night-stars',
	'outdoor-golden-hour',
	'outdoor-noon',
	'outdoor-overcast',
	'outdoor-sky',
	'studio-key',
	'studio-natural',
	'studio-soft'
]

>>>>>>> origin/main
/** Regions kept per map, brightest first. */
const MAX_REGIONS = 4
/** A region with less of the map's energy than this is not a light. */
const MIN_SHARE = 0.01

const OUTPUT = join(
	import.meta.dirname,
	'../../../packages/core/src/scene-lighting/environment-lights.ts'
)

interface Region {
	azimuth: number
	elevation: number
	size: number
	share: number
}

const round = (value: number, digits: number) =>
	Math.round(value * 10 ** digits) / 10 ** digits

/**
 * The luminance below which `fraction` of the upper hemisphere's solid angle
 * lies. Weighted, because rows near the zenith hold as many pixels as rows at
 * the horizon over far less of the sky.
 */
function weightedPercentile(
	luminance: Float32Array,
	width: number,
	solidAngle: (row: number) => number,
	fraction: number
): number {
	const order = Array.from(luminance.keys()).sort(
		(a, b) => luminance[a] - luminance[b]
	)
	const weight = (index: number) => solidAngle(Math.floor(index / width))
	const total = order.reduce((sum, index) => sum + weight(index), 0)
	let below = 0
	for (const index of order) {
		below += weight(index)
		if (below >= fraction * total) return luminance[index]
	}
	return luminance[order[order.length - 1]]
}

async function measure(key: EnvironmentKey): Promise<Region[]> {
	const url = resolveEnvironmentFiles({
		preset: key,
		environmentResolution: '1k'
	}) as string
	const response = await fetch(url)
	if (!response.ok) throw new Error(`${url}: ${response.status}`)
	const { width, height, data } = new HDRLoader()
		.setDataType(FloatType)
		.parse(await response.arrayBuffer()) as unknown as {
		width: number
		height: number
		data: Float32Array
	}

	const horizon = height / 2
	const luminance = new Float32Array(width * horizon)
	// Rows are stored top first, as three draws them with flipY.
	const elevationOf = (row: number) => (0.5 - (row + 0.5) / height) * Math.PI
	const solidAngle = (row: number) =>
		Math.cos(elevationOf(row)) * ((2 * Math.PI) / width) * (Math.PI / height)

	let total = 0
	for (let row = 0; row < height; row++) {
		for (let column = 0; column < width; column++) {
			const i = (row * width + column) * 4
			const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
			total += l * solidAngle(row)
			if (row < horizon) luminance[row * width + column] = l
		}
	}

	const threshold = Math.max(
		8 * weightedPercentile(luminance, width, solidAngle, 0.9),
		0.02 * luminance.reduce((max, l) => Math.max(max, l), 0)
	)

	const visited = new Uint8Array(luminance.length)
	const regions: Array<Region & { energy: number }> = []
	for (let start = 0; start < luminance.length; start++) {
		if (visited[start] || luminance[start] <= threshold) continue
		visited[start] = 1
		const stack = [start]
		let energy = 0
		let omega = 0
		const sum = [0, 0, 0]
		while (stack.length) {
			const index = stack.pop() as number
			const row = Math.floor(index / width)
			const column = index % width
			const dOmega = solidAngle(row)
			const e = luminance[index] * dOmega
			// three's equirect lookup: u = atan2(z, x) / 2PI + 0.5.
			const phi = ((column + 0.5) / width - 0.5) * 2 * Math.PI
			const elevation = elevationOf(row)
			sum[0] += e * Math.cos(elevation) * Math.cos(phi)
			sum[1] += e * Math.sin(elevation)
			sum[2] += e * Math.cos(elevation) * Math.sin(phi)
			energy += e
			omega += dOmega
			for (let dr = -1; dr <= 1; dr++) {
				for (let dc = -1; dc <= 1; dc++) {
					const r = row + dr
					if (r < 0 || r >= horizon) continue
					const next = r * width + ((column + dc + width) % width)
					if (!visited[next] && luminance[next] > threshold) {
						visited[next] = 1
						stack.push(next)
					}
				}
			}
		}
		const [x, y, z] = sum
		const length = Math.hypot(x, y, z)
		regions.push({
			// The viewer's azimuth: 0 toward +Z, 90 toward +X.
			azimuth: round((Math.atan2(x, z) * 180) / Math.PI, 1),
			elevation: round((Math.asin(y / length) * 180) / Math.PI, 1),
			size: round(
				(2 * Math.acos(1 - omega / (2 * Math.PI)) * 180) / Math.PI,
				1
			),
			share: round(energy / total, 3),
			energy
		})
	}

	return regions
		.sort((a, b) => b.energy - a.energy)
		.filter((region) => region.share >= MIN_SHARE)
		.slice(0, MAX_REGIONS)
		.map(({ energy: _energy, ...region }) => region)
}

const entries: string[] = []
for (const key of ENVIRONMENT_KEYS) {
	const regions = await measure(key)
	console.log(key, regions)
	entries.push(
		`\t'${key}': [${regions
			.map(
				(r) =>
					`\n\t\t{ azimuth: ${r.azimuth}, elevation: ${r.elevation}, size: ${r.size}, share: ${r.share} }`
			)
			.join(',')}${regions.length ? '\n\t' : ''}]`
	)
}

const source = `// Generated by apps/vectreal-platform/scripts/measure-environment-lights.ts.
// Do not edit by hand: rerun the script when a hosted map changes.
import type { EnvironmentKey } from '../types'

/** A bright region of an environment map: a light the map holds. */
export interface EnvironmentLight {
	/** Degrees around the vertical axis, 0 toward +Z and 90 toward +X, before any rotation. */
	azimuth: number
	/** Degrees above the horizon. */
	elevation: number
	/** Angular diameter in degrees of a disc as large as the region. */
	size: number
	/** The region's share of the whole map's light. */
	share: number
}

/**
 * Each hosted environment map's lights, brightest first. Exact tuples, so a
 * setup that names a region a map no longer has fails to compile.
 */
export const ENVIRONMENT_LIGHTS = {
${entries.join(',\n')}
} as const satisfies Record<EnvironmentKey, readonly EnvironmentLight[]>
`
// The Nx target formats it with the repository's Prettier config.
writeFileSync(OUTPUT, source)
console.log(`wrote ${OUTPUT}`)
