/**
 * By default, React Router will handle generating the HTTP Response for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://reactrouter.com/explanation/special-files#entryservertsx
 */

import { PassThrough } from 'node:stream'

import { createReadableStreamFromReadable } from '@react-router/node'
import { isbot } from 'isbot'
import { renderToPipeableStream } from 'react-dom/server'
import { ServerRouter } from 'react-router'

import {
	isAnonymousCacheableRequest,
	PUBLIC_CACHE_CONTROL
} from './lib/http/cacheable-public-paths.server'

import type { RenderToPipeableStreamOptions } from 'react-dom/server'
import type {
	ActionFunctionArgs,
	AppLoadContext,
	EntryContext,
	LoaderFunctionArgs
} from 'react-router'

export const streamTimeout = 5_000

function applyDefaultCacheHeaders(
	request: Request,
	responseHeaders: Headers,
	responseStatusCode: number
): void {
	if (responseHeaders.has('Cache-Control')) {
		return
	}

	if (request.method !== 'GET' || responseStatusCode !== 200) {
		responseHeaders.set('Cache-Control', 'no-store')
		return
	}

	if (isAnonymousCacheableRequest(request)) {
		responseHeaders.set('Cache-Control', PUBLIC_CACHE_CONTROL)
		responseHeaders.set('Vary', 'Accept-Encoding')
		return
	}

	responseHeaders.set('Cache-Control', 'no-store')
}

/**
 * Apply the same cache policy to single-fetch loader/action (`.data`) responses
 * that `handleRequest` applies to documents. React Router does not propagate a
 * loader's `data(payload, { headers })` onto the `.data` response, so without
 * this hook authenticated `.data` responses ship with no `Cache-Control` and
 * Cloudflare (cache=true, respect_origin) caches them by URL — serving one
 * visitor's user/org/scene data to another. Routing through the same predicate
 * keeps documents and data on a single source of truth.
 */
export function handleDataRequest(
	response: Response,
	{ request }: LoaderFunctionArgs | ActionFunctionArgs
): Response {
	applyDefaultCacheHeaders(request, response.headers, response.status)
	return response
}

export default function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	routerContext: EntryContext,
	_loadContext: AppLoadContext
) {
	return new Promise((resolve, reject) => {
		let shellRendered = false
		const userAgent = request.headers.get('user-agent')

		// Ensure requests from bots and SPA Mode renders wait for all content to load before responding
		// https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
		const readyOption: keyof RenderToPipeableStreamOptions =
			(userAgent && isbot(userAgent)) || routerContext.isSpaMode
				? 'onAllReady'
				: 'onShellReady'

		const { pipe, abort } = renderToPipeableStream(
			<ServerRouter context={routerContext} url={request.url} />,
			{
				[readyOption]() {
					shellRendered = true
					const body = new PassThrough()
					const stream = createReadableStreamFromReadable(body)

					responseHeaders.set('Content-Type', 'text/html')
					applyDefaultCacheHeaders(request, responseHeaders, responseStatusCode)

					resolve(
						new Response(stream, {
							headers: responseHeaders,
							status: responseStatusCode
						})
					)

					pipe(body)
				},
				onShellError(error: unknown) {
					reject(error)
				},
				onError(error: unknown) {
					responseStatusCode = 500
					// Log streaming rendering errors from inside the shell.  Don't log
					// errors encountered during initial shell rendering since they'll
					// reject and get logged in handleDocumentRequest.
					if (shellRendered) {
						console.error(error)
					}
				}
			}
		)

		// Abort the rendering stream after the `streamTimeout` so it has time to
		// flush down the rejected boundaries
		setTimeout(abort, streamTimeout + 1000)
	})
}
