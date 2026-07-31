import { Route } from './+types/preview-scene'
import SceneEmbedPage from '../../components/scene-embed/scene-embed-page'

/**
 * The internal preview target. Session-authenticated in `preview-layout.tsx`
 * and reachable only from the dashboard.
 */
const PreviewScenePage = ({ params }: Route.ComponentProps) => (
	<SceneEmbedPage projectId={params.projectId} sceneId={params.sceneId} />
)

export default PreviewScenePage
