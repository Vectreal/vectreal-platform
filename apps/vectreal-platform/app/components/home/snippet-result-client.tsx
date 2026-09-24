import { useGLTF } from '@react-three/drei'
import { VectrealViewer } from '@vctrl/viewer'

import { HERO_MODEL } from '../../lib/samples/sample-models'

/**
 * The home page's code snippet, run.
 *
 * This is the snippet's `ProductView`, line for line, with the camera's real
 * address where the snippet writes `/camera.glb`. Keep the two in step: the
 * pane exists to show that the code beside it is the code that draws this.
 *
 * Its own chunk, loaded only when the reader presses Run: the viewer and the
 * React Three stack under it are about 210 KB gzipped on top of three.js,
 * which the hero has already loaded, and nobody else on the page needs them.
 */
/** Drops a failed load of the model, so the next render fetches it again rather than rethrowing. */
export function forgetModel() {
	useGLTF.clear(HERO_MODEL.url)
}

export default function SnippetResultClient() {
	const { scene } = useGLTF(HERO_MODEL.url, '/draco/')
	return <VectrealViewer model={scene} />
}
