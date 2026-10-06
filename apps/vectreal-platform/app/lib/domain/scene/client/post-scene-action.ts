/** The scene API's answer, or the reason no answer arrived. */
export interface SceneActionResult {
	success: boolean
	error?: string
	data?: unknown
}

const UNREACHABLE = 'Could not reach the server. Try again.'

/**
 * Posts a JSON action to `/api/scenes/:sceneId` and always resolves.
 *
 * A request that never gets an answer (offline, a dropped connection, a proxy
 * answering with an HTML error page) comes back as a refusal rather than a
 * throw. Called from a route's `clientAction`, that is the difference between
 * a control rolling back with a toast and React Router replacing the whole
 * page with its error boundary.
 */
export async function postSceneAction(
	sceneId: string,
	body: unknown,
	fetchImpl: typeof fetch = fetch
): Promise<SceneActionResult> {
	try {
		const response = await fetchImpl(`/api/scenes/${sceneId}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
		const payload = (await response.json()) as SceneActionResult
		return response.ok ? payload : { ...payload, success: false }
	} catch {
		return { success: false, error: UNREACHABLE }
	}
}
