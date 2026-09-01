import { useEffect, useRef, useState } from 'react'
import { useAuthenticityToken } from 'remix-utils/csrf/react'

/** How long a save result stays on screen before the indicator resets. */
const STATUS_RESET_MS = 2200

type SceneMetadataStatus = 'idle' | 'saved' | 'error'

interface SceneLike {
	id: string
	name: string
	description: string | null
}

/**
 * The scene title and description, as the detail page edits them.
 *
 * Six pieces of state, a timer ref and two effects, all of which lived at the
 * top of the route module alongside the viewer wiring and the delete flow. They
 * are one concern - an optimistic inline editor over
 * `POST /api/scenes/:id` - and nothing else on the page reads them.
 *
 * `scene` is the loader's copy and is authoritative: a revalidation resets both
 * drafts, which is what makes a rename in another tab win over an untouched
 * field here.
 */
export function useSceneMetadata<TScene extends SceneLike>(scene: TScene) {
	const csrfToken = useAuthenticityToken()

	const [sceneState, setSceneState] = useState(scene)
	const [nameDraft, setNameDraft] = useState(scene.name)
	const [descriptionDraft, setDescriptionDraft] = useState(
		scene.description || ''
	)
	const [isSaving, setIsSaving] = useState(false)
	const [status, setStatus] = useState<SceneMetadataStatus>('idle')

	const resetTimerRef = useRef<number | null>(null)

	useEffect(() => {
		return () => {
			if (resetTimerRef.current) {
				window.clearTimeout(resetTimerRef.current)
			}
		}
	}, [])

	useEffect(() => {
		setSceneState(scene)
		setNameDraft(scene.name)
		setDescriptionDraft(scene.description || '')
		setStatus('idle')
	}, [scene])

	const nameTrimmed = nameDraft.trim()
	const descriptionCurrent = sceneState.description || ''
	const isTitleUnsaved =
		nameTrimmed.length > 0 && nameTrimmed !== sceneState.name
	const isDescriptionUnsaved = descriptionDraft !== descriptionCurrent
	const isUnsaved = isTitleUnsaved || isDescriptionUnsaved

	async function save() {
		if (!nameTrimmed || isSaving) {
			return
		}

		const hasChanges =
			nameTrimmed !== sceneState.name || descriptionDraft !== descriptionCurrent

		if (!hasChanges) {
			return
		}

		setIsSaving(true)
		setStatus('idle')

		try {
			const formData = new FormData()
			formData.append('action', 'update-scene-metadata')
			formData.append('name', nameTrimmed)
			formData.append('description', descriptionDraft)
			// This request bypasses React Router, so nothing attaches the token for
			// it. Without this the endpoint fell back to an origin-only check that
			// passes when a client sends neither `Origin` nor `Referer`.
			formData.append('csrf', csrfToken)

			const response = await fetch(`/api/scenes/${sceneState.id}`, {
				method: 'POST',
				body: formData
			})

			const payload = await response.json()
			if (!response.ok || payload.error || !payload?.data?.scene) {
				throw new Error(payload?.error || 'Failed to update scene metadata')
			}

			const updatedScene = payload.data.scene as TScene
			setSceneState(updatedScene)
			setNameDraft(updatedScene.name)
			setDescriptionDraft(updatedScene.description || '')
			setStatus('saved')
		} catch (error) {
			console.error('Failed to update scene metadata:', error)
			setStatus('error')
		} finally {
			setIsSaving(false)
			if (resetTimerRef.current) {
				window.clearTimeout(resetTimerRef.current)
			}
			resetTimerRef.current = window.setTimeout(() => {
				setStatus('idle')
			}, STATUS_RESET_MS)
		}
	}

	return {
		scene: sceneState,
		nameDraft,
		setNameDraft,
		descriptionDraft,
		setDescriptionDraft,
		isSaving,
		status,
		isTitleUnsaved,
		isDescriptionUnsaved,
		isUnsaved,
		save
	}
}
