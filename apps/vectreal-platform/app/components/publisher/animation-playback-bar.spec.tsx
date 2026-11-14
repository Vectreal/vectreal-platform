// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import AnimationPlaybackBar from './animation-playback-bar'

const renderBar = (
	overrides: { visible?: boolean; playing?: boolean; note?: string } = {}
) => {
	const onToggle = vi.fn()
	const onRestart = vi.fn()
	render(
		<AnimationPlaybackBar
			visible={overrides.visible ?? true}
			playing={overrides.playing ?? false}
			complete={false}
			onToggle={onToggle}
			onRestart={onRestart}
			note={overrides.note}
		/>
	)
	return { onToggle, onRestart }
}

describe('AnimationPlaybackBar', () => {
	it('offers play while stopped', () => {
		renderBar({ playing: false })
		expect(screen.getByRole('button', { name: 'Play animation' })).toBeTruthy()
	})

	it('offers pause while playing', () => {
		renderBar({ playing: true })
		expect(screen.getByRole('button', { name: 'Pause animation' })).toBeTruthy()
	})

	it('hands both actions to the host', () => {
		const { onToggle, onRestart } = renderBar()

		fireEvent.click(screen.getByRole('button', { name: 'Play animation' }))
		fireEvent.click(screen.getByRole('button', { name: 'Restart animation' }))

		expect(onToggle).toHaveBeenCalledOnce()
		expect(onRestart).toHaveBeenCalledOnce()
	})

	it("draws the viewer's own controls, so editor and preview match", () => {
		renderBar()
		expect(
			screen
				.getByRole('group', { name: 'Animation playback' })
				.classList.contains('vctrl-viewer-animation-controls')
		).toBe(true)
	})

	it('says what the animation holds back, above the controls', () => {
		renderBar({ note: 'Held back' })
		expect(screen.getByRole('status').textContent).toBe('Held back')
	})

	// A hotspot clip poses the model with the scene's program, and its
	// controls, switched off.
	it('keeps its note while the controls are hidden', () => {
		renderBar({ visible: false, note: 'Held back' })
		expect(screen.getByRole('status').textContent).toBe('Held back')
		expect(
			screen.queryByRole('group', { name: 'Animation playback' })
		).toBeNull()
	})

	it('renders nothing while hidden', () => {
		renderBar({ visible: false })
		expect(
			screen.queryByRole('group', { name: 'Animation playback' })
		).toBeNull()
	})
})
