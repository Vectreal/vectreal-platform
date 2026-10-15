import { useCallback } from 'react'

import { useApplySceneSettings } from './use-scene-settings'

import type { useSceneUpload } from './use-scene-upload'
import type { ExampleScene } from '../../lib/samples/example-scenes'
import type { InputFileOrDirectory } from '@vctrl/hooks/use-load-model'

/**
 * Opens an example scene: its model through the same path a dropped file
 * takes, then its settings on top.
 *
 * The order is the point. An upload resets the scene to its defaults once the
 * model is in (`useSceneUpload`), so settings applied before or alongside it
 * are wiped. They go on only after a load that succeeded, and as an unsaved
 * scene, the way a restored draft is applied: an example has never been saved,
 * and adopting it as the saved baseline would leave Save with nothing to do.
 */
export function useOpenExampleScene(
	uploadFiles: ReturnType<typeof useSceneUpload>['uploadFiles']
) {
	const applySceneSettings = useApplySceneSettings()

	return useCallback(
		async (example: ExampleScene, file: File) => {
			const result = await uploadFiles([file] as InputFileOrDirectory)
			if (result.status !== 'ready') return
			applySceneSettings(example.settings, { isSavedBaseline: false })
		},
		[applySceneSettings, uploadFiles]
	)
}
