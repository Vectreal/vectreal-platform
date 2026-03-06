import { useAtom } from 'jotai/react'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { processAtom } from '../lib/stores/publisher-config-store'

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
								window.location.href = '/auth/signout'
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
		userId
	])

	return {
		handleSaveScene
	}
}
