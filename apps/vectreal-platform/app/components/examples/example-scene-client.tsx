import { useGLTF } from '@react-three/drei'
import { VectrealViewer } from '@vctrl/viewer'

import { withSceneSettingsDefaults } from '../../constants/viewer-defaults'

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
	const settings = withSceneSettingsDefaults(example.settings)

	return (
		<VectrealViewer
			className="h-full w-full"
			model={scene}
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
