// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LoadingThumbnailToggle } from './loading-thumbnail-toggle'

const toggle = () =>
	screen.getByRole('switch', { name: /show thumbnail while loading/i })

describe('the loading thumbnail toggle', () => {
	it('reports the choice it is handed', () => {
		render(
			<LoadingThumbnailToggle
				checked
				onCheckedChange={vi.fn()}
				appliesOn="save"
			/>
		)

		expect(toggle().getAttribute('aria-checked')).toBe('true')
	})

	it('hands a change to its owner', () => {
		const onCheckedChange = vi.fn()
		render(
			<LoadingThumbnailToggle
				checked={false}
				onCheckedChange={onCheckedChange}
				appliesOn="change"
			/>
		)

		fireEvent.click(toggle())

		expect(onCheckedChange).toHaveBeenCalledWith(true)
	})

	it('cannot be changed, and says why, when unavailable', () => {
		const onCheckedChange = vi.fn()
		render(
			<LoadingThumbnailToggle
				checked={false}
				onCheckedChange={onCheckedChange}
				appliesOn="change"
				unavailableReason="Not yours to change."
			/>
		)

		fireEvent.click(toggle())

		expect(toggle()).toHaveProperty('disabled', true)
		expect(onCheckedChange).not.toHaveBeenCalled()
		expect(document.body.textContent).toContain('Not yours to change.')
		expect(document.body.textContent).not.toContain('Applies right away.')
	})

	it('says when the change reaches visitors', () => {
		const { rerender } = render(
			<LoadingThumbnailToggle
				checked={false}
				onCheckedChange={vi.fn()}
				appliesOn="save"
			/>
		)
		expect(document.body.textContent).toContain('Applies as soon as you save.')

		rerender(
			<LoadingThumbnailToggle
				checked={false}
				onCheckedChange={vi.fn()}
				appliesOn="change"
			/>
		)
		expect(document.body.textContent).toContain('Applies right away.')
	})
})
