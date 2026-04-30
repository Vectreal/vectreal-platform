import type {
	SceneLoadOptions,
	SceneLoadResult
} from '@vctrl/hooks/use-load-model'

type LoadSceneFromServer = (
	options: SceneLoadOptions
) => Promise<SceneLoadResult>

const inFlightSceneRequests = new Map<string, Promise<SceneLoadResult>>()

interface LoadSceneFromApiParams {
	sceneId: string
	endpoint: string
	loadFromServer: LoadSceneFromServer
	apiKey?: string
	requestKey?: string
}

export function loadSceneFromApi({
	sceneId,
	endpoint,
	loadFromServer,
	apiKey,
	requestKey = sceneId
}: LoadSceneFromApiParams): Promise<SceneLoadResult> {
	const existingRequest = inFlightSceneRequests.get(requestKey)
	if (existingRequest) {
		return existingRequest
	}

	const request = loadFromServer({
		sceneId,
		serverOptions: {
			endpoint,
			apiKey
		}
	})

	inFlightSceneRequests.set(
		requestKey,
		request.finally(() => {
			inFlightSceneRequests.delete(requestKey)
		})
	)

	return request
}

interface BuildPreviewSceneRequestParams {
	sceneId: string
	projectId: string
	token?: string
}

export function buildPreviewSceneRequest({
	sceneId,
	projectId,
	token
}: BuildPreviewSceneRequestParams): {
	endpoint: string
	requestKey: string
} {
	const endpointParams = new URLSearchParams({
		projectId,
		preview: '1'
	})

	if (token) {
		endpointParams.set('token', token)
	}

	return {
		endpoint: `/api/scenes/${sceneId}?${endpointParams.toString()}`,
		requestKey: `${sceneId}:${projectId}:${token ?? ''}`
	}
}
