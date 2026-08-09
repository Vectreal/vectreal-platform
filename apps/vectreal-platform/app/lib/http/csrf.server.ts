import { ApiResponse } from '@shared/utils'

import { buildCsrfCarrier, csrfSession } from '../sessions/csrf-session.server'

function parseOrigin(value: null | string): null | string {
	if (!value) {
		return null
	}

	try {
		return new URL(value).origin
	} catch {
		return null
	}
}

function firstHeaderValue(value: null | string): null | string {
	if (!value) {
		return null
	}

	const first = value.split(',')[0]?.trim()
	return first || null
}

function normalizePort(url: URL): string {
	if (url.port) {
		return url.port
	}

	if (url.protocol === 'https:') {
		return '443'
	}

	if (url.protocol === 'http:') {
		return '80'
	}

	return ''
}

function isSameOrigin(leftOrigin: string, rightOrigin: string): boolean {
	if (leftOrigin === rightOrigin) {
		return true
	}

	try {
		const left = new URL(leftOrigin)
		const right = new URL(rightOrigin)

		return (
			left.hostname === right.hostname &&
			normalizePort(left) === normalizePort(right)
		)
	} catch {
		return false
	}
}

function getRequestOrigin(request: Request): string {
	// Prefer forwarded headers when behind a reverse proxy/load balancer.
	const forwardedProto = firstHeaderValue(
		request.headers.get('x-forwarded-proto')
	)
	const forwardedHost = firstHeaderValue(
		request.headers.get('x-forwarded-host')
	)

	if (forwardedProto && forwardedHost) {
		const forwardedOrigin = parseOrigin(`${forwardedProto}://${forwardedHost}`)
		if (forwardedOrigin) {
			return forwardedOrigin
		}
	}

	const host = firstHeaderValue(request.headers.get('host'))
	if (forwardedProto && host) {
		const originFromHost = parseOrigin(`${forwardedProto}://${host}`)
		if (originFromHost) {
			return originFromHost
		}
	}

	return new URL(request.url).origin
}

/**
 * Reject cross-origin mutation requests.
 *
 * This is a defense-in-depth CSRF gate for POST/PUT/PATCH/DELETE handlers.
 */
export function ensureSameOriginMutation(request: Request): Response | null {
	if (request.method === 'GET' || request.method === 'HEAD') {
		return null
	}

	const requestOrigin = getRequestOrigin(request)
	const originHeader = parseOrigin(request.headers.get('origin'))

	if (originHeader) {
		if (!isSameOrigin(originHeader, requestOrigin)) {
			return ApiResponse.forbidden('Cross-origin requests are not allowed')
		}

		return null
	}

	const refererHeader = request.headers.get('referer')
	const refererOrigin = parseOrigin(refererHeader)
	if (refererOrigin && !isSameOrigin(refererOrigin, requestOrigin)) {
		return ApiResponse.forbidden('Cross-origin requests are not allowed')
	}

	return null
}

export async function ensureValidCsrfFormData(
	request: Request,
	formData: FormData
): Promise<Response | null> {
	const sameOriginCheck = ensureSameOriginMutation(request)
	if (sameOriginCheck) {
		return sameOriginCheck
	}

	try {
		await csrfSession.validate(formData, request.headers)
		return null
	} catch {
		return ApiResponse.forbidden('Invalid CSRF token')
	}
}

/**
 * Token CSRF for handlers that have already consumed the request body.
 *
 * `ensureValidCsrfFormData` needs the `FormData` itself, but a route parsed with
 * `parseActionRequest` no longer has one - the body is read once and comes back
 * as a plain record, and a `Request` body cannot be read twice. This validates
 * the same token taken from that record.
 *
 * Origin checking still runs first, so this is strictly stronger than the
 * origin-only check it is meant to replace - that one passes when both `Origin`
 * and `Referer` are absent.
 */
export async function ensureValidCsrfToken(
	request: Request,
	token: unknown
): Promise<Response | null> {
	const sameOriginCheck = ensureSameOriginMutation(request)
	if (sameOriginCheck) {
		return sameOriginCheck
	}

	if (typeof token !== 'string' || token.length === 0) {
		return ApiResponse.forbidden('Missing CSRF token')
	}

	// `csrfSession` reads the token out of a `FormData` under `formDataKey`, so
	// hand it one holding just that field.
	try {
		await csrfSession.validate(buildCsrfCarrier(token), request.headers)
		return null
	} catch {
		return ApiResponse.forbidden('Invalid CSRF token')
	}
}
