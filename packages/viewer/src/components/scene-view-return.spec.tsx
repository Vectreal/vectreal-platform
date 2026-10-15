// @vitest-environment jsdom
/**
 * The control a visitor leaves a hotspot's camera with, rendered for real:
 * whether it is there, what it is called, what it says to a screen reader,
 * and where focus goes when it removes itself.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SceneViewReturn from './scene-view-return'

function renderControl(hotspotName: null | string, focusOnLeave = null) {
	const onReturn = vi.fn()
	const view = render(
		<SceneViewReturn
			hotspotName={hotspotName}
			onReturn={onReturn}
			focusOnLeave={focusOnLeave}
		/>
	)
	return { ...view, onReturn }
}

describe('SceneViewReturn', () => {
	it('draws no button away from a hotspot', () => {
		renderControl(null)
		expect(screen.queryByRole('button')).toBeNull()
	})

	it('draws a named button at a hotspot, which returns', () => {
		const { onReturn } = renderControl('Handle')
		fireEvent.click(screen.getByRole('button', { name: 'Back to scene view' }))
		expect(onReturn).toHaveBeenCalledOnce()
	})

	it('announces arriving at a hotspot and leaving it', () => {
		const { rerender, onReturn } = renderControl(null)
		const status = screen.getByRole('status')
		expect(status.textContent).toBe('')

		const props = { onReturn, focusOnLeave: null }
		rerender(<SceneViewReturn hotspotName="Handle" {...props} />)
		expect(status.textContent).toBe('Viewing Handle')

		rerender(<SceneViewReturn hotspotName={null} {...props} />)
		expect(status.textContent).toBe('Back to scene view')
	})

	it('hands focus to the viewer when it leaves while holding it', () => {
		const container = document.createElement('div')
		container.tabIndex = -1
		document.body.append(container)

		const props = { onReturn: vi.fn(), focusOnLeave: container }
		const { rerender } = render(
			<SceneViewReturn hotspotName="Handle" {...props} />
		)
		act(() => screen.getByRole('button').focus())

		rerender(<SceneViewReturn hotspotName={null} {...props} />)
		expect(document.activeElement).toBe(container)
		container.remove()
	})

	it('leaves focus alone when it was somewhere else', () => {
		const container = document.createElement('div')
		container.tabIndex = -1
		const elsewhere = document.createElement('button')
		document.body.append(container, elsewhere)
		elsewhere.focus()

		const props = { onReturn: vi.fn(), focusOnLeave: container }
		const { rerender } = render(
			<SceneViewReturn hotspotName="Handle" {...props} />
		)
		rerender(<SceneViewReturn hotspotName={null} {...props} />)
		expect(document.activeElement).toBe(elsewhere)
		container.remove()
		elsewhere.remove()
	})
})
