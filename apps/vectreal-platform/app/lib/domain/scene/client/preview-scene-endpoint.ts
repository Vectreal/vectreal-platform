interface BuildPreviewSceneEndpointParams {
	sceneId: string
	projectId: string
	token?: string
}

/**
 * The endpoint a preview surface loads a scene from.
 *
 * Preview reads are scoped by project and, for share links, by token, so the
 * scene id alone does not identify the request.
 */
export function buildPreviewSceneEndpoint({
	sceneId,
	projectId,
	token
}: BuildPreviewSceneEndpointParams): string {
	const endpointParams = new URLSearchParams({
		projectId,
		preview: '1'
	})

	if (token) {
		endpointParams.set('token', token)
	}

	return `/api/scenes/${sceneId}?${endpointParams.toString()}`
}

/**
 * A scene asset as a signed-in preview surface fetches it: scoped by project
 * like the manifest, and authenticated by the session cookie.
 */
export function buildPreviewAssetUrl({
	sceneId,
	projectId,
	assetId
}: {
	sceneId: string
	projectId: string
	assetId: string
}): string {
	const query = new URLSearchParams({ preview: '1', projectId })
	return `/api/scenes/${sceneId}/assets/${assetId}?${query}`
}
