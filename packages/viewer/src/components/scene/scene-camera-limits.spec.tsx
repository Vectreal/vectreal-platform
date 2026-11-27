// @vitest-environment jsdom
/**
 * The limits `SceneCamera` holds a visitor to: each camera's own, anchored on
 * the view it lands at, open while a flight plays, and the orbit point kept
 * inside the model. Run on the real component with the frame loop stepped by
 * hand, as `scene-camera-selection.spec.tsx` does.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, render } from '@testing-library/react'
import {
	clampToOrbitLimits,
	resolveCameraConstraints
} from '@vctrl/core/scene-camera'
import {
	BoxGeometry,
	EventDispatcher,
	Group,
	Mesh,
	MeshBasicMaterial,
	PerspectiveCamera,
	Vector3
} from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SceneCamera } from './scene-camera'

import type { ViewerCommandExecutor } from '../../types/viewer-interactions'
import type { SceneCameraSnapshotRestore } from '../../types/viewer-types'
import type { CameraProps, ControlsProps } from '@vctrl/core'
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
// A bounds fit stands the camera 3 from the model, closer than the opening
// camera lets a visitor zoom; a stored camera is left be.
vi.mock('./initial-framing', () => ({
	applyInitialFraming: (
		_bounds: unknown,
		_model: unknown,
		camera: { position: { set: (x: number, y: number, z: number) => void } },
		controls: { update?: () => void } | null,
		fitToBounds: boolean
	) => {
		if (!fitToBounds) return
		camera.position.set(0, 0, 3)
		controls?.update?.()
	}
}))

const RADIANS = Math.PI / 180

const cameras: NonNullable<CameraProps['cameras']> = [
	{
		cameraId: 'hero',
		name: 'Hero',
		position: [0, 0, 10],
		target: [0, 0, 0],
		fov: 50,
		initial: true,
		constraints: {
			zoom: { closer: 2, farther: 2 },
			orbit: { left: 30, right: 30 },
			tilt: { lowest: 0, highest: 60 }
		}
	},
	{
		cameraId: 'side',
		name: 'Side',
		position: [4, 0, 0],
		target: [0, 0, 0],
		fov: 50,
		constraints: { zoom: { closer: 1, farther: 4 } }
	},
	{
		cameraId: 'legacy',
		name: 'Legacy',
		position: [0, 0, 8],
		target: [0, 0, 0],
		fov: 50
	}
]

const SCENE_WIDE: ControlsProps = {
	minDistance: 3,
	maxDistance: 9,
	maxPolarAngle: Math.PI / 2
}

const constraintsFor = (cameraId: string) =>
	resolveCameraConstraints(
		cameras.find((camera) => camera.cameraId === cameraId)?.constraints,
		SCENE_WIDE
	)

class FakeControls extends EventDispatcher<{ change: object }> {
	target = new Vector3()
	minDistance = 0
	maxDistance = Infinity
	minPolarAngle = 0
	maxPolarAngle = Math.PI
	minAzimuthAngle = -Infinity
	maxAzimuthAngle = Infinity
	/** Clamps as OrbitControls does, so limits written late show. */
	update = () => {
		camera.position.copy(
			clampToOrbitLimits(camera.position, this.target, camera.up, this)
		)
		camera.lookAt(this.target)
	}
}

let clock = 0
let camera: PerspectiveCamera
let controls: FakeControls
let executor: null | ViewerCommandExecutor

const step = (toMs: number) =>
	act(() => {
		clock = toMs
		for (const frame of [...three.frames]) frame()
	})

/** A 2 x 2 x 2 model around the origin. */
const model = () => {
	const group = new Group()
	group.add(new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial()))
	return group
}

async function mount(extra: Partial<ComponentProps<typeof SceneCamera>> = {}) {
	const openingPose = { current: null as OpeningPose | null }
	const shown = model()
	const element = (overrides: Partial<ComponentProps<typeof SceneCamera>>) => (
		<SceneCamera
			cameras={cameras}
			activeCameraId="hero"
			sceneTransition={{ type: 'linear', duration: 1000, easing: 'linear' }}
			hasContent
			boundsEnabled={false}
			model={shown}
			openingPose={openingPose}
			constraintsFor={constraintsFor}
			onCommandExecutorReady={(next) => {
				executor = next
			}}
			{...extra}
			{...overrides}
		/>
	)
	const view = render(element({}))
	await act(() => new Promise((resolve) => setTimeout(resolve)))
	for (let frame = 0; frame < 4 && !executor; frame++) step(clock)
	expect(executor).not.toBeNull()
	return {
		rerender: (overrides: Partial<ComponentProps<typeof SceneCamera>>) =>
			view.rerender(element(overrides))
	}
}

const activate = (cameraId: string) =>
	act(() => executor?.execute({ type: 'activate_camera', cameraId }))

const limits = () => ({
	minDistance: controls.minDistance,
	maxDistance: controls.maxDistance,
	minPolarAngle: controls.minPolarAngle,
	maxPolarAngle: controls.maxPolarAngle,
	minAzimuthAngle: controls.minAzimuthAngle,
	maxAzimuthAngle: controls.maxAzimuthAngle
})

beforeEach(() => {
	clock = 0
	executor = null
	three.frames.clear()
	camera = new PerspectiveCamera(50, 16 / 9)
	controls = new FakeControls()
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

describe('a camera’s own limits', () => {
	it('hold the visitor around the view the scene opens on', async () => {
		await mount()
		const held = limits()
		expect(held.minDistance).toBeCloseTo(5)
		expect(held.maxDistance).toBeCloseTo(20)
		expect(held.minAzimuthAngle).toBeCloseTo(-30 * RADIANS)
		expect(held.maxAzimuthAngle).toBeCloseTo(30 * RADIANS)
		expect(held.minPolarAngle).toBeCloseTo(30 * RADIANS)
		expect(held.maxPolarAngle).toBeCloseTo(Math.PI / 2)
	})

	it('open while a flight plays, and become the destination’s when it lands', async () => {
		await mount()
		activate('side')
		step(500)
		expect(limits()).toEqual({
			minDistance: 0,
			maxDistance: Infinity,
			minPolarAngle: 0,
			maxPolarAngle: Math.PI,
			minAzimuthAngle: -Infinity,
			maxAzimuthAngle: Infinity
		})

		step(1000)
		const held = limits()
		expect(held.minDistance).toBeCloseTo(4)
		expect(held.maxDistance).toBeCloseTo(16)
		// Side left tilt and orbit out: not limited.
		expect(held.minAzimuthAngle).toBe(-Infinity)
		expect(held.maxPolarAngle).toBeCloseTo(Math.PI)
	})

	it('give way to the scene-wide controls for a camera without any', async () => {
		await mount({ activeCameraId: 'legacy' })
		const held = limits()
		expect(held.minDistance).toBeCloseTo(3)
		expect(held.maxDistance).toBeCloseTo(9)
		expect(held.maxPolarAngle).toBeCloseTo(Math.PI / 2)
	})
})

describe('the order limits are written in', () => {
	it('lands a camera switched to at once at its own pose, not the last camera’s limits', async () => {
		await mount({ sceneTransition: { type: 'none' } })
		activate('side')
		// Hero held the distance to at least 5; side stands at 4.
		expect(camera.position.distanceTo(controls.target)).toBeCloseTo(4)
	})

	it('keeps the camera in view’s limits when a stored view is put back', async () => {
		let restore: SceneCameraSnapshotRestore | null = null
		await mount({
			onCameraSnapshotRestoreReady: (next) => {
				restore = next
			}
		})
		act(() =>
			restore?.({
				position: [0, 0, 12],
				rotation: [0, 0, 0],
				target: [0, 0, 0],
				fov: 50,
				framingAspect: 16 / 9,
				viewportAspect: 16 / 9
			})
		)
		step(clock)
		expect(controls.minDistance).toBeCloseTo(5)
		expect(controls.maxDistance).toBeCloseTo(20)
	})

	it('opens the limits for a double-click focus flight too', async () => {
		const focusRequest = {
			current: null as null | ((point: Vector3) => void)
		}
		await mount({ focusRequest })
		act(() => focusRequest.current?.(new Vector3(0.5, 0.5, 0.5)))
		step(clock + 16)
		expect(controls.minDistance).toBe(0)
		expect(controls.maxAzimuthAngle).toBe(Infinity)
	})

	it('anchors on the bounds fit when the scene opens on one', async () => {
		await mount({ boundsEnabled: true })
		expect(camera.position.distanceTo(controls.target)).toBeCloseTo(3)
		expect(controls.minDistance).toBeCloseTo(1.5)
		expect(controls.maxDistance).toBeCloseTo(6)
	})

	it('keeps clamping the bounds fit to the scene-wide limits for a camera without its own', async () => {
		// The scene-wide minimum is 3, the fit stands at 3: move it closer.
		await mount({
			activeCameraId: 'legacy',
			boundsEnabled: true,
			constraintsFor: (cameraId) =>
				resolveCameraConstraints(
					cameras.find((camera) => camera.cameraId === cameraId)?.constraints,
					{ ...SCENE_WIDE, minDistance: 4 }
				)
		})
		expect(camera.position.distanceTo(controls.target)).toBeCloseTo(4)
	})
})

describe('the orbit point', () => {
	const panTo = (x: number) => {
		const delta = x - controls.target.x
		controls.target.x += delta
		camera.position.x += delta
		controls.dispatchEvent({ type: 'change' })
	}

	it('stays inside the model, and the camera stops with it', async () => {
		await mount()
		const offset = camera.position.clone().sub(controls.target)

		panTo(5)

		expect(controls.target.x).toBeCloseTo(1)
		expect(camera.position.clone().sub(controls.target)).toEqual(offset)
	})

	it('pans as freely as before for a camera without limits of its own', async () => {
		await mount({ activeCameraId: 'legacy' })
		panTo(5)
		expect(controls.target.x).toBeCloseTo(5)
	})

	it('is left to a flight while one plays', async () => {
		await mount()
		activate('side')
		step(500)
		panTo(5)
		expect(controls.target.x).toBeCloseTo(5)
	})

	it('is free in the host’s editing view', async () => {
		await mount({ freeCamera: true })
		panTo(5)
		expect(controls.target.x).toBeCloseTo(5)
	})
})

it('re-reads the camera in view’s limits when they change', async () => {
	const { rerender } = await mount({ activeCameraId: 'legacy' })
	expect(controls.maxDistance).toBeCloseTo(9)

	// A new resolver: the scene-wide controls changed.
	rerender({
		constraintsFor: (cameraId) =>
			resolveCameraConstraints(
				cameras.find((camera) => camera.cameraId === cameraId)?.constraints,
				{ maxDistance: 12 }
			)
	})

	expect(controls.maxDistance).toBeCloseTo(12)
})

describe('the viewer', () => {
	const viewer = readFileSync(
		join(import.meta.dirname, '../../vectreal-viewer.tsx'),
		'utf8'
	)
	const controlsElement = viewer.slice(
		viewer.indexOf('<SceneControls'),
		viewer.indexOf('/>', viewer.indexOf('<SceneControls'))
	)

	it('switches zoom, pan and rotation by the camera in view', () => {
		expect(viewer).toMatch(
			/const activeConstraints = useMemo\(\s*\(\) =>\s*constraintsFor\(\s*activeCameraId \?\?/
		)
		expect(controlsElement).toContain('enableZoom={activeConstraints.zoom}')
		expect(controlsElement).toContain('enablePan={activeConstraints.pan}')
		expect(controlsElement).toContain('enableRotate={activeConstraints.rotate}')
	})

	it('turns auto rotate off for a camera limited in orbit', () => {
		expect(controlsElement).toMatch(
			/activeConstraints\.azimuth\.relative\s*\?\s*\{ autoRotate: false \}/
		)
	})

	it('gives the keyboard the same switches', () => {
		const keys = viewer.slice(viewer.indexOf('const viewerKeys = useMemo('))
		expect(keys.slice(0, 900)).toContain('activeConstraints.zoom')
		expect(keys.slice(0, 900)).toContain('activeConstraints.pan')
	})

	it('frees a camera’s own limits in a host’s editing view', () => {
		expect(viewer).toMatch(
			/freeCamera\s*\?\s*undefined\s*:\s*aimedCameras\?\.find/
		)
	})
})
