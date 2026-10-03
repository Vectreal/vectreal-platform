import { vi } from 'vitest'

/** Answers one save request: the form the orchestrator sent, as the API would. */
export type SceneApiHandler = (form: FormData) => Promise<Response> | Response

/**
 * Stubs the scene API for the save orchestrator, which reaches it two ways:
 * `fetch` for the prepare and commit steps, and `XMLHttpRequest` for file
 * uploads, the one transport that reports upload progress. Both go to the
 * same handler, so a spec states the API once.
 *
 * The fake request reports half the body sent, then all of it, before it
 * answers, so a spec can see progress arrive between start and finish.
 */
export function stubSceneApi(handler: SceneApiHandler) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url: string, init: { body: FormData }) => handler(init.body))
	)

	class FakeXMLHttpRequest {
		upload: {
			onprogress:
				| ((event: {
						lengthComputable: boolean
						loaded: number
						total: number
				  }) => void)
				| null
		} = { onprogress: null }
		onload: (() => void) | null = null
		onerror: (() => void) | null = null
		status = 0
		responseText = ''
		private contentType: string | null = null

		open() {}

		getResponseHeader(name: string) {
			return name.toLowerCase() === 'content-type' ? this.contentType : null
		}

		send(body: FormData) {
			void (async () => {
				for (const loaded of [50, 100]) {
					this.upload.onprogress?.({
						lengthComputable: true,
						loaded,
						total: 100
					})
				}
				try {
					const response = await handler(body)
					this.status = response.status
					this.contentType = response.headers.get('content-type')
					this.responseText = await response.text()
					this.onload?.()
				} catch {
					this.onerror?.()
				}
			})()
		}
	}

	vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest)
}

/** The envelope every real endpoint answers in (`ApiResponse.success`). */
export const ok = (data: unknown) => Response.json({ success: true, data })
