import { litLights } from './light-direction'
import { resolveLighting } from './resolve-lighting'

import type { ResolvedLighting, ResolvedSceneLight } from './resolve-lighting'
import type { BakeBasis, SceneSettings } from '../types/scene-types'

/**
 * The ground bake's own inputs that a signature covers, apart from the
 * lights and the model: the viewer bakes with these, and a stored bake is
 * checked against them.
 */
export const GROUND_BAKE_SIGNATURE_INPUTS = {
	frames: 48,
	scale: 4,
	resolution: 1024
} as const

/**
 * The signature format. Bumped when what a signature covers changes, so a
 * token from before no longer matches; {@link isPersistedBakeValid} still
 * accepts an older token that carries its basis.
 */
const SIGNATURE_VERSION = 3

// Synchronous FNV-1a hash → 8-char hex. Used to fold the canonical bake-input
// serialization into a short, stable token. Sync (no crypto.subtle) because the
// signature is derived in render.
const fnv1aHex = (input: string): string => {
	let hash = 0x811c9dc5
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i)
		hash = Math.imul(hash, 0x01000193)
	}
	return (hash >>> 0).toString(16).padStart(8, '0')
}

/** What the ground bake is computed from, apart from the model. */
export interface BakeSignatureOptions {
	/** The lights the bake samples: on, and giving any light. */
	lights: ReadonlyArray<
		Pick<ResolvedSceneLight, 'azimuth' | 'elevation' | 'size' | 'intensity'>
	>
	/** The environment's rotation, which turns the lights. */
	rotation: number
	frames: number
	scale: number
	resolution: number
}

/**
 * Deterministic signature of everything that changes the BAKED shadow density,
 * hashed into a compact token: the lights the bake samples, the environment's
 * rotation, the bake's frame count, plane scale and resolution, and the model
 * fingerprint (footprint, radius, vertex count). Hashing a complete,
 * canonically ordered serialization means no input can be silently left out.
 *
 * A light's color and the environment's brightness are not in it: the stored
 * density is a ratio, and neither changes it. Computed identically at capture
 * and load time so the two can be compared.
 */
export const computeBakeSignature = (
	options: BakeSignatureOptions,
	footprint: number,
	radius: number,
	fingerprint: number
): string => {
	const canonical = [
		`fp:${fingerprint}`,
		`ft:${footprint.toFixed(3)}`,
		`rd:${radius.toFixed(3)}`,
		`fr:${options.frames}`,
		`sc:${options.scale}`,
		`rs:${options.resolution}`,
		`ro:${options.rotation.toFixed(3)}`,
		...options.lights.map(
			(light) =>
				`l:${[light.azimuth, light.elevation, light.size, light.intensity]
					.map((n) => n.toFixed(3))
					.join(',')}`
		)
	].join('|')
	return `v${SIGNATURE_VERSION}:${fnv1aHex(canonical)}`
}

/** True for a token written by an earlier signature format. */
const isOlderFormat = (signature: string) => {
	const version = /^v(\d+):/.exec(signature)?.[1]
	return version !== undefined && Number(version) < SIGNATURE_VERSION
}

/**
 * Whether a persisted bake still shows what a live bake would.
 *
 * With a stored basis, the bake is checked against the measurements it was
 * baked on, so only a change to the shadow settings invalidates it.
 *
 * A token from an earlier format cannot be recomputed. Where the settings are
 * the ones it was saved with - a published scene, read back as saved -
 * `acceptOlderFormat` keeps it: re-baking it live instead put a 48-frame,
 * eight-light bake on every visit to every scene published before the format
 * last changed, which a phone could not hold. Where the settings can have
 * moved on since - an editor - it must not be kept, or a lighting change
 * would leave the old shadow on screen and the save would write it back.
 *
 * Without a basis, it is checked against the loaded model, and trusted until
 * that model is measured rather than spawning the very live bake the stored
 * one exists to avoid. With neither a basis nor a model there is nothing to
 * check it against, so it does not count.
 */
export const isPersistedBakeValid = (
	baked: { signature: string; basis?: BakeBasis },
	options: BakeSignatureOptions,
	model?: BakeBasis & { measured: boolean },
	{ acceptOlderFormat = false }: { acceptOlderFormat?: boolean } = {}
): boolean => {
	if (baked.basis) {
		if (isOlderFormat(baked.signature)) return acceptOlderFormat
		const { footprint, radius, vertexCount } = baked.basis
		return (
			computeBakeSignature(options, footprint, radius, vertexCount) ===
			baked.signature
		)
	}
	if (!model) return false
	if (!model.measured) return true
	return (
		computeBakeSignature(
			options,
			model.footprint,
			model.radius,
			model.vertexCount
		) === baked.signature
	)
}

/** The bake inputs a scene's lighting gives, as a signature reads them. */
export const groundBakeSignatureOptions = (
	lighting: Pick<ResolvedLighting, 'lights' | 'environment'>
): BakeSignatureOptions => ({
	lights: litLights(lighting).map(
		({ azimuth, elevation, size, intensity }) => ({
			azimuth,
			elevation,
			size,
			intensity
		})
	),
	rotation: lighting.environment.rotation,
	...GROUND_BAKE_SIGNATURE_INPUTS
})

/**
 * Whether a scene draws a ground shadow it has no valid stored bake for, so
 * any viewer showing it has to bake one live.
 *
 * Asked of saved settings alone, so a page that never loads the model - the
 * dashboard, deciding whether to ask the author to publish again - gets the
 * answer a viewer showing those settings gets. Saved settings are the ones a
 * stored bake was saved with, so an older-format token counts.
 */
export const isGroundBakeMissing = (
	settings: Pick<SceneSettings, 'lighting' | 'environment' | 'shadows'>
): boolean => {
	const lighting = resolveLighting(settings)
	if (!lighting.ground.enabled) return false
	const baked = settings.shadows?.baked
	return (
		!baked ||
		!isPersistedBakeValid(
			baked,
			groundBakeSignatureOptions(lighting),
			undefined,
			{
				acceptOlderFormat: true
			}
		)
	)
}
