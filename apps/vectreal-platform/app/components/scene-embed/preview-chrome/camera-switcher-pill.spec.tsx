// @vitest-environment jsdom
/**
 * The camera pill while a hotspot's camera holds the view. It lists scene
 * cameras only, and used to fall back to the first one, claiming the default
 * was active while the view stood somewhere else entirely.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import CameraSwitcherPill from './camera-switcher-pill'

const one = [{ cameraId: 'front', name: 'Front' }]
const three = [
	{ cameraId: 'front', name: 'Front' },
	{ cameraId: 'side', name: 'Side' },
	{ cameraId: 'top', name: 'Top' }
]

function renderPill(
	cameras: typeof three,
	activeCameraId: null | string,
	offListLabel?: null | string
) {
	const onSelect = vi.fn()
	render(
		<CameraSwitcherPill
			cameras={cameras}
			activeCameraId={activeCameraId}
			offListLabel={offListLabel}
			onSelect={onSelect}
		/>
	)
	return { onSelect }
}

describe('CameraSwitcherPill off its own list', () => {
	it('names the hotspot view instead of claiming the first camera', () => {
		renderPill(three, 'hotspot-camera-1', 'Handle')
		expect(screen.getByText('Handle')).toBeTruthy()
		expect(screen.queryByText('Front')).toBeNull()
		// No "1/3": the view is not at any of the three.
		expect(screen.queryByText(/\d\/3/)).toBeNull()
	})

	it('steps back onto the list from either end', () => {
		const { onSelect } = renderPill(three, 'hotspot-camera-1', 'Handle')
		fireEvent.click(screen.getByRole('button', { name: 'Next camera' }))
		expect(onSelect).toHaveBeenLastCalledWith('front')
		fireEvent.click(screen.getByRole('button', { name: 'Previous camera' }))
		expect(onSelect).toHaveBeenLastCalledWith('top')
	})

	it('leads back even when the scene has a single camera', () => {
		const { onSelect } = renderPill(one, 'hotspot-camera-1', 'Handle')
		const next = screen.getByRole('button', { name: 'Next camera' })
		expect((next as HTMLButtonElement).disabled).toBe(false)
		fireEvent.click(next)
		expect(onSelect).toHaveBeenCalledWith('front')
	})

	it('keeps the first camera as its guess before the viewer reports one', () => {
		renderPill(one, null, null)
		expect(screen.getByText('Front')).toBeTruthy()
		expect(
			(
				screen.getByRole('button', {
					name: 'Next camera'
				}) as HTMLButtonElement
			).disabled
		).toBe(true)
	})

	it('cycles normally on a listed camera', () => {
		const { onSelect } = renderPill(three, 'side', 'Handle')
		expect(screen.getByText('Side')).toBeTruthy()
		expect(screen.getByText('2/3')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Next camera' }))
		expect(onSelect).toHaveBeenCalledWith('top')
	})
})
