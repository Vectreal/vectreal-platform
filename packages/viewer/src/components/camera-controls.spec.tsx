// @vitest-environment jsdom
/**
 * The camera switcher, read through its accessible names.
 *
 * The off-list cases are the ones that once failed: it lists scene cameras
 * only, and used to fall back to the first one, claiming the default was
 * active while a hotspot's camera held the view.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import CameraControls from './camera-controls'

const one = [{ cameraId: 'front', name: 'Front' }]
const three = [
	{ cameraId: 'front', name: 'Front' },
	{ cameraId: 'side', name: 'Side' },
	{ cameraId: 'top', name: 'Top' }
]
const five = [
	...three,
	{ cameraId: 'back', name: 'Back' },
	{ cameraId: 'detail', name: '' }
]

function renderControls(
	cameras: readonly { cameraId: string; name: string }[],
	activeCameraId: null | string,
	offListLabel?: null | string
) {
	const onSelect = vi.fn()
	render(
		<CameraControls
			cameras={cameras}
			activeCameraId={activeCameraId}
			offListLabel={offListLabel}
			onSelect={onSelect}
		/>
	)
	return { onSelect }
}

const next = () => screen.getByRole('button', { name: 'Next camera' })
const previous = () => screen.getByRole('button', { name: 'Previous camera' })

describe('CameraControls on its list', () => {
	it('names the camera and where it sits in the list', () => {
		renderControls(three, 'side')
		expect(screen.getByText('Side')).toBeTruthy()
		expect(screen.getByText('2/3')).toBeTruthy()
	})

	it('steps and wraps at either end', () => {
		const { onSelect } = renderControls(three, 'top')
		fireEvent.click(next())
		expect(onSelect).toHaveBeenLastCalledWith('front')
		fireEvent.click(previous())
		expect(onSelect).toHaveBeenLastCalledWith('side')
	})

	it('keeps the first camera as its guess before the viewer reports one', () => {
		renderControls(one, null)
		expect(screen.getByText('Front')).toBeTruthy()
		expect((next() as HTMLButtonElement).disabled).toBe(true)
	})

	it('offers no list at three cameras, where stepping is quicker', () => {
		renderControls(three, 'front')
		expect(
			screen.queryByRole('button', { name: /choose a camera/i })
		).toBeNull()
	})
})

describe('CameraControls off its own list', () => {
	it('names the hotspot view instead of claiming the first camera', () => {
		renderControls(three, 'hotspot-camera-1', 'Handle')
		expect(screen.getByText('Handle')).toBeTruthy()
		expect(screen.queryByText('Front')).toBeNull()
		// No "1/3": the view is not at any of the three.
		expect(screen.queryByText(/\d\/3/)).toBeNull()
	})

	it('steps back onto the list from either end', () => {
		const { onSelect } = renderControls(three, 'hotspot-camera-1', 'Handle')
		fireEvent.click(next())
		expect(onSelect).toHaveBeenLastCalledWith('front')
		fireEvent.click(previous())
		expect(onSelect).toHaveBeenLastCalledWith('top')
	})

	it('leads back even when the scene has a single camera', () => {
		const { onSelect } = renderControls(one, 'hotspot-camera-1', 'Handle')
		expect((next() as HTMLButtonElement).disabled).toBe(false)
		fireEvent.click(next())
		expect(onSelect).toHaveBeenCalledWith('front')
	})
})

describe('CameraControls past three cameras', () => {
	const trigger = () => screen.getByRole('button', { name: /choose a camera/i })

	it('opens a list on the current camera and selects from it', () => {
		const { onSelect } = renderControls(five, 'side')
		fireEvent.click(trigger())

		const options = screen.getAllByRole('option')
		expect(options).toHaveLength(5)
		expect(options[1].getAttribute('aria-selected')).toBe('true')
		expect(document.activeElement).toBe(options[1])
		// An unnamed camera still has a name to read.
		expect(options[4].textContent).toBe('Unnamed camera')

		fireEvent.click(options[3])
		expect(onSelect).toHaveBeenCalledWith('back')
		expect(screen.queryByRole('listbox')).toBeNull()
		expect(document.activeElement).toBe(trigger())
	})

	it('moves with the arrow keys and closes on Escape, back on the trigger', () => {
		renderControls(five, 'top')
		fireEvent.click(trigger())
		const listbox = screen.getByRole('listbox')
		const options = screen.getAllByRole('option')

		fireEvent.keyDown(listbox, { key: 'ArrowDown' })
		expect(document.activeElement).toBe(options[3])
		fireEvent.keyDown(listbox, { key: 'ArrowUp' })
		fireEvent.keyDown(listbox, { key: 'ArrowUp' })
		expect(document.activeElement).toBe(options[1])

		fireEvent.keyDown(listbox, { key: 'Escape' })
		expect(screen.queryByRole('listbox')).toBeNull()
		expect(document.activeElement).toBe(trigger())
	})

	it('closes when focus tabs out of it', () => {
		renderControls(five, 'front')
		fireEvent.click(trigger())
		fireEvent.blur(screen.getAllByRole('option')[0], {
			relatedTarget: screen.getByRole('button', { name: 'Next camera' })
		})
		expect(screen.queryByRole('listbox')).toBeNull()
	})

	it('keeps focus in the list when it is pressed, so a click always lands', () => {
		// Safari and macOS Firefox focus nothing on mousedown, and nothing takes
		// focus from the list's padding: the press must not move focus at all.
		const { onSelect } = renderControls(five, 'front')
		fireEvent.click(trigger())
		const options = screen.getAllByRole('option')
		expect(fireEvent.mouseDown(options[2])).toBe(false)
		expect(fireEvent.mouseDown(screen.getByRole('listbox'))).toBe(false)
		expect(fireEvent.mouseDown(trigger())).toBe(false)
		fireEvent.click(options[2])
		expect(onSelect).toHaveBeenCalledWith('top')
	})

	it('closes when focus leaves to nothing, as a click in an embed host does', () => {
		renderControls(five, 'front')
		fireEvent.click(trigger())
		fireEvent.blur(screen.getAllByRole('option')[0], { relatedTarget: null })
		expect(screen.queryByRole('listbox')).toBeNull()
	})

	it('closes from the trigger with Escape or a second click', () => {
		renderControls(five, 'front')
		fireEvent.click(trigger())
		// Claimed, so a host's own Escape (the preview page leaves on one)
		// does not act on the same press.
		expect(fireEvent.keyDown(trigger(), { key: 'Escape' })).toBe(false)
		expect(screen.queryByRole('listbox')).toBeNull()

		fireEvent.click(trigger())
		fireEvent.click(trigger())
		expect(screen.queryByRole('listbox')).toBeNull()
		expect(document.activeElement).toBe(trigger())
	})

	it('keeps focus where it is when the camera changes under an open list', () => {
		const onSelect = vi.fn()
		const { rerender } = render(
			<CameraControls
				cameras={five}
				activeCameraId="front"
				onSelect={onSelect}
			/>
		)
		fireEvent.click(trigger())
		const options = screen.getAllByRole('option')
		fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' })
		expect(document.activeElement).toBe(options[1])

		rerender(
			<CameraControls
				cameras={five}
				activeCameraId="back"
				onSelect={onSelect}
			/>
		)
		expect(document.activeElement).toBe(screen.getAllByRole('option')[1])
	})

	it('enters the list from the trigger at the end each arrow points to', () => {
		renderControls(five, 'side')
		fireEvent.click(trigger())
		trigger().focus()
		fireEvent.keyDown(trigger(), { key: 'ArrowUp' })
		expect(document.activeElement).toBe(screen.getAllByRole('option')[4])
		trigger().focus()
		fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
		expect(document.activeElement).toBe(screen.getAllByRole('option')[0])
	})

	it('closes on a press outside it', () => {
		renderControls(five, 'front')
		fireEvent.click(trigger())
		fireEvent.pointerDown(document.body)
		expect(screen.queryByRole('listbox')).toBeNull()
	})

	it('marks no option while the view is off the list', () => {
		renderControls(five, 'hotspot-camera-1', 'Handle')
		fireEvent.click(trigger())
		expect(
			screen
				.getAllByRole('option')
				.some((option) => option.getAttribute('aria-selected') === 'true')
		).toBe(false)
	})
})
