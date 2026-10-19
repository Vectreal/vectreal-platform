import { canOpenIntakeAdmin } from './model-intake-admin-gate'
import { getPosthogClient } from '../../posthog/posthog-client.server'
import { loadAuthenticatedUser } from '../auth/auth-loader.server'

/**
 * Signs the caller in and refuses anyone the flag does not let in, as a 404,
 * so the page's existence is not confirmed. Loader and action both call it.
 */
export async function requireIntakeAdmin(request: Request) {
	const { user } = await loadAuthenticatedUser(request)
	const allowed = await canOpenIntakeAdmin({
		flags: getPosthogClient(),
		userId: user.id,
		email: user.email,
		isDevBuild: import.meta.env.DEV === true
	})
	if (!allowed) {
		throw new Response('Not found', { status: 404 })
	}
	return user
}
