import { Route } from './+types/embed-scene'
import SceneEmbedPage from '../../components/scene-embed/scene-embed-page'

/**
 * The external embed target. Authenticated by preview API key in
 * `embed-layout.tsx`, so this route structurally cannot render internal chrome.
 */
const EmbedScenePage = ({ params }: Route.ComponentProps) => (
	<SceneEmbedPage projectId={params.projectId} sceneId={params.sceneId} />
)

export default EmbedScenePage
