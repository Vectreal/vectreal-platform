// @vitest-environment jsdom
import { render, renderHook } from '@testing-library/react'
import { createElement, Fragment, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useRoomEnvironment } from './room-environment'

const { calls, renderer, scene, targets } = vi.hoisted(() => ({
	calls: [] as string[],
	renderer: { current: null as unknown },
	scene: {
		current: { environment: null, environmentIntensity: 1 } as {
			environment: unknown
			environmentIntensity: number
		}
	},
	targets: [] as Array<{ texture: object; dispose: () => void }>
}))

const makeRenderer = (name: string) => ({
	name,
	domElement: new EventTarget()
})

vi.mock('@react-three/fiber', () => ({
	useThree: (select: (state: { gl: unknown; scene: unknown }) => unknown) =>
		select({ gl: renderer.current, scene: scene.current })
}))

vi.mock('three', async (importOriginal) => ({
	...(await importOriginal<typeof import('three')>()),
	PMREMGenerator: class {
		disposed = false
		constructor(private gl: { name: string }) {
			calls.push(`generator on ${gl.name}`)
		}
		fromScene() {
			if (this.disposed) throw new Error('generator used after dispose')
			calls.push('fromScene')
			const target = {
				texture: { built: targets.length },
				dispose: vi.fn(() =>
					calls.push(`map ${targets.indexOf(target)} disposed`)
				)
			}
			targets.push(target)
			return target
		}
		dispose() {
			this.disposed = true
			calls.push('generator disposed')
		}
	}
}))

vi.mock('three/examples/jsm/environments/RoomEnvironment.js', () => ({
	RoomEnvironment: class {
		dispose() {
			calls.push('room disposed')
		}
	}
}))

beforeEach(() => {
	renderer.current = makeRenderer('viewer')
	scene.current = { environment: 'previous map', environmentIntensity: 1 }
})

afterEach(() => {
	calls.length = 0
	targets.length = 0
})

describe('useRoomEnvironment', () => {
	it("lights the viewer's scene with a room built on the viewer's renderer", () => {
		renderHook(() => useRoomEnvironment(0.7, undefined))

		expect(scene.current.environment).toBe(targets[0].texture)
		expect(scene.current.environmentIntensity).toBe(0.7)
		expect(calls).toEqual([
			'generator on viewer',
			'fromScene',
			'room disposed',
			'generator disposed'
		])
	})

	it('is in place before a passive effect beside it compiles the scene', () => {
		const seenByWarmUp: unknown[] = []
		const Room = () => {
			useRoomEnvironment(1, undefined)
			return null
		}
		const WarmUp = () => {
			useEffect(() => {
				seenByWarmUp.push(scene.current.environment)
			}, [])
			return null
		}

		render(
			createElement(Fragment, null, createElement(WarmUp), createElement(Room))
		)

		expect(seenByWarmUp).toEqual([targets[0].texture])
	})

	it('lights the scene it is given, by itself or through a ref', () => {
		const own = { environment: null, environmentIntensity: 1 }
		const viaRef = { environment: null, environmentIntensity: 1 }

		renderHook(() => useRoomEnvironment(1, own as never))
		renderHook(() => useRoomEnvironment(1, { current: viaRef } as never))

		expect(own.environment).toBe(targets[0].texture)
		expect(viaRef.environment).toBe(targets[1].texture)
		expect(scene.current.environment).toBe('previous map')
	})

	it('puts the scene back and releases the room when it is no longer needed', () => {
		scene.current.environmentIntensity = 0.4
		const { unmount } = renderHook(() => useRoomEnvironment(0.7, undefined))

		unmount()

		expect(scene.current).toEqual({
			environment: 'previous map',
			environmentIntensity: 0.4
		})
		expect(targets[0].dispose).toHaveBeenCalledOnce()
	})

	it('follows a new intensity without building the room again', () => {
		const { rerender } = renderHook(
			({ intensity }) => useRoomEnvironment(intensity, undefined),
			{ initialProps: { intensity: 0.7 } }
		)

		rerender({ intensity: 2 })

		expect(scene.current.environmentIntensity).toBe(2)
		expect(targets).toHaveLength(1)
	})

	it('builds the room again after the context is restored', () => {
		renderHook(() => useRoomEnvironment(1, undefined))
		const gl = renderer.current as ReturnType<typeof makeRenderer>

		gl.domElement.dispatchEvent(new Event('webglcontextrestored'))

		expect(targets[0].dispose).toHaveBeenCalledOnce()
		expect(scene.current.environment).toBe(targets[1].texture)
	})

	it('stops listening for a restored context once it is gone', () => {
		const { unmount } = renderHook(() => useRoomEnvironment(1, undefined))
		const gl = renderer.current as ReturnType<typeof makeRenderer>
		unmount()

		gl.domElement.dispatchEvent(new Event('webglcontextrestored'))

		expect(targets).toHaveLength(1)
	})

	it('builds the room on a new renderer and releases the old one', () => {
		const { rerender } = renderHook(() => useRoomEnvironment(1, undefined))

		renderer.current = makeRenderer('replacement')
		rerender()

		expect(targets[0].dispose).toHaveBeenCalledOnce()
		expect(calls).toContain('generator on replacement')
		expect(scene.current.environment).toBe(targets[1].texture)
	})
})
