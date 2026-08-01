import { redirect } from 'react-router'

import { Route } from './+types/legacy-embed-redirect'
import { buildEmbedPath } from '../../lib/domain/embed/embed-snippet'

/**
 * `/preview/fullscreen/:projectId/:sceneId` was the embed URL before external
 * embeds moved to `/embed`. Every live embed carries `?token=`, and the docs
 * also pass `camera`, `autoRotate`, and `transition`, so the query string has to
 * survive the redirect or existing embeds break.
 */
export function loader({ params, request }: Route.LoaderArgs) {
	const { search } = new URL(request.url)
	const projectId = params.projectId ?? ''
	const sceneId = params.sceneId ?? ''

	return redirect(`${buildEmbedPath({ projectId, sceneId })}${search}`, 301)
}
