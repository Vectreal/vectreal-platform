import { useEffect } from 'react'
import { useFetcher } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { toast } from 'sonner'

import { shouldShowLoadingThumbnail } from '../../../lib/domain/scene/scene-presentation'
import { LoadingThumbnailToggle } from '../../publishing/loading-thumbnail-toggle'

import type { ScenePresentationSettings } from '@vctrl/core'

interface SceneLoadingThumbnailSettingProps {
	sceneId: string
	/** The stored presentation, from the loader. */
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
 * Optimistic while the request and the revalidation after it are in flight;
 * once the fetcher settles it reads the loader again, so a failed write falls
 * back to what is stored, and a successful one shows what the server stored.
 */
export function SceneLoadingThumbnailSetting({
	sceneId,
	presentation,
	canUpdate
}: SceneLoadingThumbnailSettingProps) {
	const fetcher = useFetcher<PresentationUpdateResult>()
	const csrf = useAuthenticityToken()

	const pending =
		fetcher.state === 'idle'
			? undefined
			: (fetcher.json as PresentationUpdateRequest | undefined)
	const checked =
		pending?.presentation.showLoadingThumbnail ??
		shouldShowLoadingThumbnail(presentation)

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data?.success === false) {
			toast.error(fetcher.data.error ?? 'Could not update the scene.')
		}
	}, [fetcher.state, fetcher.data])

	const handleCheckedChange = (showLoadingThumbnail: boolean) => {
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
			disabled={!canUpdate}
		/>
	)
}
