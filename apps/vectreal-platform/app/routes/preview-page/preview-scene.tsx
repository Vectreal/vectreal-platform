import { Route } from './+types/preview-scene'
import PreviewChrome from '../../components/scene-embed/preview-chrome/preview-chrome'
import SceneEmbedPage from '../../components/scene-embed/scene-embed-page'
import { useAppColorScheme } from '../../hooks/use-app-color-scheme'

/**
 * The internal preview target. Session-authenticated in `preview-layout.tsx`
 * and reachable only from the dashboard, which is why it is the surface allowed
 * to carry chrome.
 *
 * The viewer follows the app rather than the visitor's OS here, unlike
 * `/embed`. `PreviewChrome` is drawn in app tokens, so the two sit on the same
 * screen and have to resolve to the same scheme; an author who forces light
 * against a dark OS would otherwise get light chrome over a dark viewer.
 */
const PreviewScenePage = ({ params }: Route.ComponentProps) => {
	const theme = useAppColorScheme()

	return (
		<SceneEmbedPage
			projectId={params.projectId}
			sceneId={params.sceneId}
			theme={theme}
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
}

export default PreviewScenePage
