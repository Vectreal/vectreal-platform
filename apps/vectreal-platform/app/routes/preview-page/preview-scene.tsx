import { useOutletContext } from 'react-router'

import { Route } from './+types/preview-scene'
import { EmbedResourceHints } from '../../components/scene-embed/embed-resource-hints'
import PreviewChrome from '../../components/scene-embed/preview-chrome/preview-chrome'
import SceneEmbedPage from '../../components/scene-embed/scene-embed-page'
import { useAppColorScheme } from '../../hooks/use-app-color-scheme'

import type { PreviewLayoutContext } from '../layouts/preview-layout'

/**
 * The internal preview target. Session-authenticated in `preview-layout.tsx`
 * and reachable only from the dashboard, which is why it is the surface allowed
 * to carry chrome.
 *
 * The viewer follows the app rather than the visitor's OS here, unlike
 * `/embed`. `PreviewChrome` is drawn in app tokens, so the two sit on the same
 * screen and have to resolve to the same scheme; an author who forces light
 * against a dark OS would otherwise get light chrome over a dark viewer.
 *
 * A published scene renders the published artefact, the manifest an embed
 * gets, so the author checks what ships; a draft renders the working scene.
 */
const PreviewScenePage = ({ params }: Route.ComponentProps) => {
	const theme = useAppColorScheme()
	const { manifest } = useOutletContext<PreviewLayoutContext>()

	return (
		<>
			{manifest && <EmbedResourceHints manifest={manifest} />}
			<SceneEmbedPage
				projectId={params.projectId}
				sceneId={params.sceneId}
				initialManifest={manifest}
				theme={theme}
				chrome={({
					cameras,
					activeCameraId,
					activeHotspotName,
					activateCamera
				}) => (
					<PreviewChrome
						backTo={`/dashboard/projects/${params.projectId}/${params.sceneId}`}
						cameras={cameras}
						activeCameraId={activeCameraId}
						activeHotspotName={activeHotspotName}
						onSelectCamera={activateCamera}
					/>
				)}
			/>
		</>
	)
}

export default PreviewScenePage
