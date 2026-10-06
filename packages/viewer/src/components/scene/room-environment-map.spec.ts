// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useRoomEnvironmentMap } from './room-environment-map'

const gl = { name: 'renderer' }

const { generators, rooms, targets } = vi.hoisted(() => ({
	generators: [] as Array<{ renderer: unknown; dispose: () => void }>,
	rooms: [] as Array<{ dispose: () => void }>,
	targets: [] as Array<{ texture: object; dispose: () => void }>
}))

vi.mock('@react-three/fiber', () => ({
	useThree: (select: (state: { gl: unknown }) => unknown) => select({ gl })
}))

vi.mock('three', async (importOriginal) => ({
	...(await importOriginal<typeof import('three')>()),
	PMREMGenerator: class {
		dispose = vi.fn()
		constructor(public renderer: unknown) {
			generators.push(this)
		}
		fromScene(scene: unknown) {
			expect(rooms).toContain(scene)
			const target = { texture: { built: targets.length }, dispose: vi.fn() }
			targets.push(target)
			return target
		}
	}
}))

vi.mock('three/examples/jsm/environments/RoomEnvironment.js', () => ({
	RoomEnvironment: class {
		dispose = vi.fn()
		constructor() {
			rooms.push(this)
		}
	}
}))

afterEach(() => {
	generators.length = 0
	rooms.length = 0
	targets.length = 0
})

describe('useRoomEnvironmentMap', () => {
	it('builds the room on the viewer renderer and hands back its map', () => {
		const { result } = renderHook(() => useRoomEnvironmentMap())

		expect(generators.map((generator) => generator.renderer)).toEqual([gl])
		expect(result.current).toBe(targets[0].texture)
	})

	it('releases the room and the generator once the map is built', () => {
		renderHook(() => useRoomEnvironmentMap())

		expect(rooms[0].dispose).toHaveBeenCalledOnce()
		expect(generators[0].dispose).toHaveBeenCalledOnce()
		expect(targets[0].dispose).not.toHaveBeenCalled()
	})

	it('releases the map when the scene no longer needs it', () => {
		const { unmount } = renderHook(() => useRoomEnvironmentMap())

		unmount()

		expect(targets[0].dispose).toHaveBeenCalledOnce()
	})
})
