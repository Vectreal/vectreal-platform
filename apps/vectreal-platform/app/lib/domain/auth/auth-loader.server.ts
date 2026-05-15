import { redirect } from 'react-router'

import { getAuthUser } from '../../http/auth.server'
import { createSupabaseClient } from '../../supabase.server'
import {
	initializeUserDefaults,
	type UserWithDefaults
} from '../user/user-repository.server'

import type { User } from '@supabase/supabase-js'

export interface AuthLoaderResult {
	user: User
	userWithDefaults: UserWithDefaults
	headers: HeadersInit
}

export interface AuthSessionResult {
	user: User
	headers: HeadersInit
}

function getSignUpRedirectPath(request: Request): string {
	const requestUrl = new URL(request.url)
	const next = `${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}`
	return `/sign-up?next=${encodeURIComponent(next)}`
}

export async function loadAuthenticatedSession(
	request: Request
): Promise<AuthSessionResult> {
	const authResponse = await getAuthUser(request)

	if (authResponse instanceof Response) {
		throw redirect(getSignUpRedirectPath(request), {
			headers: authResponse.headers
		})
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
	const { user, headers } = await loadAuthenticatedSession(request)

	try {
		// Initialize user defaults (creates user in local DB, default org, and project)
		const userWithDefaults = await initializeUserDefaults(user)

		return {
			user,
			userWithDefaults,
			headers
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error('Failed to initialize user:', error)

		if (message.startsWith('email_conflict:')) {
			const { client, headers: signOutHeaders } = await createSupabaseClient(request)
			try {
				await client.auth.signOut({ scope: 'local' })
			} catch (signOutError) {
				console.warn('Failed to clear local auth session after email conflict:', {
					error: signOutError
				})
			}

			const redirectHeaders = new Headers(headers as HeadersInit)
			new Headers(signOutHeaders).forEach((value, key) => {
				redirectHeaders.append(key, value)
			})

			throw redirect('/sign-in?error=email_conflict', {
				headers: redirectHeaders
			})
		}

		throw new Response(`Failed to initialize user data: ${message}`, {
			status: 500
		})
	}
}
