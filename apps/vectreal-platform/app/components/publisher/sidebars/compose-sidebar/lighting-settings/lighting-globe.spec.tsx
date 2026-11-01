// @vitest-environment jsdom
/**
 * The globe turns the environment, and every light with it, and draws the
 * sky the way the scene turns it.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { resolveLighting } from '@vctrl/core'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { dragDegrees, projectOnGlobe } from './globe-projection'
import { LightingGlobe } from './lighting-globe'

describe('projectOnGlobe', () => {
	it('puts the front low and toward the viewer, and the zenith high', () => {
		const front = projectOnGlobe({ azimuth: 0, elevation: 0 }, 0)
		expect(front.x).toBeCloseTo(0)
		expect(front.y).toBeGreaterThan(0)
		expect(front.front).toBe(true)

		const zenith = projectOnGlobe({ azimuth: 0, elevation: 90 }, 0)
		expect(zenith.y).toBeLessThan(0)
		expect(zenith.front).toBe(true)

		expect(projectOnGlobe({ azimuth: 180, elevation: 0 }, 0).front).toBe(false)
	})

	it('turns a direction by the rotation, as the scene does', () => {
		// Azimuth 90 is toward +X, drawn to the right.
		expect(projectOnGlobe({ azimuth: 90, elevation: 0 }, 0).x).toBeCloseTo(1)
		expect(projectOnGlobe({ azimuth: 0, elevation: 0 }, 90).x).toBeCloseTo(1)
		expect(projectOnGlobe({ azimuth: 90, elevation: 0 }, -90).x).toBeCloseTo(0)
	})

	it('is seen from the camera, whose side is its center', () => {
		const fromRight = { azimuth: 90, elevation: 0 }
		// Looking from +X, a light at +X faces the camera and +Z is on its left.
		const facing = projectOnGlobe({ azimuth: 90, elevation: 0 }, 0, fromRight)
		expect(facing.x).toBeCloseTo(0)
		expect(facing.front).toBe(true)
		expect(
			projectOnGlobe({ azimuth: 0, elevation: 0 }, 0, fromRight).x
		).toBeCloseTo(-1)

		// Looking straight down, the zenith is the center.
		const zenith = projectOnGlobe({ azimuth: 0, elevation: 90 }, 0, {
			azimuth: 0,
			elevation: 90
		})
		expect(zenith.x).toBeCloseTo(0)
		expect(zenith.y).toBeCloseTo(0)
	})

	it('is seen from below when the camera orbits under the model', () => {
		const below = { azimuth: 0, elevation: -30 }
		// The near horizon rises above the center, and the zenith turns away.
		expect(
			projectOnGlobe({ azimuth: 0, elevation: 0 }, 0, below).y
		).toBeLessThan(0)
		expect(projectOnGlobe({ azimuth: 0, elevation: 90 }, 0, below).front).toBe(
			false
		)
	})

	it('turns a quarter of the globe for a drag of a quarter of its circumference', () => {
		expect(dragDegrees((Math.PI / 2) * 60, 60)).toBeCloseTo(90)
	})
})

describe('LightingGlobe', () => {
	beforeAll(() => {
		// jsdom has no pointer capture.
		HTMLElement.prototype.setPointerCapture = vi.fn()
	})

	const renderGlobe = (
		rotation = 0,
		lights = resolveLighting({ lighting: {} }).lights
	) => {
		const onRotationChange = vi.fn()
		render(
			<LightingGlobe
				rotation={rotation}
				onRotationChange={onRotationChange}
				map="studio-key"
				lights={lights}
			/>
		)
		return {
			onRotationChange,
			globe: screen.getByRole('slider', { name: 'Turn' })
		}
	}

	it('reads as a slider in degrees', () => {
		const { globe } = renderGlobe(-45)
		expect(globe).toHaveAttribute('aria-valuenow', '-45')
		expect(globe).toHaveAttribute('aria-valuetext', '-45°')
		expect(globe).toHaveAttribute('aria-valuemin', '-180')
		expect(globe).toHaveAttribute('aria-valuemax', '179')
	})

	it('shows a fractional turn as a whole degree inside its range', () => {
		const { globe } = renderGlobe(179.6)
		expect(globe).toHaveAttribute('aria-valuenow', '-180')
		expect(globe).toHaveAttribute('aria-valuetext', '-180°')
	})

	it('steps with the arrow keys and pages, ten times with Shift, and Home and End go to its ends', () => {
		const { globe, onRotationChange } = renderGlobe(10)
		fireEvent.keyDown(globe, { key: 'ArrowRight' })
		fireEvent.keyDown(globe, { key: 'ArrowLeft', shiftKey: true })
		fireEvent.keyDown(globe, { key: 'PageUp' })
		fireEvent.keyDown(globe, { key: 'PageDown', shiftKey: true })
		fireEvent.keyDown(globe, { key: 'Home' })
		fireEvent.keyDown(globe, { key: 'End' })
		expect(onRotationChange.mock.calls.map(([value]) => value)).toEqual([
			11, 0, 20, -90, -180, 179
		])
	})

	it('wraps past 180 rather than stopping', () => {
		const { globe, onRotationChange } = renderGlobe(179)
		fireEvent.keyDown(globe, { key: 'ArrowRight', shiftKey: true })
		fireEvent.keyDown(globe, { key: 'ArrowRight' })
		expect(onRotationChange.mock.calls.map(([value]) => value)).toEqual([
			-171, -180
		])
	})

	it('turns with a sideways drag, from where the drag began', () => {
		const { globe, onRotationChange } = renderGlobe(30)
		fireEvent.pointerDown(globe, { clientX: 100, pointerId: 1 })
		fireEvent.pointerMove(globe, { clientX: 100 + (Math.PI / 2) * 62 })
		expect(onRotationChange).toHaveBeenLastCalledWith(120)
		fireEvent.pointerUp(globe)
		fireEvent.pointerMove(globe, { clientX: 400 })
		expect(onRotationChange).toHaveBeenCalledTimes(1)
	})

	it('follows the pointer at the size it is drawn', () => {
		const { globe, onRotationChange } = renderGlobe(0)
		// Drawn at half size, so its radius is 31 pixels.
		Object.defineProperty(globe, 'clientWidth', { value: 74 })
		fireEvent.pointerDown(globe, { clientX: 0, pointerId: 1 })
		fireEvent.pointerMove(globe, { clientX: (Math.PI / 2) * 31 })
		expect(onRotationChange).toHaveBeenLastCalledWith(90)
	})

	it('ends a drag when it is cancelled or loses the pointer, and ignores other buttons', () => {
		const { globe, onRotationChange } = renderGlobe(0)
		fireEvent.pointerDown(globe, { clientX: 0, pointerId: 1 })
		fireEvent.pointerCancel(globe)
		fireEvent.pointerMove(globe, { clientX: 50 })

		fireEvent.pointerDown(globe, { clientX: 0, pointerId: 1 })
		fireEvent.lostPointerCapture(globe)
		fireEvent.pointerMove(globe, { clientX: 50 })

		fireEvent.pointerDown(globe, { clientX: 0, pointerId: 1, button: 2 })
		fireEvent.pointerMove(globe, { clientX: 50 })

		expect(onRotationChange).not.toHaveBeenCalled()
	})

	it('draws only the lights the scene draws', () => {
		const lit = resolveLighting({
			lighting: {
				lights: [
					{ role: 'key', intensity: 1 },
					{ role: 'fill', intensity: 0 },
					{ role: 'rim', intensity: 1, enabled: false }
				]
			}
		}).lights
		renderGlobe(0, lit)
		expect(
			[...document.querySelectorAll('circle title')].map(
				(title) => title.textContent
			)
		).toEqual(['Key light'])
	})

	it('turns back to the front on a double-click', () => {
		const { globe, onRotationChange } = renderGlobe(75)
		fireEvent.doubleClick(globe)
		expect(onRotationChange).toHaveBeenCalledWith(0)
	})

	it('draws the near horizon below the center from above, above it from below', () => {
		// The near horizon is the solid arc; its sweep flag picks the lower half
		// (0) or the upper one (1) going left to right.
		const nearSweep = (elevation: number) => {
			const { container, unmount } = render(
				<LightingGlobe
					rotation={0}
					onRotationChange={() => {}}
					map="studio-key"
					lights={[]}
					view={{ azimuth: 0, elevation }}
				/>
			)
			const near = container.querySelector('path[stroke-opacity="0.45"]')
			const flag = near?.getAttribute('d')?.match(/0 0 ([01]) \S+ \S+$/)?.[1]
			unmount()
			return flag
		}
		expect(nearSweep(30)).toBe('0')
		expect(nearSweep(-30)).toBe('1')
	})
})
