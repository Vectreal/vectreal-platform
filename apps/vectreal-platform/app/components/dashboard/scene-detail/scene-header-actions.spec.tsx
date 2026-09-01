// @vitest-environment jsdom
/**
 * The one call to action, and the fact that there is one.
 *
 * There were four controls stacked here. Publish & Embed and Open in Publisher
 * both folded into `ScenePublishPanel` - the second because the publish
 * drawer's own action navigated to the identical route, so the page offered two
 * paths to one place and neither sat beside the publication state. Delete
 * became a ghost at the foot of the same column.
 *
 * What is asserted here is that none of them came back. "One" is the rule this
 * component exists to hold.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SceneHeaderActions } from './scene-header-actions'

vi.mock('react-router', () => ({
	Link: ({
		to,
		children,
		...rest
	}: {
		to: string
		children: React.ReactNode
	} & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
		<a href={to} {...rest}>
			{children}
		</a>
	)
}))

function renderActions() {
	return render(<SceneHeaderActions previewPath="/preview/project-1/scene-1" />)
}

describe('the scene header actions', () => {
	it('offers exactly one, and it is a navigation', () => {
		renderActions()

		/*
		  The count, not just the presence. Anything added back here is the
		  regression this file is for, and an assertion that Preview exists would
		  survive it.
		*/
		expect(screen.getAllByRole('link')).toHaveLength(1)
		expect(screen.queryByRole('button')).toBeNull()
	})

	it('keeps Preview pointing where it says', () => {
		renderActions()

		expect(
			screen.getByRole('link', { name: /preview/i }).getAttribute('href')
		).toBe('/preview/project-1/scene-1')
	})

	it('does not offer a second route to the Publisher', () => {
		/*
		  It was here, beside Preview, while the publish drawer's own action
		  navigated to the identical route - two paths to one place, neither beside
		  the publication state. `ScenePublishPanel` owns that route now.
		*/
		renderActions()

		expect(screen.queryByText(/publisher/i)).toBeNull()
	})
})
