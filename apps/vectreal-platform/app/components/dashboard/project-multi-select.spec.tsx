// @vitest-environment jsdom
/**
 * The API-key project picker identifies projects by id, the handle an embed
 * snippet and the agent API both use, now that projects carry no slug.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { ProjectMultiSelect } from './project-multi-select'

const PROJECTS = [
	{ id: '3f2a9c1e-0000-4000-8000-000000000001', name: 'Storefront' },
	{ id: '7b41d0aa-0000-4000-8000-000000000002', name: 'Lookbook' }
]

beforeAll(() => {
	// cmdk measures and scrolls its list, which jsdom does not implement.
	globalThis.ResizeObserver ??= class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver
	Element.prototype.scrollIntoView ??= vi.fn()
})

function openPicker() {
	render(
		<ProjectMultiSelect projects={PROJECTS} value={[]} onChange={() => {}} />
	)
	fireEvent.click(screen.getByRole('combobox'))
	return screen.getByRole('listbox')
}

describe('ProjectMultiSelect', () => {
	it('shows each project with its id beneath the name', () => {
		const list = openPicker()

		expect(within(list).getByText('Storefront')).not.toBeNull()
		expect(within(list).getByText(PROJECTS[0].id)).not.toBeNull()
	})

	it('finds a project by part of its id', () => {
		const list = openPicker()

		fireEvent.change(screen.getByPlaceholderText('Search projects...'), {
			target: { value: '7b41d0' }
		})

		expect(within(list).queryByText('Storefront')).toBeNull()
		expect(within(list).getByText('Lookbook')).not.toBeNull()
	})
})
