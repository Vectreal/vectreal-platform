import { useOutletContext } from 'react-router'

import { Route } from './+types/embed-scene'
import { EmbedResourceHints } from '../../components/scene-embed/embed-resource-hints'
import SceneEmbedPage from '../../components/scene-embed/scene-embed-page'

import type { EmbedLayoutContext } from '../layouts/embed-layout'

/**
 * The external embed target. Authenticated by preview API key in
 * `embed-layout.tsx`, so this route structurally cannot render internal chrome.
 */
const EmbedScenePage = ({ params }: Route.ComponentProps) => {
	const { showsVectrealBranding, manifest } =
		useOutletContext<EmbedLayoutContext>()

	return (
		<>
			{manifest && <EmbedResourceHints manifest={manifest} />}
			<SceneEmbedPage
				projectId={params.projectId}
				sceneId={params.sceneId}
				showsVectrealBranding={showsVectrealBranding}
				initialManifest={manifest}
			/>
		</>
	)
}

export default EmbedScenePage
