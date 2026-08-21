// @vitest-environment jsdom
/**
 * The button's label against the button's state.
 *
 * The bug this covers: the label used to cross-fade through `AnimatePresence
 * mode="wait"`, which holds the outgoing label until an exit animation lands on
 * framer's rAF loop. A throttled loop left the button reading "Save" while it
 * was already disabled, so the label is asserted on the render that changed the
 * state, with no frame in between.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SaveButton from './save-button'

import type { SaveAvailabilityState } from '../../lib/domain/scene'

vi.mock('../../hooks/use-publisher-save-action', () => ({
	usePublisherSaveAction: () => ({ handleSaveScene: vi.fn() })
}))

const renderSaveButton = (saveAvailability: SaveAvailabilityState) => (
	<SaveButton
		sceneId="scene-1"
		userId="user-1"
		saveLocationTarget={{ targetProjectId: undefined, targetFolderId: null }}
		saveAvailability={saveAvailability}
		saveSceneSettings={vi.fn()}
	/>
)

describe('SaveButton', () => {
	it('swaps the label on the render that swaps the state', () => {
		const view = render(
			renderSaveButton({ canSave: false, reason: 'no-unsaved-changes' })
		)

		expect(screen.getByRole('button')).toHaveTextContent('Saved')
		expect(screen.getByRole('button')).toBeDisabled()

		view.rerender(renderSaveButton({ canSave: true, reason: 'ready' }))

		expect(screen.getByRole('button')).toHaveTextContent(/^Save$/)
		expect(screen.getByRole('button')).toBeEnabled()
	})
})
