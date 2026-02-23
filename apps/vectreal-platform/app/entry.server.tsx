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

import type { RenderToPipeableStreamOptions } from 'react-dom/server'
import type { AppLoadContext, EntryContext } from 'react-router'

export const streamTimeout = 5_000

const CACHEABLE_PUBLIC_PATHS = new Set([
	'/',
	'/about',
	'/contact',
	'/privacy-policy',
	'/terms-of-service',
	'/imprint'
])

function hasAuthSignals(request: Request): boolean {
	if (request.headers.has('authorization')) {
		return true
	}

	const cookieHeader = request.headers.get('cookie')
	return Boolean(cookieHeader && cookieHeader.trim().length > 0)
}

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

	const requestUrl = new URL(request.url)
	const hasSearchParams = requestUrl.search.length > 0
	const cacheablePublicPath = CACHEABLE_PUBLIC_PATHS.has(requestUrl.pathname)

	if (!hasAuthSignals(request) && !hasSearchParams && cacheablePublicPath) {
		responseHeaders.set(
			'Cache-Control',
			'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
		)
		responseHeaders.set('Vary', 'Accept-Encoding')
		return
	}

	responseHeaders.set('Cache-Control', 'no-store')
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
