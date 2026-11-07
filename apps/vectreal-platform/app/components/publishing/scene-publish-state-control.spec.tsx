// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { ScenePublishStateControl } from './scene-publish-state-control'

import type { ScenePublishStateResponse } from '../../types/api'

const published: ScenePublishStateResponse = {
	sceneId: 'scene-1',
	status: 'published',
	publishedAt: '2026-11-01T10:00:00.000Z',
	publishedAssetId: 'asset-1',
	publishedAssetSizeBytes: 1024
}

function renderControl(onPublish: () => void) {
	const router = createMemoryRouter([
		{
			path: '/',
			element: (
				<ScenePublishStateControl
					publishState={published}
					onPublish={onPublish}
				/>
			)
		}
	])
	render(<RouterProvider router={router} />)
}

describe('a published scene', () => {
	it('can be republished in place, after the same confirmation as a first publish', async () => {
		const onPublish = vi.fn()
		renderControl(onPublish)

		fireEvent.click(screen.getByRole('button', { name: 'Republish Scene' }))
		fireEvent.click(
			await screen.findByRole('button', { name: 'Confirm publish' })
		)

		await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1))
	})

	it('can still be revoked', async () => {
		renderControl(vi.fn())

		fireEvent.click(screen.getByRole('button', { name: 'Revoke publication' }))

		expect(
			await screen.findByRole('alertdialog', { name: 'Revoke publication?' })
		).toBeTruthy()
	})
})
