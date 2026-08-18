import { useEffect, useRef } from 'react'

import type {
	ModelSource,
	ModelState,
	UseLoadModelReturn
} from '@vctrl/hooks/use-load-model'

type SceneModelLoader = Pick<UseLoadModelReturn<boolean>, 'load'>

/**
 * Identity of a source, for deciding when a reload is warranted.
 *
 * Source objects are rebuilt on every render, so the effect below keys off this
 * string instead. Change the id, the endpoint or the parse mode and the scene
 * reloads; re-render with the same scene and nothing happens.
 */
const sceneSourceKey = (source: ModelSource): string => {
	switch (source.kind) {
		case 'files':
			return 'files'
		case 'scene-data':
			return `scene-data:${source.sceneId ?? 'inline'}:${source.parseMode ?? 'document'}`
		case 'server':
			return `server:${source.sceneId}:${source.serverOptions?.endpoint ?? ''}:${source.parseMode ?? 'document'}`
	}
}

/**
 * Keeps a loader showing the scene a route is pointing at.
 *
 * This is the one place a scene load is triggered declaratively. Everything else
 * about the load - progress, failure, the model itself - is already on the
 * loader's own state, so this hook returns nothing and owns no state of its own.
 * A `null` source means "nothing to load here" (a fresh upload, an unresolved
 * route), not "clear the model".
 *
 * Cancellation is deliberately absent: `load` retires superseded loads itself,
 * so a stale response can never overwrite a newer one.
 *
 * `onSettled` runs once per load with its terminal state, for the work that
 * belongs to the load rather than to the render (a toast, an analytics event).
 */
export function useSceneModel(
	{ load }: SceneModelLoader,
	source: ModelSource | null,
	onSettled?: (state: ModelState) => void
): void {
	const key = source ? sceneSourceKey(source) : null
	const sourceRef = useRef(source)
	sourceRef.current = source
	const onSettledRef = useRef(onSettled)
	onSettledRef.current = onSettled

	useEffect(() => {
		const current = sourceRef.current
		if (!key || !current) return

		void load(current).then((state) => onSettledRef.current?.(state))
	}, [key, load])
}
