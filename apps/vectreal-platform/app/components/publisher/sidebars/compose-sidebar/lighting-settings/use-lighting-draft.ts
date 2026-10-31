import { useAtom } from 'jotai/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { lightingAtom } from '../../../../../lib/stores/scene-settings-store'

import type { LightingSettings } from '@vctrl/core'

const COMMIT_DELAY_MS = 250

type Edit = (lighting: LightingSettings) => LightingSettings

/**
 * The lighting as the panel shows it, ahead of the scene while a slider moves.
 *
 * Every lighting change restarts the ground bake, so a drag that reached the
 * scene each tick would show a ground that never settles. The panel follows
 * the drag at once and the scene catches up shortly after it stops; a click
 * (a switch, a setup) reaches the scene at once.
 */
export function useLightingDraft() {
	const [lighting, setLighting] = useAtom(lightingAtom)
	const [draft, setDraft] = useState(lighting)
	const latest = useRef(lighting)
	const pending = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		latest.current = lighting
		setDraft(lighting)
	}, [lighting])

	const flush = useCallback(() => {
		if (!pending.current) return
		clearTimeout(pending.current)
		pending.current = null
		setLighting(latest.current)
	}, [setLighting])

	// Leaving the panel mid-drag keeps the last value rather than dropping it.
	useEffect(() => flush, [flush])

	const apply = useCallback(
		(edit: Edit, settle: 'now' | 'later') => {
			// From the latest edit, not this render's draft: two edits can land
			// before the panel renders again.
			const next = edit(latest.current)
			latest.current = next
			setDraft(next)
			if (pending.current) clearTimeout(pending.current)
			pending.current = null
			if (settle === 'now') {
				setLighting(next)
			} else {
				pending.current = setTimeout(() => {
					pending.current = null
					setLighting(latest.current)
				}, COMMIT_DELAY_MS)
			}
		},
		[setLighting]
	)

	/** For a click: reaches the scene at once. */
	const commit = useCallback((edit: Edit) => apply(edit, 'now'), [apply])
	/** For a drag: reaches the scene once it pauses. */
	const preview = useCallback((edit: Edit) => apply(edit, 'later'), [apply])

	return { lighting: draft, commit, preview }
}
