/**
 * Where the accumulative bake's lights sit for one accumulated frame.
 *
 * The distributions are drei's `RandomizedLight` (MIT, pmndrs/drei): each light
 * either jitters around the key light, which softens the penumbra, or, with
 * probability `ambient`, lands anywhere on the upper hemisphere at the key
 * light's distance, which fills the shadow. drei draws from `Math.random`; this
 * takes the generator as an argument, so a seeded bake is reproducible.
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

interface JitterOptions {
	/** The key light's position, relative to the bake's origin. */
	position: readonly [number, number, number]
	/** Full width of the jitter box around `position`, per axis. */
	radius: number
	/** Probability that a light samples the hemisphere instead of the key light. */
	ambient: number
	amount: number
}

export const jitterLightPositions = (
	random: RandomSource,
	{ position, radius, ambient, amount }: JitterOptions
): Array<[number, number, number]> => {
	const distance = Math.hypot(...position)
	const spread = () => radius * (0.5 - random())
	return Array.from({ length: amount }, () => {
		if (random() > ambient) {
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
