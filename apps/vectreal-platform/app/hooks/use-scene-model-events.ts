import { useEffect } from 'react'

import type { EventHandler, EventTypes } from '@vctrl/hooks/use-load-model'

interface SceneModelEventBindings {
	on: <TEventName extends EventTypes>(
		eventName: TEventName,
		handler: EventHandler<TEventName>
	) => void
	off: <TEventName extends EventTypes>(
		eventName: TEventName,
		handler: EventHandler<TEventName>
	) => void
	handleNotLoadedFiles: EventHandler<'not-loaded-files'>
	handleLoadComplete: EventHandler<'load-complete'>
	handleLoadError: EventHandler<'load-error'>
}

export const useSceneModelEvents = ({
	on,
	off,
	handleNotLoadedFiles,
	handleLoadComplete,
	handleLoadError
}: SceneModelEventBindings) => {
	useEffect(() => {
		on('not-loaded-files', handleNotLoadedFiles)
		on('load-complete', handleLoadComplete)
		on('load-error', handleLoadError)

		return () => {
			off('not-loaded-files', handleNotLoadedFiles)
			off('load-complete', handleLoadComplete)
			off('load-error', handleLoadError)
		}
	}, [on, off, handleLoadComplete, handleLoadError, handleNotLoadedFiles])
}
