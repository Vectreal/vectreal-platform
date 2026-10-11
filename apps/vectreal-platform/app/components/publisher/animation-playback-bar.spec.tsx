// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import AnimationPlaybackBar from './animation-playback-bar'

const renderBar = (
	overrides: { visible?: boolean; playing?: boolean } = {}
) => {
	const onToggle = vi.fn()
	const onRestart = vi.fn()
	render(
		<AnimationPlaybackBar
			visible={overrides.visible ?? true}
			playing={overrides.playing ?? false}
			onToggle={onToggle}
			onRestart={onRestart}
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

	it('renders nothing while hidden', () => {
		renderBar({ visible: false })
		expect(
			screen.queryByRole('group', { name: 'Animation playback' })
		).toBeNull()
	})
})
