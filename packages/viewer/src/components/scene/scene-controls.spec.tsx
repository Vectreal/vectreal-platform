// @vitest-environment jsdom
/**
 * The orbit controls report where the camera looks from, in the lights'
 * terms, once on mount and then whenever it turns at least half a degree.
 */
import { render } from '@testing-library/react'
import { forwardRef, useImperativeHandle } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SceneControls from './scene-controls'

const camera = vi.hoisted(() => ({
	azimuth: 0,
	polar: Math.PI / 2,
	onChange: undefined as undefined | ((event?: unknown) => void)
}))

vi.mock('@react-three/drei', () => ({
	OrbitControls: forwardRef(function OrbitControls(
		props: { onChange?: (event?: unknown) => void },
		ref
	) {
		camera.onChange = props.onChange
		useImperativeHandle(ref, () => ({
			getAzimuthalAngle: () => camera.azimuth,
			getPolarAngle: () => camera.polar
		}))
		return null
	})
}))

const RADIANS = Math.PI / 180

const orbitTo = (azimuth: number, elevation: number) => {
	camera.azimuth = azimuth * RADIANS
	camera.polar = (90 - elevation) * RADIANS
	camera.onChange?.()
}

beforeEach(() => {
	camera.azimuth = 0
	camera.polar = Math.PI / 2
})

describe('SceneControls', () => {
	it('reports the view it opens on, in degrees', () => {
		camera.azimuth = 90 * RADIANS
		camera.polar = 60 * RADIANS
		const onViewChange = vi.fn()
		render(<SceneControls onViewChange={onViewChange} />)
		expect(onViewChange).toHaveBeenCalledTimes(1)
		const [view] = onViewChange.mock.calls[0]
		expect(view.azimuth).toBeCloseTo(90)
		expect(view.elevation).toBeCloseTo(30)
	})

	it('reports a turn of half a degree or more, and nothing smaller', () => {
		const onViewChange = vi.fn()
		render(<SceneControls onViewChange={onViewChange} />)
		onViewChange.mockClear()

		orbitTo(0.3, 0.2)
		expect(onViewChange).not.toHaveBeenCalled()

		orbitTo(45, 20)
		expect(onViewChange).toHaveBeenCalledTimes(1)
		expect(onViewChange.mock.calls[0][0].azimuth).toBeCloseTo(45)
		expect(onViewChange.mock.calls[0][0].elevation).toBeCloseTo(20)
	})

	it('keeps calling an onChange passed with the controls options', () => {
		const onChange = vi.fn()
		const onViewChange = vi.fn()
		render(<SceneControls onChange={onChange} onViewChange={onViewChange} />)
		onViewChange.mockClear()

		orbitTo(30, 10)
		expect(onChange).toHaveBeenCalledTimes(1)
		expect(onViewChange).toHaveBeenCalledTimes(1)
	})

	it('tells a new listener the current view at once', () => {
		const first = vi.fn()
		const { rerender } = render(<SceneControls onViewChange={first} />)
		const second = vi.fn()
		rerender(<SceneControls onViewChange={second} />)
		expect(second).toHaveBeenCalledTimes(1)
	})

	it('reports a turn of either axis alone', () => {
		const onViewChange = vi.fn()
		render(<SceneControls onViewChange={onViewChange} />)
		onViewChange.mockClear()

		orbitTo(1, 0)
		expect(onViewChange).toHaveBeenCalledTimes(1)

		orbitTo(1, 1)
		expect(onViewChange).toHaveBeenCalledTimes(2)
	})

	it('reports small steps once they add up to half a degree', () => {
		const onViewChange = vi.fn()
		render(<SceneControls onViewChange={onViewChange} />)
		onViewChange.mockClear()

		orbitTo(0.3, 0)
		expect(onViewChange).not.toHaveBeenCalled()
		orbitTo(0.6, 0)
		expect(onViewChange).toHaveBeenCalledTimes(1)
	})
})
