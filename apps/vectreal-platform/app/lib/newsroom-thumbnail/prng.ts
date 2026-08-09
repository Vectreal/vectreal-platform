/**
 * Deterministic seeding for news-room scene generation.
 *
 * Everything here uses integer hashing rather than `Math.sin`, because the
 * same seed has to produce the same scene in Node (prerender, image bake) and
 * in the browser (dev contact sheet). Floating-point transcendentals are not
 * guaranteed bit-identical across engines; `Math.imul` is.
 */

const FNV_OFFSET_BASIS = 2166136261
const FNV_PRIME = 16777619

/** FNV-1a over the slug, so a scene follows its article rather than its filename. */
export function seedFromSlug(slug: string): number {
	let hash = FNV_OFFSET_BASIS

	for (let index = 0; index < slug.length; index++) {
		hash ^= slug.charCodeAt(index)
		hash = Math.imul(hash, FNV_PRIME)
	}

	return hash >>> 0
}

/** Numerical Recipes LCG. Stateful; call repeatedly for a stream in [0, 1). */
export function makePrng(seed: number): () => number {
	let state = (seed >>> 0) || 1

	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0
		return state / 4294967296
	}
}

function hashLattice(seed: number, x: number, y: number): number {
	let hash = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)
	hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d)
	hash = Math.imul(hash ^ (hash >>> 12), 0x297a2d39)
	hash ^= hash >>> 15

	return (hash >>> 0) / 4294967296
}

/** Quintic smootherstep - zero first and second derivatives at both ends. */
function smootherstep(t: number): number {
	return t * t * t * (t * (t * 6 - 15) + 10)
}

/** Value noise on the integer lattice, smootherstep-interpolated, in [0, 1]. */
export function makeNoise2d(seed: number): (x: number, y: number) => number {
	return (x, y) => {
		const xi = Math.floor(x)
		const yi = Math.floor(y)
		const u = smootherstep(x - xi)
		const v = smootherstep(y - yi)

		const a = hashLattice(seed, xi, yi)
		const b = hashLattice(seed, xi + 1, yi)
		const c = hashLattice(seed, xi, yi + 1)
		const d = hashLattice(seed, xi + 1, yi + 1)

		return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
	}
}
