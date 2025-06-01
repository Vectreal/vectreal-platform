import {
	createServerClient,
	parseCookieHeader,
	serializeCookieHeader
} from '@supabase/ssr'

export async function createClient(request: Request) {
	// Get the session from the request cookies
	const headers = new Headers()

	const client = createServerClient(
		process.env.SUPABASE_URL || '',
		process.env.SUPABASE_KEY || '',
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
				async setAll(cookiesToSet) {
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

	return { client, headers }
}
