import { resolveSceneBackdrop } from '@vctrl/core'
import { describe, expect, it } from 'vitest'

import {
	backgroundModeOf,
	DEFAULT_STAGE_COLOR,
	withBackgroundMode
} from './background-mode'

import type { EnvironmentProps } from '@vctrl/core'

const stored: EnvironmentProps = {
	preset: 'studio-soft',
	background: false,
	backdrop: { type: 'color', color: '#18181b' }
}

describe('backgroundModeOf', () => {
	it('reads a scene saved before the stage existed as it renders', () => {
		expect(backgroundModeOf({ background: true })).toBe('environment')
		expect(backgroundModeOf({ background: false })).toBe('none')
		expect(backgroundModeOf({})).toBe('none')
	})

	it('names the map while it is shown, even over a stored stage', () => {
		expect(backgroundModeOf({ ...stored, background: true })).toBe(
			'environment'
		)
		expect(backgroundModeOf(stored)).toBe('color')
	})
})

describe('withBackgroundMode', () => {
	it.each(['environment', 'color', 'gradient', 'none'] as const)(
		'renders what it selects in the viewer: %s',
		(mode) => {
			const next = withBackgroundMode(stored, mode)
			expect(backgroundModeOf(next)).toBe(mode)
			const backdrop = resolveSceneBackdrop(next)
			expect(backdrop?.type ?? 'none').toBe(
				mode === 'environment' ? 'none' : mode
			)
		}
	)

	it('keeps the stage under the map, so switching back restores it', () => {
		const next = withBackgroundMode(
			withBackgroundMode(stored, 'environment'),
			'color'
		)
		expect(next.backdrop).toEqual(stored.backdrop)
	})

	it('drops the stage when nothing is chosen', () => {
		expect('backdrop' in withBackgroundMode(stored, 'none')).toBe(false)
	})

	it('starts a new stage on the default color', () => {
		expect(withBackgroundMode({}, 'color').backdrop).toEqual({
			type: 'color',
			color: DEFAULT_STAGE_COLOR
		})
	})

	it('leaves the lighting alone', () => {
		expect(withBackgroundMode(stored, 'gradient').preset).toBe('studio-soft')
	})
})
