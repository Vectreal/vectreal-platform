import type { User } from '@supabase/supabase-js'
import { redirect } from 'react-router'

import { getAuthUser } from '../../http/auth.server'
import {
	initializeUserDefaults,
	type UserWithDefaults
} from '../user/user-repository.server'

export interface AuthLoaderResult {
	user: User
	userWithDefaults: UserWithDefaults
}

/**
 * Shared loader for authentication and user initialization.
 * Handles auth check, redirects if unauthorized, and initializes user defaults.
 *
 * @param request - The incoming request
 * @returns User and userWithDefaults
 * @throws Redirects to /sign-up if not authenticated
 */
export async function loadAuthenticatedUser(
	request: Request
): Promise<AuthLoaderResult> {
	const authResponse = await getAuthUser(request)

	// Redirect to sign-up if not authenticated
	if (authResponse instanceof Response) {
		throw redirect('/sign-up', { headers: authResponse.headers })
	}

	const { user } = authResponse

	try {
		// Initialize user defaults (creates user in local DB, default org, and project)
		const userWithDefaults = await initializeUserDefaults(user)

		return {
			user,
			userWithDefaults
		}
	} catch (error) {
		console.error('Failed to initialize user:', error)
		throw new Response('Failed to initialize user data', { status: 500 })
	}
}
