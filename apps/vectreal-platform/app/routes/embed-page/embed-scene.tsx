import { useOutletContext } from 'react-router'

import { Route } from './+types/embed-scene'
import SceneEmbedPage from '../../components/scene-embed/scene-embed-page'

import type { EmbedLayoutContext } from '../layouts/embed-layout'

/**
 * The external embed target. Authenticated by preview API key in
 * `embed-layout.tsx`, so this route structurally cannot render internal chrome.
 */
const EmbedScenePage = ({ params }: Route.ComponentProps) => {
	const { showsVectrealBranding } = useOutletContext<EmbedLayoutContext>()

	return (
		<SceneEmbedPage
			projectId={params.projectId}
			sceneId={params.sceneId}
			showsVectrealBranding={showsVectrealBranding}
		/>
	)
}

export default EmbedScenePage
