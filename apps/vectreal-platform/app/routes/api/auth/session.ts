import { data } from 'react-router'

import { Route } from './+types/session'
import { resolveOptionalUser } from '../../../lib/domain/auth/auth-loader.server'

/**
 * Client-hydration endpoint for the current user.
 *
 * Public pages are CDN-cached anonymously and therefore cannot carry per-visitor
 * auth state in their HTML. The nav fetches this endpoint after mount to resolve
 * the real session. Always `no-store` so the edge never caches one visitor's
 * user for another.
 */
export async function loader({ request }: Route.LoaderArgs) {
	const { user, headers } = await resolveOptionalUser(request)
	headers.set('Cache-Control', 'no-store')
	return data({ user }, { headers })
}
