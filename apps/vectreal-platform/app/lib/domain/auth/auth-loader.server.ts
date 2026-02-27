import { redirect } from 'react-router'

import { getAuthUser } from '../../http/auth.server'
import {
	initializeUserDefaults,
	type UserWithDefaults
} from '../user/user-repository.server'

import type { User } from '@supabase/supabase-js'

export interface AuthLoaderResult {
	user: User
	userWithDefaults: UserWithDefaults
}

export interface AuthSessionResult {
	user: User
	headers: HeadersInit
}

export async function loadAuthenticatedSession(
	request: Request
): Promise<AuthSessionResult> {
	const authResponse = await getAuthUser(request)

	if (authResponse instanceof Response) {
		throw redirect('/sign-up', { headers: authResponse.headers })
	}

	return {
		user: authResponse.user,
		headers: authResponse.headers ?? {}
	}
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
	const { user } = await loadAuthenticatedSession(request)

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
