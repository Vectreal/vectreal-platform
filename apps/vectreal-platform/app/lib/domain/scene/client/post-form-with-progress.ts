/**
 * POSTs a form and reports how much of it has been sent, as a fraction.
 *
 * XMLHttpRequest because `fetch` still exposes no upload progress. It resolves
 * to a `Response`, so a caller parses the answer exactly as it parses a fetch's
 * and an error envelope, a billing limit included, reaches it unchanged.
 */
export const postFormWithProgress = (
	url: string,
	body: FormData,
	onProgress: (fraction: number) => void
): Promise<Response> =>
	new Promise((resolve, reject) => {
		const request = new XMLHttpRequest()
		request.open('POST', url)
		request.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress(event.loaded / event.total)
		}
		request.onload = () =>
			resolve(
				new Response(request.responseText, {
					status: request.status,
					headers: {
						'content-type':
							request.getResponseHeader('content-type') ?? 'application/json'
					}
				})
			)
		request.onerror = () => reject(new Error('The upload was interrupted.'))
		request.send(body)
	})
