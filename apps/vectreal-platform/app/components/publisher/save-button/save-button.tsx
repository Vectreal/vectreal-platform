// import { useModelContext } from '@vctrl/hooks/use-load-model'
import { cn } from '@vctrl-ui/utils'
import { SaveIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { TooltipButton } from '../../tooltip-button'

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
}

const SaveButton = ({
	sceneId,
	userId,
	saveSceneSettings,
	hasUnsavedChanges
}: SaveButtonProps) => {
	const [isSaveLoading, setIsSaveLoading] = useState(false)
	const navigate = useNavigate()

	const isDisabled = isSaveLoading || !userId || !hasUnsavedChanges

	const statusText = isSaveLoading
		? 'Saving scene...'
		: !hasUnsavedChanges
			? 'No changes to save'
			: 'Click to save scene'

	const handleSave = useCallback(async () => {
		if (!userId) {
			toast.error('Missing required information to save scene setting')

			return
		}

		setIsSaveLoading(true)

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
			setIsSaveLoading(false)
		}
	}, [saveSceneSettings, userId, sceneId, navigate])

	return (
		<div className="fixed top-0 right-0 z-20 m-4 flex items-center gap-6">
			<div
				className={cn(
					'flex items-center gap-3 text-xs font-medium transition-all duration-300',
					!hasUnsavedChanges
						? 'text-green-300'
						: isSaveLoading
							? 'text-orange-500'
							: 'text-yellow-500'
				)}
			>
				{!hasUnsavedChanges ? 'Saved' : isSaveLoading ? 'Saving...' : 'Unsaved'}
				<div className="relative">
					<span
						className={cn(
							'inline-block h-2 w-2 rounded-full after:absolute after:top-0 after:left-0 after:h-full after:w-full after:animate-pulse after:opacity-50 after:blur-md',
							!hasUnsavedChanges
								? 'bg-green-400 after:bg-green-400'
								: isSaveLoading
									? 'animate-pulse bg-orange-400 after:bg-orange-400'
									: 'bg-yellow-400 after:bg-yellow-500'
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
