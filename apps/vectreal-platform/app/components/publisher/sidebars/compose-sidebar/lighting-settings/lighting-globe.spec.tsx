// @vitest-environment jsdom
/**
 * The globe turns the environment, and every light with it, and draws the
 * sky the way the scene turns it.
 */
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react'
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
		// jsdom has no pointer capture, nor the observer the tooltip places itself with.
		HTMLElement.prototype.setPointerCapture = vi.fn()
		document.elementFromPoint ??= () => null
		globalThis.ResizeObserver ??= class {
			observe() {}
			unobserve() {}
			disconnect() {}
		}
	})

	// A key and a fill toward the camera, and a rim behind the globe.
	const studio = resolveLighting({
		lighting: {
			lights: [
				{ role: 'key', intensity: 1, azimuth: 40, elevation: 35 },
				{ role: 'fill', intensity: 1, azimuth: -60, elevation: 20 },
				{ role: 'rim', intensity: 1, azimuth: 170, elevation: 30 }
			]
		}
	}).lights

	const markAt = (id: string) =>
		document.querySelector(`circle[data-mark="${id}"]`) as Element

	const glossaryNames = () =>
		[...document.querySelectorAll('li > span > span.font-medium')].map(
			(name) => name.textContent
		)

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
			[...document.querySelectorAll('circle[data-mark]')].map((mark) =>
				mark.getAttribute('data-mark')
			)
		).not.toContain('fill')
		expect(glossaryNames()).toEqual(['Key light', 'Bright spot'])
	})

	it('names a mark under the pointer, and lets go of it for a drag', async () => {
		const { globe } = renderGlobe(0, studio)
		fireEvent.pointerEnter(markAt('key'), { pointerType: 'mouse' })
		expect(await screen.findByRole('tooltip')).toHaveTextContent(
			'Key lightMain light, casts the shadow'
		)

		fireEvent.pointerDown(globe, { clientX: 0, pointerId: 1 })
		// It fades out where it was, still naming the mark.
		const anchor = globe.querySelector<HTMLElement>('span.absolute')
		expect(anchor?.style.left).not.toBe('')
		await waitFor(() =>
			expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
		)
	})

	it('lets go of a named mark on Escape, and once anything moves it, for good', async () => {
		const globeAt = (
			rotation: number,
			view = { azimuth: 0, elevation: 20 }
		) => (
			<LightingGlobe
				rotation={rotation}
				onRotationChange={() => {}}
				map="studio-key"
				lights={studio}
				view={view}
			/>
		)
		const { rerender } = render(globeAt(0))
		const settle = () => new Promise((resolve) => setTimeout(resolve, 50))
		const closed = () =>
			waitFor(() =>
				expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
			)
		const anchorLeft = () =>
			document.querySelector<HTMLElement>('[role="slider"] span.absolute')
				?.style.left

		fireEvent.pointerEnter(markAt('key'), { pointerType: 'mouse' })
		await screen.findByRole('tooltip')
		fireEvent.keyDown(document.activeElement ?? document.body, {
			key: 'Escape'
		})
		await closed()

		// Turned half way round: the key goes behind, and the tooltip fades
		// out where it was, never following the mark.
		fireEvent.pointerEnter(markAt('key'), { pointerType: 'mouse' })
		await screen.findByRole('tooltip')
		const hoveredAt = anchorLeft()
		rerender(globeAt(180))
		await closed()
		expect(anchorLeft()).toBe(hoveredAt)
		// Turning back brings back no tooltip nobody is pointing at.
		rerender(globeAt(0))
		await settle()
		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

		// The camera moving the mark closes it too.
		fireEvent.pointerEnter(markAt('key'), { pointerType: 'mouse' })
		await screen.findByRole('tooltip')
		rerender(globeAt(0, { azimuth: 30, elevation: 20 }))
		await closed()
	})

	it('keeps a mark a press closed quiet until the pointer moves', async () => {
		const { globe } = renderGlobe(0, studio)
		fireEvent.pointerEnter(markAt('key'), { pointerType: 'mouse' })
		await screen.findByRole('tooltip')

		// A click on the mark: releasing the capture enters it again.
		fireEvent.pointerDown(globe, { clientX: 0, pointerId: 1 })
		vi.spyOn(document, 'elementFromPoint').mockReturnValue(markAt('key'))
		fireEvent.pointerUp(globe, { clientX: 0, pointerId: 1 })
		fireEvent.pointerEnter(markAt('key'), { pointerType: 'mouse' })
		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

		// Moved off and back, as after the spot turned away and returned.
		fireEvent.pointerMove(globe, { clientX: 5 })
		fireEvent.pointerEnter(markAt('key'), { pointerType: 'mouse' })
		expect(await screen.findByRole('tooltip')).toHaveTextContent('Key light')
	})

	it('names a light on the far side as behind', () => {
		renderGlobe(0, studio)
		expect(glossaryNames()).toContain('Rim light, behind')
		// Turned half way round, the key goes behind and the rim comes forward.
		cleanup()
		renderGlobe(180, studio)
		expect(glossaryNames()).toEqual(
			expect.arrayContaining(['Key light, behind', 'Rim light'])
		)
	})

	it('describes the slider by a glossary of exactly the marks drawn, hidden at rest', () => {
		const { globe } = renderGlobe(0, studio)
		const glossary = document.getElementById(
			globe.getAttribute('aria-describedby') ?? ''
		)
		expect(glossary).toHaveClass('sr-only')
		expect(glossaryNames()).toEqual([
			'Key light',
			'Fill light',
			'Rim light, behind',
			'Bright spot'
		])
		expect(glossary).toHaveTextContent(
			'Key light: Main light, casts the shadow'
		)
	})

	it('shows the glossary while the keyboard focuses the globe, not for a click', () => {
		const { globe } = renderGlobe(0)
		const glossary = () =>
			document.getElementById(globe.getAttribute('aria-describedby') ?? '')

		const matches = vi.spyOn(globe, 'matches').mockReturnValue(false)
		fireEvent.focus(globe)
		expect(glossary()).toHaveClass('sr-only')

		matches.mockReturnValue(true)
		fireEvent.focus(globe)
		expect(glossary()).not.toHaveClass('sr-only')

		fireEvent.blur(globe)
		expect(glossary()).toHaveClass('sr-only')

		// Clicked, then turned with the keyboard: its focus turns visible.
		matches.mockReturnValue(false)
		fireEvent.focus(globe)
		fireEvent.keyDown(globe, { key: 'ArrowRight' })
		expect(glossary()).not.toHaveClass('sr-only')
	})

	it('shows the glossary from the start of a touch drag, and names nothing under a finger', async () => {
		const { globe } = renderGlobe(0, studio)
		fireEvent.pointerEnter(markAt('key'), { pointerType: 'touch' })
		// The same wait a pointer's tooltip opens within.
		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

		fireEvent.pointerDown(globe, {
			clientX: 0,
			pointerId: 1,
			pointerType: 'touch'
		})
		expect(
			document.getElementById(globe.getAttribute('aria-describedby') ?? '')
		).not.toHaveClass('sr-only')
		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
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
