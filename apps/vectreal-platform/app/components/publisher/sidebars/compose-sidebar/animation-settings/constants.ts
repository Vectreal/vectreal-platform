import type { FieldConfig } from '../../../../../types/settings-field'
import type { AnimationLoopMode } from '@vctrl/core'

export const ANIMATION_LOOP_LABELS: Record<AnimationLoopMode, string> = {
	once: 'Once',
	repeat: 'Repeat',
	ping_pong: 'Ping-pong'
}

/** The count a clip starts from when the author turns "Forever" off. */
export const DEFAULT_FINITE_REPETITIONS = 2

export const ANIMATION_REPETITIONS_FIELD: FieldConfig<'repetitions'> = {
	key: 'repetitions',
	label: 'Times',
	min: 1,
	max: 20,
	step: 1,
	formatValue: (value) => `${value}x`
}

/**
 * Playback rate. The normalizer accepts up to 100x; past 4x a clip stops
 * reading as motion, so the slider stops there.
 */
export const ANIMATION_SPEED_FIELD: FieldConfig<'timeScale'> = {
	key: 'timeScale',
	label: 'Speed',
	min: 0.1,
	max: 4,
	step: 0.05,
	formatValue: (value) => `${value.toFixed(2)}x`
}

export const formatClipSeconds = (seconds: number) => `${seconds.toFixed(2)} s`

/** Where in the clip playback begins, bounded by the clip's own length. */
export const animationStartOffsetField = (
	duration: number
): FieldConfig<'startOffset'> => ({
	key: 'startOffset',
	label: 'Start at',
	min: 0,
	max: duration,
	step: 0.01,
	formatValue: formatClipSeconds
})
