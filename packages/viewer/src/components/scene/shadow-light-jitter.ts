/**
 * Where the accumulative bake's lights sit for one accumulated frame.
 *
 * The distributions are drei's `RandomizedLight` (MIT, pmndrs/drei), widened to
 * several lights: each sample either jitters around one of the scene's lights,
 * picked in proportion to its strength, which softens that light's penumbra,
 * or, with probability `ambient`, lands anywhere on the upper hemisphere, which
 * stands in for the environment and fills the shadow. drei draws from
 * `Math.random`; this takes the generator as an argument, so a seeded bake is
 * reproducible.
 */

export type RandomSource = () => number

/**
 * Seeded uniform generator in [0, 1) (mulberry32). Small, fast and well
 * distributed for sampling, which is all the bake asks of it.
 */
export const createSeededRandom = (seed: number): RandomSource => {
	let state = seed >>> 0
	return () => {
		state = (state + 0x6d2b79f5) >>> 0
		let t = state
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

/** One of the scene's lights, as the bake samples it. */
export interface JitterSource {
	/** The light's position, relative to the bake's origin. */
	position: readonly [number, number, number]
	/** Full width of the jitter box around `position`, per axis. */
	radius: number
	/** Share of the light samples this light draws; its strength. */
	weight: number
}

interface JitterOptions {
	sources: readonly JitterSource[]
	/** Probability that a sample lands on the hemisphere instead of a light. */
	ambient: number
	/** Radius of the hemisphere the environment samples land on. */
	distance: number
	amount: number
}

const pickSource = (
	random: RandomSource,
	sources: readonly JitterSource[],
	totalWeight: number
): JitterSource => {
	let target = random() * totalWeight
	for (const source of sources) {
		target -= source.weight
		if (target < 0) return source
	}
	return sources[sources.length - 1]
}

export const jitterLightPositions = (
	random: RandomSource,
	{ sources, ambient, distance, amount }: JitterOptions
): Array<[number, number, number]> => {
	const totalWeight = sources.reduce((sum, source) => sum + source.weight, 0)
	return Array.from({ length: amount }, () => {
		if (totalWeight > 0 && random() > ambient) {
			const { position, radius } = pickSource(random, sources, totalWeight)
			const spread = () => radius * (0.5 - random())
			return [
				position[0] + spread(),
				position[1] + spread(),
				position[2] + spread()
			]
		}
		const lambda = Math.acos(2 * random() - 1) - Math.PI / 2
		const phi = 2 * Math.PI * random()
		return [
			Math.cos(lambda) * Math.cos(phi) * distance,
			Math.abs(Math.cos(lambda) * Math.sin(phi) * distance),
			Math.sin(lambda) * distance
		]
	})
}
