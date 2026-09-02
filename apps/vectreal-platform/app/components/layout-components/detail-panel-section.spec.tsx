// @vitest-environment jsdom
/**
 * The rules the section primitive exists to hold.
 *
 * Every one of these was previously hand-written at each call site: four
 * raised panels in `scene.tsx` that each spelled the surface slightly
 * differently, plain sections that put the same rung on `h2`, `h3` and
 * `h4` by author's choice, and the publisher's own copy of the rung in
 * `SidebarSection`. No rule any of them could be checked against.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DetailPanelSection } from './detail-panel-section'

const sectionOf = (child: HTMLElement) => child.closest('section')

describe('DetailPanelSection', () => {
	it('puts the heading on the h4 rung, as an h3', () => {
		render(<DetailPanelSection title="Publishing">body</DetailPanelSection>)

		const heading = screen.getByRole('heading', { name: 'Publishing' })

		expect(heading.tagName).toBe('H3')
		expect(heading.className).toContain('text-h4')
	})

	it('draws the panel surface only when asked to', () => {
		const { rerender } = render(
			<DetailPanelSection title="Plain">body</DetailPanelSection>
		)
		const plain = sectionOf(screen.getByText('body'))!

		expect(plain.className).not.toContain('ds-raised')

		rerender(
			<DetailPanelSection surface="raised" title="Raised">
				body
			</DetailPanelSection>
		)
		const raised = sectionOf(screen.getByText('body'))!

		/*
		  `p-5`, not `p-4`. `rounded-2xl` is 28px, so a panel padded any tighter
		  crowds its content into the curve - the pairing `globals.css` records.
		*/
		expect(raised.className).toContain('ds-raised')
		expect(raised.className).toContain('rounded-2xl')
		expect(raised.className).toContain('p-5')
	})

	it('drops a level for a section nested inside another', () => {
		/*
		  The drawer's Embed block sits inside Publishing. Both are on the same
		  rung visually, but an outline where a sub-section is its parent's peer
		  is one a screen reader reads wrong. The rung does not move; only the
		  element does.
		*/
		render(
			<DetailPanelSection title="Embed" headingLevel="h4">
				body
			</DetailPanelSection>
		)

		const heading = screen.getByRole('heading', { name: 'Embed' })

		expect(heading.tagName).toBe('H4')
		expect(heading.className).toContain('text-h4')
	})

	it('renders a section with no heading at all', () => {
		/*
		  The publisher's scene card and the drawer's plain blocks both use this.
		  An empty header row would push the content down by the heading's height
		  and leave a gap nothing occupies.
		*/
		render(<DetailPanelSection>body</DetailPanelSection>)

		expect(screen.queryByRole('heading')).toBeNull()
	})

	it('draws the rule under the heading only when asked to', () => {
		/*
		  The publisher's sidebar sections are what depend on this: the rule under
		  the heading was one of the four things `SidebarSection` did by hand
		  before it delegated here, and it is invisible in every other assertion.
		*/
		const { container, rerender } = render(
			<DetailPanelSection title="Camera">body</DetailPanelSection>
		)

		expect(container.querySelector('[data-slot="separator"]')).toBeNull()

		rerender(
			<DetailPanelSection title="Camera" divider>
				body
			</DetailPanelSection>
		)

		expect(container.querySelector('[data-slot="separator"]')).not.toBeNull()
	})

	it('carries an eyebrow, a description and a trailing action', () => {
		render(
			<DetailPanelSection
				eyebrow="At a Glance"
				title="Scene Metrics"
				description="Four numbers"
				action={<button type="button">info</button>}
			>
				body
			</DetailPanelSection>
		)

		expect(screen.getByText('At a Glance')).not.toBeNull()
		expect(screen.getByText('Four numbers')).not.toBeNull()
		expect(screen.getByRole('button', { name: 'info' })).not.toBeNull()
	})

	it('lets a caller override the content rhythm rather than fight it', () => {
		/*
		  `cn()` merges the conflicting Tailwind class, so `space-y-6` replaces the
		  default instead of both landing and the later one winning by source
		  order - which is what a plain string concatenation would have done.
		*/
		render(
			<DetailPanelSection contentClassName="space-y-6">body</DetailPanelSection>
		)
		const content = screen.getByText('body')

		expect(content.className).toContain('space-y-6')
		expect(content.className).not.toContain('space-y-3')
	})
})
