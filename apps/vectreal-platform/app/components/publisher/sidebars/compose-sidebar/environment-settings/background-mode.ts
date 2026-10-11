import type { EnvironmentProps, SceneBackdrop } from '@vctrl/core'

/**
 * What is behind the model, as the author chooses it: the environment map, a
 * flat stage the viewer paints, or nothing, so the page shows through.
 *
 * Stored as two fields rather than one, because `background` predates the
 * stage and every saved scene carries it. The viewer reads them through
 * `resolveSceneBackdrop`, where the map wins while it is shown.
 */
export type BackgroundMode = 'environment' | SceneBackdrop['type'] | 'none'

/** A light, neutral stage: a shadow reads on it without the stage competing. */
export const DEFAULT_STAGE_COLOR = '#f4f4f5'
export const DEFAULT_STAGE_GRADIENT = {
	top: '#fafafa',
	bottom: '#d4d4d8'
} as const

export const backgroundModeOf = (
	environment: Pick<EnvironmentProps, 'background' | 'backdrop'>
): BackgroundMode =>
	environment.background
		? 'environment'
		: (environment.backdrop?.type ?? 'none')

/**
 * The environment with `mode` chosen. Switching to the map keeps the stage, so
 * switching back restores it; choosing nothing drops it.
 */
export const withBackgroundMode = (
	environment: EnvironmentProps,
	mode: BackgroundMode
): EnvironmentProps => {
	const { backdrop, ...rest } = environment
	switch (mode) {
		case 'environment':
			return { ...environment, background: true }
		case 'none':
			return { ...rest, background: false }
		case 'color':
			return {
				...rest,
				background: false,
				backdrop:
					backdrop?.type === 'color'
						? backdrop
						: { type: 'color', color: DEFAULT_STAGE_COLOR }
			}
		case 'gradient':
			return {
				...rest,
				background: false,
				backdrop:
					backdrop?.type === 'gradient'
						? backdrop
						: { type: 'gradient', ...DEFAULT_STAGE_GRADIENT }
			}
	}
}
