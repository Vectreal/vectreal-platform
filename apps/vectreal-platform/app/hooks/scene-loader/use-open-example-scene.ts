import { useCallback } from 'react'

import { useApplySceneSettings } from './use-scene-settings'
import { sampleModelSource } from '../../lib/samples/sample-models'

import type { useSceneUpload } from './use-scene-upload'
import type { ExampleScene } from '../../lib/samples/example-scenes'

/**
 * Opens an example scene: its model through the same path any added model
 * takes, then its settings on top.
 *
 * The order is the point. Adding a model resets the scene to its defaults once
 * the model is in (`useSceneUpload`), so settings applied before or alongside
 * it are wiped. They go on only after a load that succeeded and is still the
 * current one, and as an unsaved scene, the way a restored draft is applied: an
 * example has never been saved, and adopting it as the saved baseline would
 * leave Save with nothing to do.
 */
export function useOpenExampleScene(
	openModel: ReturnType<typeof useSceneUpload>['openModel']
) {
	const applySceneSettings = useApplySceneSettings()

	return useCallback(
		async (example: ExampleScene) => {
			const result = await openModel(sampleModelSource(example.model))
			if (result.status !== 'ready' || !result.stillCurrent()) return
			applySceneSettings(example.settings, { isSavedBaseline: false })
		},
		[applySceneSettings, openModel]
	)
}
