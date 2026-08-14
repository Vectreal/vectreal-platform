import type {
	AnimationClipConfig,
	AnimationLoopMode,
	AnimationPlaybackMode,
	AnimationSettings
} from '../types/animation-types'

type AnimationRecord = Record<string, unknown>

/**
 * Untyped input paired with the shape it is being validated into.
 *
 * The union is what lets this module read properties by name: against a bare
 * index signature TypeScript would demand bracket access everywhere. Same
 * approach as `normalize-scene-interactions`.
 */
type AnimationClipInput = AnimationClipConfig | AnimationRecord

const LOOP_MODES: ReadonlySet<string> = new Set<AnimationLoopMode>([
	'once',
	'ping_pong',
	'repeat'
])

const PLAYBACK_MODES: ReadonlySet<string> = new Set<AnimationPlaybackMode>([
	'sequence',
	'simultaneous'
])

/** Upper bound on playback rate. Beyond this a clip is visually meaningless. */
const MAX_TIME_SCALE = 100

function isRecord(value: unknown): value is AnimationRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback
}

/**
 * Normalizes one persisted clip config.
 *
 * Absent fields take a sensible default; present-but-invalid fields throw. That
 * split keeps a partially-written payload usable while refusing to silently
 * reinterpret a value the author actually set.
 */
function normalizeClip(
	clip: AnimationClipInput,
	index: number
): AnimationClipConfig {
	const label = `animation.clips[${index}]`

	if (typeof clip.clipId !== 'string' || !clip.clipId.trim()) {
		throw new Error(`${label}.clipId must be a non-empty string`)
	}

	if (typeof clip.loop !== 'undefined' && !LOOP_MODES.has(clip.loop as string)) {
		throw new Error(`${label}.loop must be one of once, repeat, ping_pong`)
	}
	const loop = (clip.loop as AnimationLoopMode | undefined) ?? 'repeat'

	let timeScale = 1
	if (typeof clip.timeScale !== 'undefined') {
		if (
			typeof clip.timeScale !== 'number' ||
			!Number.isFinite(clip.timeScale) ||
			clip.timeScale <= 0 ||
			clip.timeScale > MAX_TIME_SCALE
		) {
			throw new Error(
				`${label}.timeScale must be a finite number greater than 0 and at most ${MAX_TIME_SCALE}`
			)
		}
		timeScale = clip.timeScale
	}

	let startOffset = 0
	if (typeof clip.startOffset !== 'undefined') {
		if (
			typeof clip.startOffset !== 'number' ||
			!Number.isFinite(clip.startOffset) ||
			clip.startOffset < 0
		) {
			throw new Error(
				`${label}.startOffset must be a finite number of at least 0`
			)
		}
		startOffset = clip.startOffset
	}

	let repetitions: number | undefined
	if (typeof clip.repetitions !== 'undefined') {
		if (!Number.isInteger(clip.repetitions) || (clip.repetitions as number) < 1) {
			throw new Error(`${label}.repetitions must be an integer of at least 1`)
		}
		repetitions = clip.repetitions as number
	}

	// three's setLoop ignores the repetition count for LoopOnce, so carrying one
	// here would persist a value that can never take effect and would show a
	// misleading number in the panel.
	if (loop === 'once') {
		repetitions = undefined
	}

	let sourceIndex = index
	if (typeof clip.sourceIndex !== 'undefined') {
		if (!Number.isInteger(clip.sourceIndex) || (clip.sourceIndex as number) < 0) {
			throw new Error(`${label}.sourceIndex must be a non-negative integer`)
		}
		sourceIndex = clip.sourceIndex as number
	}

	let order = index
	if (typeof clip.order !== 'undefined') {
		if (!Number.isInteger(clip.order) || (clip.order as number) < 0) {
			throw new Error(`${label}.order must be a non-negative integer`)
		}
		order = clip.order as number
	}

	return {
		clipId: clip.clipId.trim(),
		sourceName: typeof clip.sourceName === 'string' ? clip.sourceName : '',
		sourceIndex,
		enabled: normalizeBoolean(clip.enabled, true),
		order,
		loop,
		...(typeof repetitions === 'undefined' ? {} : { repetitions }),
		timeScale,
		startOffset
	}
}

/**
 * Forces every non-terminal clip in a sequence to end.
 *
 * A clip with infinite repetitions never emits three's `finished` event, so a
 * sequence parked on one stalls with no way to advance and no error to explain
 * it. This is the worst failure mode in the feature, so it is closed off here
 * as well as in the authoring UI.
 *
 * Only enabled clips are considered, because a disabled clip is not part of the
 * chain and so cannot be the one that has to hand off.
 */
function clampNonTerminalRepetitions(
	clips: AnimationClipConfig[]
): AnimationClipConfig[] {
	const enabledOrder = clips
		.map((clip, index) => ({ clip, index }))
		.filter((entry) => entry.clip.enabled)
		.sort((a, b) => a.clip.order - b.clip.order)

	const lastEnabledIndex = enabledOrder.at(-1)?.index

	return clips.map((clip, index) => {
		if (!clip.enabled || index === lastEnabledIndex) return clip
		if (clip.loop === 'once' || typeof clip.repetitions === 'number') return clip

		return { ...clip, repetitions: 1 }
	})
}

/**
 * Returns a canonical animation config suitable for persistence and hydration.
 *
 * Intentionally strict, because settings can arrive from untyped JSON even when
 * the call site is statically typed. Mirrors `normalizeSceneInteractions`.
 */
export function normalizeSceneAnimation(
	animation?: AnimationSettings
): AnimationSettings | undefined {
	if (typeof animation === 'undefined') {
		return undefined
	}

	if (!isRecord(animation)) {
		throw new Error('animation must be an object')
	}

	if (
		typeof animation.mode !== 'undefined' &&
		!PLAYBACK_MODES.has(animation.mode as string)
	) {
		throw new Error('animation.mode must be one of simultaneous, sequence')
	}
	const mode =
		(animation.mode as AnimationPlaybackMode | undefined) ?? 'simultaneous'

	if (typeof animation.clips !== 'undefined' && !Array.isArray(animation.clips)) {
		throw new Error('animation.clips must be an array')
	}

	const seenClipIds = new Set<string>()
	const rawClips = (animation.clips ?? []) as unknown[]
	const clips = rawClips.map((clip, index) => {
		if (!isRecord(clip)) {
			throw new Error(`animation.clips[${index}] must be an object`)
		}

		const normalized = normalizeClip(clip, index)

		if (seenClipIds.has(normalized.clipId)) {
			throw new Error(`Duplicate animation clip id found: ${normalized.clipId}`)
		}
		seenClipIds.add(normalized.clipId)

		return normalized
	})

	// Renumber densely so ordering stays meaningful after clips are removed.
	// Ties resolve by array position, which keeps the result stable.
	const denseOrder = new Map(
		clips
			.map((clip, index) => ({ clip, index }))
			.sort((a, b) => a.clip.order - b.clip.order || a.index - b.index)
			.map((entry, position) => [entry.index, position] as const)
	)
	const ordered = clips.map((clip, index) => ({
		...clip,
		order: denseOrder.get(index) ?? index
	}))

	return {
		// Absent means off: a malformed payload must never start motion on its own.
		enabled: normalizeBoolean(animation.enabled, false),
		mode,
		autoplay: normalizeBoolean(animation.autoplay, true),
		loopSequence: normalizeBoolean(animation.loopSequence, false),
		showControls: normalizeBoolean(animation.showControls, false),
		clips: mode === 'sequence' ? clampNonTerminalRepetitions(ordered) : ordered
	}
}
