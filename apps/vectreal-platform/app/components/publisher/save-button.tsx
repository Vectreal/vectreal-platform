import { Button } from '@shared/components/ui/button'
import { useAtomValue } from 'jotai/react'
import { CircleFadingArrowUp, Cloud, Sparkles } from 'lucide-react'

import {
	SaveAvailabilityState,
	SaveLocationTarget,
	SaveSceneResult
} from '../../hooks'
import { usePublisherSaveAction } from '../../hooks/use-publisher-save-action'
import { isSavingAtom } from '../../lib/stores/publisher-config-store'

interface SaveButtonProps {
	sceneId: null | string
	userId?: string
	saveLocationTarget: SaveLocationTarget
	saveAvailability: SaveAvailabilityState
	onRequireAuth?: () => Promise<void> | void
	saveSceneSettings: (
		target?: SaveLocationTarget
	) => Promise<SaveSceneResult | { unchanged: true } | undefined>
}

const SaveButton = ({
	sceneId,
	userId,
	saveLocationTarget,
	saveAvailability,
	onRequireAuth,
	saveSceneSettings
}: SaveButtonProps) => {
	const isSaving = useAtomValue(isSavingAtom)
	const { handleSaveScene } = usePublisherSaveAction({
		sceneId,
		userId,
		saveLocationTarget,
		onRequireAuth,
		saveSceneSettings
	})

	const isSaveDisabled = userId
		? isSaving || !saveAvailability.canSave
		: isSaving

	const saveActionLabel = isSaving
		? 'Saving...'
		: !userId
			? 'Sign In to Save'
			: saveAvailability.reason === 'requires-first-optimization'
				? 'Optimize First'
				: saveAvailability.reason === 'no-unsaved-changes'
					? 'Saved'
					: 'Save'

	return (
		<Button
			variant="ghost"
			className="flex items-center gap-2 rounded-xl"
			disabled={isSaveDisabled}
			onClick={handleSaveScene}
		>
			{saveActionLabel}
			{saveAvailability.reason === 'requires-first-optimization' ? (
				<Sparkles size={16} className="inline animate-pulse" />
			) : saveAvailability.reason === 'no-unsaved-changes' ? (
				<Cloud size={16} className="inline" />
			) : (
				<CircleFadingArrowUp size={16} className="inline" />
			)}
		</Button>
	)
}

export default SaveButton
