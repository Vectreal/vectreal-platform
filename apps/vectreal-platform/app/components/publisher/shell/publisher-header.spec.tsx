// @vitest-environment jsdom
/**
 * The publisher header before and after there is a scene.
 *
 * The header is up from the first paint now, over an empty stage too. The
 * scene's name, its save location and Save have nothing to act on until a
 * model is in, so they arrive with it; the way home is there from the start,
 * because the publisher carries no site nav.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { PublisherHeader } from './publisher-header'

import type { User } from '@supabase/supabase-js'

vi.mock('../scene-name-and-location', () => ({
	SceneNameAndLocation: () => <div data-testid="scene-name" />
}))
vi.mock('../save-button', () => ({
	default: () => <button type="button">Save</button>
}))
vi.mock('../../user-menu', () => ({
	UserMenu: () => <div data-testid="user-menu" />
}))

function renderHeader(
	showSceneControls: boolean,
	user: null | User = null,
	path = '/publisher'
) {
	render(
		<MemoryRouter initialEntries={[path]}>
			<PublisherHeader
				user={user}
				sceneId={null}
				saveLocationTarget={{
					targetProjectId: undefined,
					targetFolderId: null
				}}
				saveAvailability={{ canSave: false, reason: 'no-model' }}
				saveSceneSettings={vi.fn()}
				onRequireAuth={vi.fn()}
				onLogout={vi.fn()}
				isPreviewMode={false}
				actionsDisabled={false}
				showSceneControls={showSceneControls}
			/>
		</MemoryRouter>
	)
}

describe('PublisherHeader', () => {
	it('keeps the scene controls off an empty stage, and the way home on it', () => {
		renderHeader(false)

		expect(
			screen.getByRole('link', { name: 'Vectreal home' }).getAttribute('href')
		).toBe('/')
		expect(screen.queryByTestId('scene-name')).toBeNull()
		expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
	})

	/*
	  Signed in, the way out is the dashboard, as the dashboard's own logo is:
	  someone with an account expects to land on their work, not the landing
	  page. The label names the destination, since the mark goes two places.
	*/
	it('leads a signed-in visitor to the dashboard', () => {
		renderHeader(true, { id: 'user-1' } as User)

		expect(
			screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href')
		).toBe('/dashboard')
		expect(screen.queryByRole('link', { name: 'Vectreal home' })).toBeNull()
	})

	/*
	  The full wordmark while the stage is empty; once a scene's controls take
	  the row its letters fade off the mark beneath them. The destination does
	  not change with it.
	*/
	it('fades the wordmark to the mark once a scene is open, still leading to the dashboard', () => {
		// The mark is the link's first svg, the wordmark over it the second.
		const wordmarkHidden = () =>
			screen
				.getByRole('link', { name: 'Dashboard' })
				.querySelectorAll('svg')[1]
				?.parentElement?.classList.contains('opacity-0')

		renderHeader(false, { id: 'user-1' } as User)
		expect(wordmarkHidden()).toBe(false)
		cleanup()

		renderHeader(true, { id: 'user-1' } as User)
		expect(wordmarkHidden()).toBe(true)
		expect(
			screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href')
		).toBe('/dashboard')
	})

	/*
	  The site nav carried the only Sign In, and the publisher no longer shows
	  it. Once a model is in, "Sign In to Save" is the way in, and it keeps the
	  scene as a draft, so a second link would only compete with it.
	*/
	it('offers sign-in over an empty stage', () => {
		renderHeader(false)
		expect(
			screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')
		).toBe('/sign-in?next=%2Fpublisher')
	})

	/*
	  Signed out on a scene route, the scene is not loaded and the stage is
	  empty, so this link shows there too, and has to come back to that scene.
	*/
	it('brings sign-in back to the scene route it started on', () => {
		renderHeader(false, null, '/publisher/scene-1')
		expect(
			screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')
		).toBe('/sign-in?next=%2Fpublisher%2Fscene-1')
	})

	it('leaves sign-in to Save once there is a scene', () => {
		renderHeader(true)
		expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
	})

	it('shows the account, not sign-in, to someone signed in', () => {
		renderHeader(false, { id: 'user-1' } as User)
		expect(screen.getByTestId('user-menu')).toBeTruthy()
		expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
	})

	it('brings the scene name and Save with the scene', () => {
		renderHeader(true)

		expect(screen.getByRole('link', { name: 'Vectreal home' })).toBeTruthy()
		expect(screen.getByTestId('scene-name')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
	})
})
