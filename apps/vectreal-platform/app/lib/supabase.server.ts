import { AsyncLocalStorage } from 'node:async_hooks'

import {
	createServerClient,
	parseCookieHeader,
	serializeCookieHeader,
	type CookieOptions
} from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

import type { SupabaseClient } from '@supabase/supabase-js'

interface SupabaseClientContext {
	client: SupabaseClient
	headers: Headers
}

/**
 * Cache one Supabase client per Request object so that parallel loaders
 * running during the same SSR render share a single client instance.
 *
 * This prevents the refresh-token race condition where multiple loaders
 * each try to exchange the same expired refresh token simultaneously -
 * only the first would succeed after Supabase rotates the token, causing
 * all others to receive `refresh_token_not_found`.
 */
const clientCache = new WeakMap<Request, SupabaseClientContext>()

/**
 * One client per incoming HTTP request, not per Request object. React Router
 * runs the loaders that revalidate after a document POST on a fresh Request,
 * so the WeakMap alone gave the action and those loaders a client each: two
 * refreshes of one token, and cookies the session cookie middleware could not
 * find. `sessionCookieMiddleware` opens this scope around every request; the
 * WeakMap still serves code that runs outside it, such as tests.
 */
const requestScope = new AsyncLocalStorage<{
	context?: SupabaseClientContext
}>()

export function runInSupabaseScope<T>(fn: () => Promise<T>): Promise<T> {
	return requestScope.run({}, fn)
}

export async function createSupabaseClient(request: Request) {
	const scope = requestScope.getStore()
	const cached = scope?.context ?? clientCache.get(request)
	if (cached) return cached

	// Validate required environment variables
	if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
		throw new Error(
			'Missing required Supabase environment variables: SUPABASE_URL and SUPABASE_KEY must be set'
		)
	}

	// Get the session from the request cookies
	const headers = new Headers()

	const client = createServerClient(
		process.env.SUPABASE_URL,
		process.env.SUPABASE_KEY,
		{
			auth: { flowType: 'pkce' },
			cookies: {
				async getAll() {
					// Return the session cookie as expected by Supabase, ensuring value is always a string
					return parseCookieHeader(request.headers.get('Cookie') ?? '')
						.filter(({ value }) => typeof value === 'string')
						.map(({ name, value }) => ({
							name,
							value: value as string
						}))
				},
				async setAll(
					cookiesToSet: {
						name: string
						value: string
						options: CookieOptions
					}[]
				) {
					// Update the session with the new JWT if present
					for (const { name, value, options } of cookiesToSet) {
						headers.append(
							'Set-Cookie',
							serializeCookieHeader(name, value, options)
						)
					}
				}
			}
		}
	)

	const context: SupabaseClientContext = { client, headers }
	clientCache.set(request, context)
	if (scope) scope.context = context
	return context
}

/**
 * The `Set-Cookie` values this request's Supabase client has written so far:
 * a refreshed session, a sign-in, a sign-out. Empty when no client was made
 * for the request. `sessionCookieMiddleware` reads it to put them on whatever
 * response the request ends with.
 */
export function pendingSupabaseCookies(request: Request): string[] {
	const context = requestScope.getStore()?.context ?? clientCache.get(request)
	return context?.headers.getSetCookie() ?? []
}

export function createSupabaseAdminClient() {
	if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
		throw new Error(
			'Missing required environment variables: SUPABASE_URL and SUPABASE_SECRET_KEY must be set'
		)
	}

	return createClient(
		process.env.SUPABASE_URL,
		process.env.SUPABASE_SECRET_KEY,
		{
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		}
	)
}
