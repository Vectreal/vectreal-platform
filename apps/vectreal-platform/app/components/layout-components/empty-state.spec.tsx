// @vitest-environment jsdom
/**
 * The rules `EmptyState` holds for every empty region: which element the title
 * is, and which surface the well and its tile sit on.
 */

import { render, screen } from '@testing-library/react'
import { Bot } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { EmptyState } from './empty-state'

const tileOf = (root: Element) => root.firstElementChild as HTMLElement

describe('EmptyState', () => {
	it('is a page section with an h2 title by default, on a raised panel', () => {
		const { container } = render(
			<EmptyState icon={Bot} title="Connect your first agent" />
		)
		const root = container.firstElementChild as HTMLElement

		const heading = screen.getByRole('heading', {
			name: 'Connect your first agent'
		})
		expect(heading.tagName).toBe('H2')
		expect(heading.className).toContain('text-h4')
		expect(root.className).toContain('ds-raised')
		expect(tileOf(root).className).toContain('ds-raised')
	})

	it('is a line inside its host when inline: a paragraph title on a sunken well', () => {
		const { container } = render(
			<EmptyState size="inline" icon={Bot} title="No linked assets" />
		)
		const root = container.firstElementChild as HTMLElement

		expect(screen.queryByRole('heading')).toBeNull()
		expect(screen.getByText('No linked assets').tagName).toBe('P')
		expect(root.className).toContain('ds-sunken')
		expect(root.className).not.toContain('ds-raised')
	})

	it('takes the heading level the outline needs', () => {
		render(<EmptyState icon={Bot} title="Nested" headingLevel="h3" />)

		expect(screen.getByRole('heading', { name: 'Nested' }).tagName).toBe('H3')
	})

	it('uses the publisher shell recipe for well and tile, never the ladder', () => {
		const { container } = render(
			<EmptyState size="inline" surface="shell" icon={Bot} title="Markers" />
		)
		const root = container.firstElementChild as HTMLElement

		expect(root.className).toContain('shell-nested')
		expect(tileOf(root).className).toContain('shell-nested')
		expect(root.outerHTML).not.toContain('ds-')
	})

	it('renders the description and the action', () => {
		render(
			<EmptyState
				icon={Bot}
				title="Title"
				description="One sentence."
				action={<button type="button">Do it</button>}
			/>
		)

		expect(screen.getByText('One sentence.')).not.toBeNull()
		expect(screen.getByRole('button', { name: 'Do it' })).not.toBeNull()
	})
})
