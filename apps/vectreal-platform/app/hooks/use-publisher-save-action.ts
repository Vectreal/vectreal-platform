import { useAtom, useSetAtom, useStore } from 'jotai/react'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import {
	isBillingLimitError,
	toUpgradeModalPayload
} from '../lib/domain/billing/client/billing-limit-error'
import {
	isPreviewModeAtom,
	processAtom,
	showPublishPanelAtom
} from '../lib/stores/publisher-config-store'
import {
	buildUpgradeModalState,
	upgradeModalAtom
} from '../lib/stores/upgrade-modal-store'

import type {
	SaveLocationTarget,
	SaveSceneResult
} from '../types/publisher-scene'

interface UsePublisherSaveActionParams {
	sceneId: null | string
	userId?: string
	saveLocationTarget?: SaveLocationTarget
	onRequireAuth?: () => Promise<void> | void
	saveSceneSettings: (
		target?: SaveLocationTarget
	) => Promise<SaveSceneResult | { unchanged: true } | undefined>
}

export const usePublisherSaveAction = ({
	sceneId,
	userId,
	saveLocationTarget,
	onRequireAuth,
	saveSceneSettings
}: UsePublisherSaveActionParams) => {
	const navigate = useNavigate()
	const [, setProcessState] = useAtom(processAtom)
	const setUpgradeModal = useSetAtom(upgradeModalAtom)
	const store = useStore()

	const handleSaveScene = useCallback(async () => {
		if (!userId) {
			await onRequireAuth?.()
			return
		}

		setProcessState((prev) => ({ ...prev, isSaving: true }))

		try {
			const result = (await saveSceneSettings(saveLocationTarget)) as
				SaveSceneResult | { unchanged: true } | undefined

			// The save panel reports how the save went, so success is not toasted.
			if (result) {
				if (!result.unchanged && !sceneId && result.sceneId) {
					navigate(`/publisher/${result.sceneId}`, { replace: true })
				}
			} else {
				toast.error('Failed to save scene settings')
			}
		} catch (error) {
			console.error('Error saving scene settings:', error)

			if (isBillingLimitError(error)) {
				const modalPayload = toUpgradeModalPayload(error)
				setUpgradeModal(
					buildUpgradeModalState({
						...modalPayload,
						actionAttempted: 'scene_save'
					})
				)
				return
			}

			const errorMessage =
				error instanceof Error
					? error.message
					: 'An error occurred while saving'

			if (errorMessage.includes('User not found in local database')) {
				toast.error(
					'Authentication error. Please sign out and sign back in to continue.',
					{
						duration: 6000,
						action: {
							label: 'Sign Out',
							onClick: () => {
								void fetch('/auth/logout', {
									method: 'POST'
								}).then(() => {
									window.location.href = '/'
								})
							}
						}
					}
				)
			} else if (errorMessage.includes('Missing required information')) {
				toast.error(
					'Missing required information. Please try refreshing the page.'
				)
			} else if (
				store.get(showPublishPanelAtom) ||
				store.get(isPreviewModeAtom)
			) {
				// The save panel cannot be seen: the publish panel slides over its
				// corner, and preview mode hides it. A failure it would hide must
				// not go unreported. Read when the save fails, since either can
				// change while the save runs.
				toast.error(`Save didn't complete: ${errorMessage}`)
			}
		} finally {
			setProcessState((prev) => ({ ...prev, isSaving: false }))
		}
	}, [
		store,
		navigate,
		onRequireAuth,
		saveLocationTarget,
		saveSceneSettings,
		sceneId,
		setProcessState,
		setUpgradeModal,
		userId
	])

	return {
		handleSaveScene
	}
}
