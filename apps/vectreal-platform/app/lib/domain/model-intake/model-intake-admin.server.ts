import { canOpenIntakeAdmin } from './model-intake-admin-gate'
import { getPosthogClient } from '../../posthog/posthog-client.server'
import { loadAuthenticatedUser } from '../auth/auth-loader.server'

import type { User } from '@supabase/supabase-js'

/**
 * Whether `user` may open `/dashboard/intake`: the one answer the route
 * enforces and the dashboard navigation shows a link for.
 */
export function isIntakeAdmin(user: User): Promise<boolean> {
	return canOpenIntakeAdmin({
		flags: getPosthogClient(),
		userId: user.id,
		email: user.email,
		isDevBuild: import.meta.env.DEV === true
	})
}

/**
 * Signs the caller in and refuses anyone the flag does not let in, as a 404,
 * so the page's existence is not confirmed. Loader and action both call it.
 */
export async function requireIntakeAdmin(request: Request) {
	const { user } = await loadAuthenticatedUser(request)
	if (!(await isIntakeAdmin(user))) {
		throw new Response('Not found', { status: 404 })
	}
	return user
}
