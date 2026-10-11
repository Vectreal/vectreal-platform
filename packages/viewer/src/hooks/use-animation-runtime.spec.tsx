// @vitest-environment jsdom
/**
 * A host that draws its own playback controls follows
 * `animation_state_changed`, so the event has to cover every status change,
 * including the reset when the runtime goes away. Without that a host's button
 * stays on "pause" after the author turns animation off.
 */
import { act, renderHook } from '@testing-library/react'
import { AnimationClip } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { useAnimationRuntime } from './use-animation-runtime'

import type { ViewerInteractionEvent } from '../types/viewer-interactions'

const playing = {
	playing: true,
	complete: false,
	activeClipId: 'walk',
	active: true
}

const arrange = ({
	showControls = false,
	allowControls
}: { showControls?: boolean; allowControls?: boolean } = {}) => {
	const onInteractionEvent = vi.fn<(event: ViewerInteractionEvent) => void>()
	const { result } = renderHook(() =>
		useAnimationRuntime({
			animations: [new AnimationClip('Walk', 1, [])],
			options: {
				enabled: true,
				mode: 'simultaneous',
				autoplay: true,
				loopSequence: false,
				showControls,
				clips: []
			},
			hasContent: true,
			allowControls,
			onInteractionEvent
		})
	)
	return { result, onInteractionEvent }
}

describe('useAnimationRuntime', () => {
	it('announces nothing for the idle status it starts in', () => {
		const { onInteractionEvent } = arrange()

		expect(onInteractionEvent).not.toHaveBeenCalled()
	})

	it('announces a status the runtime reports', () => {
		const { result, onInteractionEvent } = arrange()

		act(() => result.current.setStatus(playing))

		expect(onInteractionEvent).toHaveBeenCalledWith({
			type: 'animation_state_changed',
			playing: true,
			activeClipId: 'walk',
			complete: false
		})
	})

	it('announces the reset when the runtime goes away', () => {
		const { result, onInteractionEvent } = arrange()
		act(() => result.current.setStatus(playing))
		onInteractionEvent.mockClear()

		act(() => result.current.registerExecutor(null))

		expect(onInteractionEvent).toHaveBeenCalledWith({
			type: 'animation_state_changed',
			playing: false,
			activeClipId: null,
			complete: false
		})
	})

	it('stays quiet when a re-registration lands back on the same status', () => {
		const { result, onInteractionEvent } = arrange()
		act(() => result.current.setStatus(playing))
		onInteractionEvent.mockClear()

		// What a model swap does: the runtime unregisters, then the new one
		// registers and reports where playback actually is.
		act(() => {
			result.current.registerExecutor(null)
			result.current.setStatus({ ...playing })
		})

		expect(onInteractionEvent).not.toHaveBeenCalled()
		expect(result.current.status.playing).toBe(true)
	})

	describe('the built-in controls', () => {
		it('show when the scene asks for them', () => {
			expect(arrange({ showControls: true }).result.current.showControls).toBe(
				true
			)
		})

		it('stay off when the host draws its own', () => {
			expect(
				arrange({ showControls: true, allowControls: false }).result.current
					.showControls
			).toBe(false)
		})

		it('never show unless the scene asks, whatever the host allows', () => {
			expect(
				arrange({ showControls: false, allowControls: true }).result.current
					.showControls
			).toBe(false)
		})
	})
})
