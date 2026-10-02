// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useHeldExecutor } from './use-held-executor'

/**
 * A command sent while a scene layer is not mounted used to reach a null
 * executor and vanish. The slot holds it for the layer instead.
 */

function slot() {
	return renderHook(() => useHeldExecutor()).result
}

describe('useHeldExecutor', () => {
	it('runs a command straight away once the layer is registered', () => {
		const result = slot()
		const execute = vi.fn()

		act(() => result.current.register({ execute }))
		result.current.execute({ type: 'activate_camera', cameraId: 'a' })

		expect(execute).toHaveBeenCalledWith({
			type: 'activate_camera',
			cameraId: 'a'
		})
	})

	it('holds a command until the layer registers, then runs it', () => {
		const result = slot()
		const execute = vi.fn()

		result.current.execute({ type: 'activate_camera', cameraId: 'a' })
		expect(execute).not.toHaveBeenCalled()

		act(() => result.current.register({ execute }))

		expect(execute).toHaveBeenCalledWith({
			type: 'activate_camera',
			cameraId: 'a'
		})
	})

	it('keeps the latest of each type, in the order they were last sent', () => {
		const result = slot()
		const execute = vi.fn()

		result.current.execute({ type: 'activate_camera', cameraId: 'a' })
		result.current.execute({ type: 'set_animation_playing', playing: true })
		result.current.execute({ type: 'activate_camera', cameraId: 'b' })
		act(() => result.current.register({ execute }))

		expect(execute.mock.calls.map(([command]) => command)).toEqual([
			{ type: 'set_animation_playing', playing: true },
			{ type: 'activate_camera', cameraId: 'b' }
		])
	})

	it('holds again while the layer is gone, and replays only once', () => {
		const result = slot()
		const first = vi.fn()
		const second = vi.fn()

		act(() => result.current.register({ execute: first }))
		act(() => result.current.register(null))
		result.current.execute({ type: 'focus_hotspot', hotspotId: 'h' })
		expect(first).not.toHaveBeenCalled()

		act(() => result.current.register({ execute: second }))
		act(() => result.current.register({ execute: second }))

		expect(second).toHaveBeenCalledTimes(1)
	})
})
