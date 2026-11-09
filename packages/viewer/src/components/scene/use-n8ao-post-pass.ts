import { useEffect, useState } from 'react'

import { loadN8AOPostPass, type N8AOPostPassConstructor } from './n8ao'

/**
 * The N8AO pass class the composer is built with: `null` for none, and
 * `undefined` only while a viewer that opens with live AO waits for it.
 *
 * Waiting holds the first pipeline back, since a chain built without the pass
 * would compile every shader once without AO and again with it. Once a
 * pipeline exists, turning AO on keeps drawing through the current one until
 * the pass arrives, as switching it always did. A failed fetch settles on no
 * AO, so the scene still shows, and the next time AO is turned on it is
 * fetched again.
 */
export const useN8AOPostPass = (ao: boolean) => {
	const [fetched, setFetched] = useState<{
		pass?: N8AOPostPassConstructor
		failed?: boolean
	}>({})

	useEffect(() => {
		if (!ao || fetched.pass) return
		let cancelled = false
		loadN8AOPostPass().then(
			(pass) => {
				if (!cancelled) setFetched({ pass })
			},
			(error: unknown) => {
				console.warn('Ambient occlusion is unavailable:', error)
				if (!cancelled) setFetched({ failed: true })
			}
		)
		return () => {
			cancelled = true
		}
	}, [ao, fetched.pass])

	const requested = !ao
		? null
		: (fetched.pass ?? (fetched.failed ? null : undefined))

	// What the composer was last built with, kept while a request is pending.
	// Adjusted during render rather than in an effect, so no frame sees the
	// pending value: https://react.dev/learn/you-might-not-need-an-effect
	// Both wrapped: the pass is a class, which React would call as an updater.
	const [settled, setSettled] = useState(() => requested)
	if (requested !== undefined && requested !== settled) {
		setSettled(() => requested)
	}
	return requested === undefined ? settled : requested
}
