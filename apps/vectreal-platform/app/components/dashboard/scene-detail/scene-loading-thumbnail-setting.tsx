import { useEffect } from 'react'
import { useFetcher } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { toast } from 'sonner'

import { shouldShowLoadingThumbnail } from '../../../lib/domain/scene/scene-presentation'
import { LoadingThumbnailToggle } from '../../publishing/loading-thumbnail-toggle'

import type { ScenePresentationSettings } from '@vctrl/core'

interface SceneLoadingThumbnailSettingProps {
	sceneId: string
	/** The stored presentation, from the loader; null when it could not be read. */
	presentation: ScenePresentationSettings | null
	canUpdate: boolean
}

interface PresentationUpdateResult {
	success?: boolean
	error?: string
}

interface PresentationUpdateRequest {
	presentation: { showLoadingThumbnail: boolean }
}

/**
 * The loading-thumbnail toggle, written straight to the scene rather than
 * through a publisher save.
 *
 * A fetcher, because its POST is what makes the scene route re-run its loader
 * (`shouldRevalidateForRouteParams` answers yes to a non-GET form method and
 * no to a plain revalidation), and the router hands the fetcher back idle in
 * the same update that commits the revalidated loader data. So the switch
 * shows the value being written through the request and the revalidation,
 * then reads the loader again with no frame of the old value in between; a
 * refused write falls back to what is stored.
 *
 * Keyed by scene, so a write still in flight on one scene is never shown on
 * the next one the page navigates to.
 */
export function SceneLoadingThumbnailSetting({
	sceneId,
	presentation,
	canUpdate
}: SceneLoadingThumbnailSettingProps) {
	const fetcher = useFetcher<PresentationUpdateResult>({
		key: `scene-presentation:${sceneId}`
	})
	const csrf = useAuthenticityToken()

	const writing =
		fetcher.state === 'idle'
			? undefined
			: (fetcher.json as PresentationUpdateRequest | undefined)
	const checked =
		writing?.presentation.showLoadingThumbnail ??
		shouldShowLoadingThumbnail(presentation)

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data?.success === false) {
			toast.error(fetcher.data.error ?? 'Could not update the scene.')
		}
	}, [fetcher.state, fetcher.data])

	const handleCheckedChange = (showLoadingThumbnail: boolean) => {
		if (writing) return
		fetcher.submit(
			{
				action: 'update-scene-presentation',
				presentation: { showLoadingThumbnail },
				csrf
			},
			{
				method: 'POST',
				encType: 'application/json',
				action: `/api/scenes/${sceneId}`
			}
		)
	}

	return (
		<LoadingThumbnailToggle
			checked={checked}
			onCheckedChange={handleCheckedChange}
			appliesOn="change"
			unavailableReason={
				presentation === null
					? "This setting couldn't be loaded. Reload the page to try again."
					: !canUpdate
						? "You can't change this setting for this scene."
						: undefined
			}
		/>
	)
}
