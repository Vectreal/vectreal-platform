import { WorkerRunError } from '../../../../workers/run-worker'

import type {
	BakePassOutcome,
	PublishExportOutcome
} from '../../../../workers/publish-export.worker.types'
import type {
	BakeFailureReason,
	BakeRecovery,
	OcclusionBakeSkipReason
} from '@vctrl/core/occlusion-bake'

/**
 * Why the studio finish drew nothing: a bake's own reason, or one of the ways
 * the export around it can end. Every reason has words below, so a reason
 * added without them fails the type check.
 */
export type StudioFinishFailureReason =
	| BakeFailureReason
	/** The export ran past its budget, so it was stopped. */
	| 'timed-out'
	/** The worker died, which is the browser running out of memory. */
	| 'out-of-memory'
	/** The model could not be turned into a file, or the result read back. */
	| 'unprepared'

export interface StudioFinishFailure {
	reason: StudioFinishFailureReason
	/** The error behind it, for logs only: never shown. */
	detail: string
}

/** How long a publish export may run, so the timeout can say it. */
export const PUBLISH_EXPORT_TIMEOUT_MS = 10 * 60_000

/**
 * What the author reads for each failure, and whether it is theirs to act on
 * or a fault to report: a browser without WebGL 2, or a bug.
 */
export const STUDIO_FINISH_FAILURES = {
	'no-webgl': {
		message:
			"This browser can't draw the studio finish. Turn on hardware acceleration or try another browser.",
		kind: 'fatal'
	},
	'gpu-reset': {
		message:
			'The graphics card reset while drawing. Close other heavy tabs and try again.',
		kind: 'action'
	},
	'timed-out': {
		message: `Drawing took over ${PUBLISH_EXPORT_TIMEOUT_MS / 60_000} minutes. Try depth alone, fewer lights or a lighter model.`,
		kind: 'action'
	},
	'out-of-memory': {
		message:
			'The browser ran out of memory while drawing. Close other tabs and try again.',
		kind: 'action'
	},
	unprepared: {
		message: "The model couldn't be prepared for the studio finish.",
		kind: 'fatal'
	},
	unexpected: {
		message: 'Something went wrong while drawing. Try again.',
		kind: 'fatal'
	}
} as const satisfies Record<
	StudioFinishFailureReason,
	{ message: string; kind: 'action' | 'fatal' }
>

/** Why a material took no bake, and what would let it. */
export const BAKE_SKIP_REASONS = {
	'existing-occlusion': 'Keeps its own occlusion map.',
	'shared-geometry': 'Used more than once. Make each copy its own mesh.',
	skinned: 'Rigged, and a bake holds one pose.',
	animated: 'Animated, and a bake holds one pose.',
	'no-uv0': 'No UVs. Unwrap it in your 3D tool.',
	'tiling-uvs': 'Its UVs repeat. Unwrap it into one tile.',
	'overlapping-uvs': 'Its UVs overlap. Unwrap it without stacked parts.',
	'double-sided': 'Double-sided. Make it single-sided to bake light.',
	'moving-shadows': 'Another part moves, so light here stays live.',
	'cutout-shadows': "A cutout mask can't be read, so light here stays live.",
	unlit: "Unlit, so there's no light to bake."
} as const satisfies Record<OcclusionBakeSkipReason, string>

/**
 * What a bake that recovered from a GPU reset says about it. Drawn again as
 * asked is the same file, so only lower detail is worth a line.
 */
export const BAKE_RECOVERY_NOTES = {
	retried: undefined,
	'lower-detail': 'Drawn at lower detail after a graphics reset.'
} as const satisfies Record<BakeRecovery, string | undefined>

/** A failure that already knows its reason, thrown to the one place that shows it. */
export class StudioFinishError extends Error {
	constructor(readonly failure: StudioFinishFailure) {
		super(failure.detail)
		this.name = 'StudioFinishError'
	}
}

const messageOf = (error: unknown) =>
	error instanceof Error ? error.message : String(error)

/** Rethrows whatever a step threw as that step's reason. */
export const failWith =
	(reason: StudioFinishFailureReason) =>
	(error: unknown): never => {
		throw new StudioFinishError({ reason, detail: messageOf(error) })
	}

/** Why a studio finish run drew nothing, from whatever it threw. */
export function studioFinishFailure(error: unknown): StudioFinishFailure {
	if (error instanceof StudioFinishError) return error.failure
	const detail = messageOf(error)
	if (error instanceof WorkerRunError) {
		if (error.failure === 'timed-out') return { reason: 'timed-out', detail }
		if (error.failure === 'crashed') return { reason: 'out-of-memory', detail }
	}
	return { reason: 'unexpected', detail }
}

/** The failure a bake reported, in the shape the rest of the finish speaks. */
export const passFailure = (
	outcome: BakePassOutcome | undefined
): StudioFinishFailure | undefined =>
	outcome && 'failed' in outcome
		? { reason: outcome.failed, detail: outcome.detail }
		: undefined

/** The warning a publish owes the author about its occlusion bake, if any. */
export function occlusionBakeWarning(
	occlusion: PublishExportOutcome['occlusion']
): { message: string; description: string } | null {
	if (!occlusion) return null
	const failure = passFailure(occlusion)
	if (failure) {
		return {
			message:
				'The studio finish could not add depth, so the scene was published without it.',
			description: STUDIO_FINISH_FAILURES[failure.reason].message
		}
	}
	if (!('baked' in occlusion)) return null
	// A material that brought its own occlusion map keeps it, as intended.
	const missed = occlusion.skipped.filter(
		({ reason }) => reason !== 'existing-occlusion'
	)
	const [first, ...rest] = missed
	if (!first) return null
	return {
		message: `${missed.length} material${rest.length === 0 ? '' : 's'} could not take the studio finish's depth.`,
		description: `${first.material}: ${BAKE_SKIP_REASONS[first.reason]}`
	}
}

/** The warning a publish owes the author about its light bake, if any. */
export function lightBakeWarning(
	lights: PublishExportOutcome['lights']
): { message: string; description: string } | null {
	if (!lights) return null
	const failure = passFailure(lights)
	if (failure) {
		return {
			message:
				'The studio finish could not draw the studio lights, so the scene was published with them live.',
			description: STUDIO_FINISH_FAILURES[failure.reason].message
		}
	}
	if (!('baked' in lights)) return null
	const [first, ...rest] = lights.skipped
	if (!first) return null
	return {
		message: `${lights.skipped.length} material${rest.length === 0 ? '' : 's'} could not take the studio finish's lights and keep${rest.length === 0 ? 's' : ''} them live.`,
		description: `${first.material}: ${BAKE_SKIP_REASONS[first.reason]}`
	}
}

/**
 * The failures a finish run owes error tracking: a browser without WebGL 2,
 * or a bug. Those the author can act on are theirs, not a fault to chase.
 */
export function failuresToReport({
	failure,
	reports
}: {
	failure?: StudioFinishFailure
	reports?: Pick<PublishExportOutcome, 'occlusion' | 'lights'>
}): StudioFinishFailure[] {
	return [
		failure,
		passFailure(reports?.occlusion),
		passFailure(reports?.lights)
	]
		.filter((found) => found !== undefined)
		.filter(({ reason }) => STUDIO_FINISH_FAILURES[reason].kind === 'fatal')
}
