import { useState } from 'react'
import { useRevalidator } from 'react-router'
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

/**
 * The loading-thumbnail toggle, written straight to the scene rather than
 * through a publisher save.
 *
 * Optimistic until the write and the revalidation after it settle, then the
 * loader's value again: a successful write shows what the server stored, a
 * failed one falls back to it.
 *
 * A plain `fetch`, like the metadata editor on this page, rather than a
 * fetcher: a fetcher's network failure is thrown to an error boundary, which
 * would replace the page for one dropped request instead of rolling the
 * switch back.
 *
 * Unavailable when the stored value could not be read, because the switch
 * would otherwise show "off" for a scene stored "on".
 */
export function SceneLoadingThumbnailSetting({
	sceneId,
	presentation,
	canUpdate
}: SceneLoadingThumbnailSettingProps) {
	const csrf = useAuthenticityToken()
	const revalidator = useRevalidator()
	const [pending, setPending] = useState<boolean | null>(null)

	const checked = pending ?? shouldShowLoadingThumbnail(presentation)

	const handleCheckedChange = async (showLoadingThumbnail: boolean) => {
		if (pending !== null) return
		setPending(showLoadingThumbnail)

		try {
			const response = await fetch(`/api/scenes/${sceneId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update-scene-presentation',
					presentation: { showLoadingThumbnail },
					csrf
				})
			})
			const payload = await response.json().catch(() => null)
			if (!response.ok || !payload?.success) {
				throw new Error(payload?.error || 'Could not update the scene.')
			}
			await revalidator.revalidate()
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Could not update the scene.'
			)
		} finally {
			setPending(null)
		}
	}

	return (
		<LoadingThumbnailToggle
			checked={checked}
			onCheckedChange={handleCheckedChange}
			appliesOn="change"
			disabled={!canUpdate || presentation === null}
		/>
	)
}
