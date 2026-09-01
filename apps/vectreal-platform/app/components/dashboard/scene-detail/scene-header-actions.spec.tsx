// @vitest-environment jsdom
/**
 * The two calls to action, and the fact that there are two.
 *
 * There were four controls stacked here - these, plus Publish & Embed and an
 * overflow menu. The other two moved: Publish & Embed became a trigger card in
 * the facts panel, where it can say what state it leads to, and Delete became
 * `SceneOverflowMenu` in the panel's corner. What is asserted here is that they
 * did not come back, because "at most two" is the rule this component exists to
 * hold.
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
	return render(
		<SceneHeaderActions
			previewPath="/preview/project-1/scene-1"
			publisherPath="/publisher/scene-1"
		/>
	)
}

describe('the scene header actions', () => {
	it('offers exactly two, and both are navigations', () => {
		renderActions()

		/*
		  The count, not just the presence. A third control added here is the
		  regression this file is for, and every assertion below would survive it.
		*/
		expect(screen.getAllByRole('link')).toHaveLength(2)
		expect(screen.queryByRole('button')).toBeNull()
	})

	it('keeps the two links pointing where they say', () => {
		renderActions()

		expect(
			screen.getByRole('link', { name: /preview/i }).getAttribute('href')
		).toBe('/preview/project-1/scene-1')
		expect(
			screen
				.getByRole('link', { name: /open in publisher/i })
				.getAttribute('href')
		).toBe('/publisher/scene-1')
	})
})
