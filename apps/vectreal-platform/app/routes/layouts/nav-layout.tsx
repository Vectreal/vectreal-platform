import { data, Outlet, redirect } from 'react-router'

import { Route } from './+types/nav-layout'
import { Footer } from '../../components/footer'
import { Navigation } from '../../components/navigation'
import { useAuthResumeRevalidation } from '../../hooks/use-auth-resume-revalidation'
import { isCacheablePublicPath } from '../../lib/http/cacheable-public-paths.server'
import { hasSupabaseAuthCookie } from '../../lib/sessions/supabase-auth-cookie.server'
import { createSupabaseClient } from '../../lib/supabase.server'
import { isMobileRequest } from '../../lib/utils/is-mobile-request'

const PUBLIC_CACHE_CONTROL =
	'public, max-age=0, s-maxage=300, stale-while-revalidate=600'

function isPublicCacheCandidate(request: Request): boolean {
	if (request.method !== 'GET') {
		return false
	}

	if (request.headers.has('authorization')) {
		return false
	}

	const url = new URL(request.url)
	if (url.search.length > 0) {
		return false
	}

	return isCacheablePublicPath(url.pathname)
}

function withPublicCacheHeaders(initialHeaders?: Headers): Headers {
	const headers = new Headers(initialHeaders)
	headers.set('Cache-Control', PUBLIC_CACHE_CONTROL)
	headers.set('Vary', 'Accept-Encoding')
	return headers
}

export async function loader({ request }: Route.LoaderArgs) {
	/**
	 * Determine if the request comes from a mobile client by the headers in the request
	 */
	const defaultResponse = {
		isMobile: isMobileRequest(request),
		user: null
	}
	const cookieHeader = request.headers.get('Cookie') ?? ''
	const hasAuthCookie = hasSupabaseAuthCookie(cookieHeader)
	const canUsePublicCache = !hasAuthCookie && isPublicCacheCandidate(request)

	if (!hasAuthCookie) {
		return canUsePublicCache
			? data(defaultResponse, { headers: withPublicCacheHeaders() })
			: data(defaultResponse)
	}

	try {
		const { client, headers } = await createSupabaseClient(request)

		const {
			data: { user },
			error: userError
		} = await client.auth.getUser()

		if (!user) {
			return data(defaultResponse, { headers })
		}

		// Stale refresh token – clear the cookie so the browser doesn't keep
		// sending it, then fall through as unauthenticated (no error log needed).
		if (userError?.code === 'refresh_token_not_found') {
			try {
				await client.auth.signOut({ scope: 'local' })
			} catch {
				// Ignore cleanup errors
			}
			return data(defaultResponse, { headers })
		}

		// Create a new URL object to parse the request URL
		const url = new URL(request.url)
		const isRootPage = url.pathname === '/'

		// If the user is authenticated and trying to access the root page, redirect to the dashboard
		// This makes the dashboard the landing page for authenticated users
		if (user && isRootPage) {
			return redirect('/dashboard', { headers })
		} else {
			return data({ user, isMobile: isMobileRequest(request) }, { headers })
		}
	} catch (error) {
		console.error('Error during loader authentication check:', error)
	}

	return data(defaultResponse)
}
const Layout = ({ loaderData }: Route.ComponentProps) => {
	useAuthResumeRevalidation({ enabled: Boolean(loaderData.user) })

	return (
		<>
			<Navigation user={loaderData.user} isMobile={loaderData.isMobile} />
			<Outlet />
			<Footer />
		</>
	)
}

export default Layout
