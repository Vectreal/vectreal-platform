import { Route } from './+types/preview-scene'
import PreviewChrome from '../../components/scene-embed/preview-chrome/preview-chrome'
import SceneEmbedPage from '../../components/scene-embed/scene-embed-page'

/**
 * The internal preview target. Session-authenticated in `preview-layout.tsx`
 * and reachable only from the dashboard, which is why it is the surface allowed
 * to carry chrome.
 */
const PreviewScenePage = ({ params }: Route.ComponentProps) => (
	<SceneEmbedPage
		projectId={params.projectId}
		sceneId={params.sceneId}
		chrome={({ cameras, activeCameraId, activateCamera }) => (
			<PreviewChrome
				backTo={`/dashboard/projects/${params.projectId}/${params.sceneId}`}
				cameras={cameras}
				activeCameraId={activeCameraId}
				onSelectCamera={activateCamera}
			/>
		)}
	/>
)

export default PreviewScenePage
