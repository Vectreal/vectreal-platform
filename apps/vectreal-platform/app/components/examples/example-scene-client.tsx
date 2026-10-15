import { useGLTF } from '@react-three/drei'
import { VectrealViewer } from '@vctrl/viewer'
import { useMemo } from 'react'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { withSceneSettingsDefaults } from '../../constants/viewer-defaults'
import { useAppColorScheme } from '../../hooks/use-app-color-scheme'

import type { ExampleScene } from '../../lib/samples/example-scenes'

/**
 * The example rendered by the real viewer, with its settings resolved the way
 * the publisher resolves them (`withSceneSettingsDefaults`), so the scene on the
 * page is the scene that opens there.
 *
 * Its own chunk: three.js and the viewer load only for a reader who asked.
 */
export default function ExampleSceneClient({
	example
}: {
	example: ExampleScene
}) {
	// Draco-compressed, decoded by the copy the app serves rather than a CDN's.
	const { scene } = useGLTF(example.model.url, '/draco/')
	/*
	  A copy per viewer. `useGLTF` caches by URL, so every example of one model
	  receives the same scene, and an object can only have one parent: the
	  second viewer on a page took the model out of the first, which went blank.
	  `SkeletonUtils.clone` rather than `Object3D.clone`, which leaves a skinned
	  mesh bound to the original's bones.
	*/
	const model = useMemo(() => clone(scene), [scene])
	const settings = withSceneSettingsDefaults(example.settings)
	// The article's scheme, not the visitor's system one, so the camera
	// switcher matches the page it sits in.
	const theme = useAppColorScheme()

	return (
		<VectrealViewer
			className="h-full w-full"
			theme={theme}
			model={model}
			animationOptions={settings.animation}
			boundsOptions={settings.bounds}
			cameraOptions={settings.camera}
			controlsOptions={settings.controls}
			envOptions={settings.environment}
			shadowsOptions={settings.shadows}
			normalizationOptions={settings.normalization}
		/>
	)
}
