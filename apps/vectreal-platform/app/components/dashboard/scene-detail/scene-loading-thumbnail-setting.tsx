import { useEffect, useRef, useState } from 'react'
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

/** What the server stored, and the loader value it supersedes. */
interface ConfirmedPresentation {
	value: ScenePresentationSettings
	supersedes: ScenePresentationSettings | null
}

/**
 * The loading-thumbnail toggle, written straight to the scene rather than
 * through a publisher save.
 *
 * The action answers with the presentation it stored, and that answer is
 * what the switch shows afterwards: this route does not re-run its loader for
 * a plain revalidation (`shouldRevalidateForRouteParams`), so the loader's
 * value would otherwise stay the one from before the write. A loader value
 * that arrives later, from a navigation or another mutation, is newer and
 * wins. While a write is in flight the switch shows the value being written;
 * a failed write falls back to the last stored value.
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
	const [writing, setWriting] = useState<boolean | null>(null)
	const [confirmed, setConfirmed] = useState<ConfirmedPresentation | null>(null)

	// Read when a write lands, so the answer supersedes whichever loader value
	// is on screen by then, including one that arrived mid-write.
	const latestPresentation = useRef(presentation)
	useEffect(() => {
		latestPresentation.current = presentation
	}, [presentation])

	const stored =
		confirmed && confirmed.supersedes === presentation
			? confirmed.value
			: presentation
	const checked = writing ?? shouldShowLoadingThumbnail(stored)

	const handleCheckedChange = async (showLoadingThumbnail: boolean) => {
		if (writing !== null) return
		setWriting(showLoadingThumbnail)

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
			setConfirmed({
				value: payload.data.presentation,
				supersedes: latestPresentation.current
			})
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Could not update the scene.'
			)
		} finally {
			setWriting(null)
		}
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
