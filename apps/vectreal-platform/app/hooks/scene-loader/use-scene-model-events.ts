import { useEffect } from 'react'

import type { SceneModelEventBindings } from './contracts'

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
