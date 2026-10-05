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

/** A choice made against one loader value, and void once the loader moves on. */
interface OptimisticChoice {
	value: boolean
	madeAgainst: ScenePresentationSettings | null
}

/**
 * The loading-thumbnail toggle, written straight to the scene rather than
 * through a publisher save.
 *
 * The loader is the only truth. A write revalidates the route (which the scene
 * route allows for its own URL, see `isSameUrlRevalidation`), and the choice is
 * shown until the loader hands back a new presentation rather than until the
 * request settles: the router commits revalidated data in a transition, after
 * an urgent state update, so clearing on settle would flash the old value. A
 * choice made against one loader value never outlives it, so it cannot follow
 * the page to another scene. A failed write drops it at once.
 *
 * A plain `fetch`, like the metadata editor on this page, rather than a
 * fetcher: a fetcher's network failure is thrown to an error boundary, which
 * would replace the page for one dropped request instead of rolling the
 * switch back.
 */
export function SceneLoadingThumbnailSetting({
	sceneId,
	presentation,
	canUpdate
}: SceneLoadingThumbnailSettingProps) {
	const csrf = useAuthenticityToken()
	const revalidator = useRevalidator()
	const [optimistic, setOptimistic] = useState<OptimisticChoice | null>(null)
	const [isWriting, setIsWriting] = useState(false)

	const checked =
		optimistic && optimistic.madeAgainst === presentation
			? optimistic.value
			: shouldShowLoadingThumbnail(presentation)

	const handleCheckedChange = async (showLoadingThumbnail: boolean) => {
		if (isWriting) return
		setIsWriting(true)
		setOptimistic({ value: showLoadingThumbnail, madeAgainst: presentation })

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
		} catch (error) {
			setOptimistic(null)
			setIsWriting(false)
			toast.error(
				error instanceof Error ? error.message : 'Could not update the scene.'
			)
			return
		}

		// Saved either way; a revalidation that fails leaves the choice showing,
		// which is what was stored, until the next navigation reads it back.
		await revalidator.revalidate().catch(() => undefined)
		setIsWriting(false)
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
