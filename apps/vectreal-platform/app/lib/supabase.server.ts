import {
	createServerClient,
	parseCookieHeader,
	serializeCookieHeader,
	type CookieOptions
} from '@supabase/ssr'

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
 * each try to exchange the same expired refresh token simultaneously —
 * only the first would succeed after Supabase rotates the token, causing
 * all others to receive `refresh_token_not_found`.
 */
const clientCache = new WeakMap<Request, SupabaseClientContext>()

export async function createSupabaseClient(request: Request) {
	const cached = clientCache.get(request)
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
	return context
}
