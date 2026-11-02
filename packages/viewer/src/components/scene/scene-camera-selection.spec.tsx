// @vitest-environment jsdom
/**
 * Which camera `SceneCamera` shows, and whether it flies there, run on the
 * real component with the frame loop stepped by hand.
 *
 * Source guards stood here before, and a flight was never run with them: the
 * switcher, a hotspot's way out and "Back to scene view" all landed at once in
 * the publisher for a release, because the publisher writes `camera_changed`
 * back as `activeCameraId` and the selection effect read that as an edit.
 */
import { act, render } from '@testing-library/react'
import { PerspectiveCamera, Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SceneCamera } from './scene-camera'

import type {
	ViewerCommandExecutor,
	ViewerInteractionEvent
} from '../../types/viewer-interactions'
import type { CameraProps, CameraTransitionConfig } from '@vctrl/core'
import type { OpeningPose } from '@vctrl/core/scene-camera'
import type { ComponentProps } from 'react'

const three = vi.hoisted(() => ({
	frames: new Set<() => void>(),
	state: null as null | Record<string, unknown>
}))

vi.mock('@react-three/fiber', async () => {
	const { useEffect, useRef } = await import('react')
	return {
		useThree: (select?: (state: unknown) => unknown) =>
			select ? select(three.state) : three.state,
		useFrame: (callback: () => void) => {
			const latest = useRef(callback)
			latest.current = callback
			useEffect(() => {
				const frame = () => latest.current()
				three.frames.add(frame)
				return () => {
					three.frames.delete(frame)
				}
			}, [])
		}
	}
})

vi.mock('@react-three/drei', () => ({ useBounds: () => ({}) }))

// The first view is the stored camera's; the bounds fit is not under test.
vi.mock('./initial-framing', () => ({ applyInitialFraming: () => undefined }))

const HERO = new Vector3(0, 0, 10)
const SIDE = new Vector3(10, 0, 0)
const TRANSITION: CameraTransitionConfig = {
	type: 'linear',
	duration: 1000,
	easing: 'linear'
}

const cameras = (sideFov = 50): NonNullable<CameraProps['cameras']> => [
	{
		cameraId: 'hero',
		name: 'Hero',
		position: HERO.toArray(),
		target: [0, 0, 0],
		fov: 50,
		initial: true
	},
	{
		cameraId: 'side',
		name: 'Side',
		position: SIDE.toArray(),
		target: [0, 0, 0],
		fov: sideFov
	}
]

let clock = 0
let camera: PerspectiveCamera
let executor: null | ViewerCommandExecutor

const step = (toMs: number) =>
	act(() => {
		clock = toMs
		for (const frame of [...three.frames]) frame()
	})

/** Mounts the camera layer and lets it frame, as the viewer does. */
async function mount(events: ViewerInteractionEvent[] = []) {
	const openingPose = { current: null as OpeningPose | null }
	const props = (
		overrides: Partial<ComponentProps<typeof SceneCamera>> = {}
	): ComponentProps<typeof SceneCamera> => ({
		cameras: cameras(),
		activeCameraId: 'hero',
		sceneTransition: TRANSITION,
		hasContent: true,
		boundsEnabled: false,
		openingPose,
		onCommandExecutorReady: (next) => {
			executor = next
		},
		onInteractionEvent: (event) => events.push(event),
		...overrides
	})
	const view = render(<SceneCamera {...props()} />)
	// The first placement runs from a timeout.
	await act(() => new Promise((resolve) => setTimeout(resolve)))
	for (let frame = 0; frame < 4 && !executor; frame++) step(clock)
	expect(executor).not.toBeNull()
	return {
		rerender: (overrides: Partial<ComponentProps<typeof SceneCamera>>) =>
			view.rerender(<SceneCamera {...props(overrides)} />)
	}
}

const activate = (cameraId: string) =>
	act(() => executor?.execute({ type: 'activate_camera', cameraId }))

beforeEach(() => {
	clock = 0
	executor = null
	three.frames.clear()
	camera = new PerspectiveCamera(50, 16 / 9)
	const controls = {
		target: new Vector3(),
		update: () => camera.lookAt(controls.target),
		minDistance: 0,
		maxDistance: Infinity
	}
	three.state = {
		camera,
		controls,
		size: { width: 1600, height: 900 },
		invalidate: () => undefined,
		get: () => three.state
	}
	vi.spyOn(performance, 'now').mockImplementation(() => clock)
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('a command flies the camera', () => {
	it('keeps flying when the host writes the camera back as activeCameraId', async () => {
		const events: ViewerInteractionEvent[] = []
		const { rerender } = await mount(events)
		expect(camera.position.distanceTo(HERO)).toBeLessThan(1e-6)

		activate('side')
		// The publisher's echo of `camera_changed`.
		rerender({ activeCameraId: 'side' })
		step(500)

		expect(camera.position.distanceTo(HERO)).toBeGreaterThan(1)
		expect(camera.position.distanceTo(SIDE)).toBeGreaterThan(1)
		// Following the view is not a new change to announce.
		expect(
			events.filter((event) => event.type === 'camera_changed')
		).toHaveLength(1)

		step(1000)
		expect(camera.position.distanceTo(SIDE)).toBeLessThan(1e-6)
	})

	it('stays where the command took it when the props still ask for the opening camera', async () => {
		const { rerender } = await mount()

		activate('side')
		step(1000)
		// An unrelated re-render: same request, a new array.
		rerender({ cameras: cameras() })
		step(1500)

		expect(camera.position.distanceTo(SIDE)).toBeLessThan(1e-6)
	})
})

describe('the props choose the camera', () => {
	it('fly to a different camera', async () => {
		const { rerender } = await mount()

		rerender({ activeCameraId: 'side' })
		step(500)

		expect(camera.position.distanceTo(HERO)).toBeGreaterThan(1)
		expect(camera.position.distanceTo(SIDE)).toBeGreaterThan(1)
	})

	it('apply an edit to the camera in view at once, ending a flight to it', async () => {
		const { rerender } = await mount()

		activate('side')
		rerender({ activeCameraId: 'side' })
		step(300)
		rerender({ activeCameraId: 'side', cameras: cameras(30) })

		expect(camera.fov).toBe(30)
		expect(camera.position.distanceTo(SIDE)).toBeLessThan(1e-6)
		step(500)
		expect(camera.position.distanceTo(SIDE)).toBeLessThan(1e-6)
	})

	it('put the camera back on the camera in view once a command has landed there', async () => {
		// A host switching through the props alone, not following the view.
		const { rerender } = await mount()

		activate('side')
		step(1000)
		// The visitor orbits away.
		camera.position.set(4, 4, 4)
		rerender({ activeCameraId: 'side' })

		expect(camera.position.distanceTo(SIDE)).toBeLessThan(1e-6)
	})

	it('apply an edit at once to a camera they flew to', async () => {
		const { rerender } = await mount()

		rerender({ activeCameraId: 'side' })
		step(1000)
		rerender({ activeCameraId: 'side', cameras: cameras(30) })

		expect(camera.fov).toBe(30)
	})
})
