// import { useModelContext } from '@vctrl/hooks/use-load-model'
import { cn } from '@shared/utils'
import { useAtom, useAtomValue } from 'jotai'
import { SaveIcon } from 'lucide-react'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { processAtom } from '../../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../../lib/stores/scene-optimization-store'
import { TooltipButton } from '../../tooltip-button'

import type { SaveAvailabilityState } from '../../../hooks/use-scene-loader'

interface SaveSceneResult {
	sceneId?: string
	unchanged?: boolean
	[key: string]: unknown
}

interface SaveButtonProps {
	sceneId: string | null
	userId?: string
	assetIds?: string[]
	onSave?: (success: boolean) => void
	saveSceneSettings: () => Promise<
		SaveSceneResult | { unchanged: true } | undefined
	>
	hasUnsavedChanges: boolean
	saveAvailability: SaveAvailabilityState
}

const SaveButton = ({
	sceneId,
	userId,
	saveSceneSettings,
	hasUnsavedChanges,
	saveAvailability
}: SaveButtonProps) => {
	const [{ isSaving }, setProcessState] = useAtom(processAtom)
	const { isPending: isOptimizationPending } = useAtomValue(
		optimizationRuntimeAtom
	)
	const navigate = useNavigate()

	const isDisabled =
		isSaving || isOptimizationPending || !saveAvailability.canSave

	const statusText = isSaving
		? 'Saving scene...'
		: saveAvailability.reason === 'requires-first-optimization'
			? 'Apply at least one optimization to enable saving.'
			: saveAvailability.reason === 'no-user'
				? 'Sign in to save scene settings'
				: saveAvailability.reason === 'no-unsaved-changes'
					? 'No changes to save'
					: 'Click to save scene'

	const displayStateText = isSaving
		? 'Saving...'
		: saveAvailability.reason === 'requires-first-optimization'
			? 'Not optimized yet'
			: !hasUnsavedChanges
				? 'Saved'
				: 'Unsaved'

	const statusToneClass = isSaving
		? 'text-orange-500'
		: saveAvailability.reason === 'requires-first-optimization'
			? 'text-yellow-500'
			: !hasUnsavedChanges
				? 'text-green-300'
				: 'text-yellow-500'

	const statusDotClass = isSaving
		? 'animate-pulse bg-orange-400 after:bg-orange-400'
		: saveAvailability.reason === 'requires-first-optimization'
			? 'bg-yellow-400 after:bg-yellow-500'
			: !hasUnsavedChanges
				? 'bg-green-400 after:bg-green-400'
				: 'bg-yellow-400 after:bg-yellow-500'

	const handleSave = useCallback(async () => {
		if (!userId) {
			toast.error('Missing required information to save scene setting')

			return
		}

		setProcessState((prev) => ({ ...prev, isSaving: true }))

		try {
			const result = await saveSceneSettings() // Asset IDs are now handled automatically by the API

			if (result) {
				// Check if settings were unchanged (no new version created)
				if (result.unchanged) {
					toast.info('No changes were detected - scene is already up to date')
				} else {
					toast.success('Scene settings saved successfully!')

					// If this was a new scene (no sceneId before), update the URL
					if (!sceneId && result.sceneId) {
						// Update URL without reloading the page - use route parameter
						navigate(`/publisher/${result.sceneId}`, { replace: true })
					}
				}
			} else {
				toast.error('Failed to save scene settings')
			}
		} catch (error) {
			console.error('Error saving scene settings:', error)

			// Handle specific error messages
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
								// Redirect to sign out
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
	}, [saveSceneSettings, userId, sceneId, navigate])

	return (
		<div className="fixed top-0 right-0 z-20 m-4 flex items-center gap-2">
			<div
				className={cn(
					'bg-muted flex items-center gap-3 rounded-xl p-2 px-4 text-xs font-medium transition-all duration-300',
					statusToneClass
				)}
			>
				{displayStateText}
				<div className="relative">
					<span
						className={cn(
							'inline-block h-2 w-2 rounded-full after:absolute after:top-0 after:left-0 after:h-full after:w-full after:animate-pulse after:opacity-50 after:blur-md',
							statusDotClass
						)}
						aria-hidden="true"
					/>
				</div>
			</div>
			<TooltipButton
				disabled={isDisabled}
				onClick={handleSave}
				info={statusText}
			>
				<SaveIcon
					className={cn(
						'h-4 w-4',
						isDisabled ? 'text-muted-foreground/50' : 'text-muted-foreground'
					)}
				/>
			</TooltipButton>
		</div>
	)
}

export default SaveButton
