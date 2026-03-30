import { useAtom, useSetAtom } from 'jotai/react'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import {
	isBillingLimitError,
	toUpgradeModalPayload
} from '../lib/domain/billing/client/billing-limit-error'
import { processAtom } from '../lib/stores/publisher-config-store'
import {
	buildUpgradeModalState,
	upgradeModalAtom
} from '../lib/stores/upgrade-modal-store'

import type { SaveLocationTarget, SaveSceneResult } from './scene-loader.types'

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

	const handleSaveScene = useCallback(async () => {
		if (!userId) {
			await onRequireAuth?.()
			return
		}

		setProcessState((prev) => ({ ...prev, isSaving: true }))

		try {
			const result = (await saveSceneSettings(saveLocationTarget)) as
				| SaveSceneResult
				| { unchanged: true }
				| undefined

			if (result) {
				if (result.unchanged) {
					toast.info('No changes were detected - scene is already up to date')
				} else {
					toast.success('Scene settings saved successfully!')
					if (!sceneId && result.sceneId) {
						navigate(`/publisher/${result.sceneId}`, { replace: true })
					}
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
				toast.error(error.message)
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
			} else {
				toast.error(`Failed to save: ${errorMessage}`)
			}
		} finally {
			setProcessState((prev) => ({ ...prev, isSaving: false }))
		}
	}, [
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
