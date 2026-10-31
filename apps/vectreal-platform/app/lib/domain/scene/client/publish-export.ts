import { litLights, resolveLighting } from '@vctrl/core'

import { runWorker } from '../../../../workers/run-worker'

import type {
	PublishExportMessage,
	PublishExportOutcome,
	PublishExportProgress,
	PublishExportRequest
} from '../../../../workers/publish-export.worker.types'
import type {
	DracoCompressionReport,
	LightingSettings,
	Optimizations
} from '@vctrl/core'
import type { OcclusionBakeSkipReason } from '@vctrl/core/occlusion-bake'

/**
 * Budget for one publish export. KTX2 encoding takes seconds per texture, so
 * this is generous; it exists so a stuck encoder cannot hold the publish
 * button forever.
 */
const PUBLISH_EXPORT_TIMEOUT_MS = 10 * 60_000

/** Runs the publish export in its worker, which `runWorker` owns. */
export function runPublishExportInWorker(
	request: Omit<PublishExportRequest, 'type'>,
	onProgress: (progress: PublishExportProgress) => void,
	timeoutMs = PUBLISH_EXPORT_TIMEOUT_MS
): Promise<PublishExportOutcome> {
	const message: PublishExportRequest = { type: 'export', ...request }

	return runWorker<PublishExportMessage, PublishExportOutcome>(
		() =>
			new Worker(
				new URL(
					'../../../../workers/publish-export.worker.ts',
					import.meta.url
				),
				{ type: 'module' }
			),
		{
			message,
			transfer: [request.buffer],
			timeoutMs,
			onProgress,
			toResult: (outcome) => outcome,
			errors: {
				timedOut: `Publishing timed out after ${timeoutMs / 1000}s`,
				undeserializable: 'Publish worker sent an undeserializable message',
				crashed: 'Publish worker crashed'
			}
		}
	)
}

/** How publish encodes geometry, from the settings the document was derived from. */
export type PublishGeometryOptions = Pick<
	PublishExportRequest,
	'draco' | 'dracoWorthApplying'
>

/**
 * Geometry and texture codecs are applied at publish rather than during
 * optimization: the working document stays uncompressed WebP, so editing and
 * re-optimizing never re-encode (and degrade) it. Draco is the switch for
 * geometry compression as a whole; `isWorthApplying` is false when the
 * measured compression came out larger than the plain GLB, which leaves
 * meshopt to compete with plain geometry alone. Settings saved before a step
 * existed lack it, so Draco may be absent.
 */
export function resolvePublishGeometryOptions(
	optimizations: Optimizations,
	dracoReport: DracoCompressionReport | null
): PublishGeometryOptions {
	const { enabled: dracoEnabled = false, ...dracoOptions } =
		optimizations.draco ?? {}
	return {
		draco: dracoEnabled ? dracoOptions : undefined,
		dracoWorthApplying: dracoReport?.isWorthApplying !== false
	}
}

/**
 * The size `workingGlb` publishes at, encoded the way publish encodes it.
 * Exact except for GPU texture encoding and baked occlusion, which take
 * seconds and are left to publish: without them, publish ships the textures
 * as they are.
 */
export async function projectPublishedGlbBytes(
	workingGlb: Uint8Array,
	geometry: PublishGeometryOptions
): Promise<number> {
	const { buffer } = await runPublishExportInWorker(
		{
			buffer: workingGlb.slice().buffer as ArrayBuffer,
			...geometry,
			ktx2: false,
			occlusion: false,
			lights: false
		},
		() => {}
	)
	return buffer.byteLength
}

/**
 * What publishing bakes for `lighting`: occlusion when it is set to baked, and
 * the studio lights when they are set to bake and any is on. The Lighting
 * tool's preview asks for the same, so it shows what will ship.
 */
export function publishBakes(
	lighting: LightingSettings | undefined
): Pick<PublishExportRequest, 'occlusion' | 'lights'> {
	const resolved = resolveLighting({ lighting })
	return {
		occlusion: resolved.occlusion.mode === 'baked',
		lights:
			resolved.bake.lights && litLights(resolved).length > 0
				? { lights: resolved.lights, environment: resolved.environment }
				: false
	}
}

/** Why a material took no bake, as the author reads it. */
export const OCCLUSION_SKIP_REASONS: Record<OcclusionBakeSkipReason, string> = {
	'existing-occlusion': 'it has an occlusion map already, which is kept',
	'shared-geometry': 'its mesh is placed more than once',
	skinned: 'a skin moves it',
	'no-uv0': 'it has no UVs',
	'tiling-uvs': 'its UVs repeat the texture',
	'overlapping-uvs': 'parts of it share the same UVs',
	'double-sided':
		'it is drawn from both sides, which one light map cannot light',
	animated: 'an animation moves it, and a bake holds one pose',
	'moving-shadows':
		'another part moves or repeats, and its shadow here cannot be baked',
	'cutout-shadows':
		'a cutout whose mask cannot be read casts a shadow here, which the bake would draw solid',
	unlit: 'it is unlit, so there is no light to bake'
}

/** The warning a publish owes the author about its occlusion bake, if any. */
export function occlusionBakeWarning(
	occlusion: PublishExportOutcome['occlusion']
): { message: string; description: string } | null {
	if (!occlusion) return null
	if ('failed' in occlusion) {
		return {
			message:
				'Ambient occlusion could not be baked, so the scene was published without it.',
			description: occlusion.failed
		}
	}
	// A material that brought its own occlusion map keeps it, as intended.
	const missed = occlusion.skipped.filter(
		({ reason }) => reason !== 'existing-occlusion'
	)
	const [first, ...rest] = missed
	if (!first) return null
	return {
		message: `${missed.length} material${rest.length === 0 ? '' : 's'} could not take baked ambient occlusion.`,
		description: `${first.material}: ${OCCLUSION_SKIP_REASONS[first.reason]}`
	}
}

/** The warning a publish owes the author about its light bake, if any. */
export function lightBakeWarning(
	lights: PublishExportOutcome['lights']
): { message: string; description: string } | null {
	if (!lights) return null
	if ('failed' in lights) {
		return {
			message:
				'The studio lights could not be baked, so the scene was published with them live.',
			description: lights.failed
		}
	}
	const [first, ...rest] = lights.skipped
	if (!first) return null
	return {
		message: `${lights.skipped.length} material${rest.length === 0 ? '' : 's'} could not take the baked lights and keep${rest.length === 0 ? 's' : ''} them live.`,
		description: `${first.material}: ${OCCLUSION_SKIP_REASONS[first.reason]}`
	}
}
