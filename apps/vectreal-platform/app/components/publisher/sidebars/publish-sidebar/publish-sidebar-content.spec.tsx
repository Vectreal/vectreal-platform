// @vitest-environment jsdom
/**
 * The publish panel's way to save, signed out.
 *
 * The panel is on screen while a dropped file still parses, and signed out its
 * Save is a sign-in button. Pressed with nothing loaded, it tried to keep an
 * empty scene as a draft and failed with a toast. It reads the same rule as the
 * header's Save, so the two agree about a stage with no model on it.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import PublishSidebarContent from './publish-sidebar-content'
import { PublishSidebarProvider } from './publish-sidebar-context'
import { buildPublishSidebarViewModel } from './publish-sidebar-view-model'

import type { SaveAvailabilityState } from '../../../../lib/domain/scene'

const { probe } = vi.hoisted(() => ({
	probe: (name: string) => () => <div data-testid={name} />
}))

vi.mock('../../../../hooks/use-publisher-save-action', () => ({
	usePublisherSaveAction: () => ({ handleSaveScene: vi.fn() })
}))
vi.mock('./sections/delivery-summary', () => ({
	DeliverySummary: probe('delivery')
}))
vi.mock('./sections/embed-options', () => ({ EmbedOptions: probe('embed') }))
vi.mock('./sections/optimization-options', () => ({
	OptimizationOptions: probe('optimization')
}))
vi.mock('./sections/publish-options', () => ({
	PublishOptions: probe('publish')
}))
vi.mock('./sections/save-options', () => ({ SaveOptions: probe('download') }))
vi.mock('./sections/scene-preview', () => ({ ScenePreview: probe('preview') }))

function renderSignedOut(saveAvailability: SaveAvailabilityState) {
	render(
		<PublishSidebarProvider
			value={{
				saveSceneSettings: vi.fn(),
				saveAvailability,
				viewModel: buildPublishSidebarViewModel({})
			}}
		>
			<PublishSidebarContent />
		</PublishSidebarProvider>
	)
	return screen.getByRole('button', { name: 'Sign In or Sign Up to Save' })
}

describe('the publish panel, signed out', () => {
	it('offers no sign-in to save while nothing is on the stage', () => {
		expect(
			renderSignedOut({ canSave: false, reason: 'no-model' })
		).toBeDisabled()
	})

	it('offers it once there is a model to keep', () => {
		expect(renderSignedOut({ canSave: false, reason: 'no-user' })).toBeEnabled()
	})
})
