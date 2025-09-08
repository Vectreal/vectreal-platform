// import { useModelContext } from '@vctrl/hooks/use-load-model'
import { cn } from '@vctrl-ui/utils'

import { SaveIcon } from 'lucide-react'
import { useCallback, useState } from 'react'

import { toast } from 'sonner'

import { useAuth } from '../../../contexts/auth-context'
import { TooltipButton } from '../../tooltip-button'

import { useSceneSettings } from './use-scene-settings'

interface SaveButtonProps {
	sceneId: string | null
	userId?: string
	onSave?: (success: boolean) => void
}

function SaveButton({ sceneId, userId }: SaveButtonProps) {
	const [isSaving, setIsSaving] = useState(false)
	const [isSaved, setIsSaved] = useState(false)
	const { saveSceneSettings, hasUnsavedChanges } = useSceneSettings({
		sceneId,
		userId
	})

	const hasChanges = hasUnsavedChanges()
	const isDisabled = isSaving || !userId || !hasChanges

	const statusText = isSaved
		? 'Scene is saved'
		: isSaving
			? 'Saving scene...'
			: !hasChanges
				? 'No changes to save'
				: 'Click to save scene'

	const handleSave = useCallback(async () => {
		if (!userId) {
			toast.error(
				'Missing required information to save scene settings, got: \n' +
					JSON.stringify({ userId }, null, 2)
			)
			return
		}

		// Don't save if no changes
		if (!hasChanges) {
			toast.info('No changes to save')
			return
		}

		setIsSaving(true)
		setIsSaved(false)

		try {
			const result = await saveSceneSettings() // Asset IDs are now handled automatically by the API

			if (result) {
				// Check if settings were unchanged (no new version created)
				if (result.unchanged) {
					toast.info('No changes were detected - scene is already up to date')
					setIsSaved(true)
				} else {
					toast.success('Scene settings saved successfully!')
					setIsSaved(true)
				}

				// Reset saved state after a delay
				setTimeout(() => {
					setIsSaved(false)
				}, 3000)
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
			setIsSaving(false)
		}
	}, [saveSceneSettings, userId, hasChanges])

	return (
		<div className="fixed top-0 right-0 z-20 m-4 flex items-center gap-6">
			<div
				className={cn(
					'flex items-center gap-3 text-xs font-medium transition-all duration-300',
					isSaved || !hasChanges
						? 'text-green-300'
						: isSaving
							? 'text-orange-500'
							: 'text-yellow-500'
				)}
			>
				{isSaved || !hasChanges ? 'Saved' : isSaving ? 'Saving...' : 'Unsaved'}
				<div className="relative">
					<span
						className={cn(
							'inline-block h-2 w-2 rounded-full after:absolute after:top-0 after:left-0 after:h-full after:w-full after:animate-pulse after:opacity-50 after:blur-md',
							isSaved || !hasChanges
								? 'bg-green-400 after:bg-green-400'
								: isSaving
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
