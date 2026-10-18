import { redirect } from 'react-router'

import { getAuthUser } from '../../http/auth.server'
import { reportServerError } from '../../observability/report-server-error.server'
import { hasSupabaseAuthCookie } from '../../sessions/supabase-auth-cookie'
import { createSupabaseClient } from '../../supabase.server'
import {
	initializeUserDefaults,
	type UserWithDefaults
} from '../user/user-repository.server'

import type { User } from '@supabase/supabase-js'

export interface OptionalUserResult {
	user: User | null
}

/**
 * Resolve the current user without redirecting: the read path for the
 * client-hydrated session endpoint used by public (CDN-cacheable) pages.
 *
 * Skips the Supabase round-trip entirely when no auth cookie is present, and
 * clears a stale refresh token so the browser stops resending it.
 */
export async function resolveOptionalUser(
	request: Request
): Promise<OptionalUserResult> {
	const cookieHeader = request.headers.get('Cookie')
	if (!hasSupabaseAuthCookie(cookieHeader)) {
		return { user: null }
	}

	const { client } = await createSupabaseClient(request)
	const {
		data: { user },
		error
	} = await client.auth.getUser()

	if (error?.code === 'refresh_token_not_found') {
		try {
			await client.auth.signOut({ scope: 'local' })
		} catch {
			// Ignore cleanup errors and continue as unauthenticated.
		}
		return { user: null }
	}

	return { user: user ?? null }
}

export interface AuthLoaderResult {
	user: User
	userWithDefaults: UserWithDefaults
}

export interface AuthSessionResult {
	user: User
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
		throw redirect(getSignUpRedirectPath(request))
	}

	return { user: authResponse.user }
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

		return { user, userWithDefaults }
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		reportServerError(error, { request })

		if (message.startsWith('email_conflict:')) {
			const { client } = await createSupabaseClient(request)
			try {
				await client.auth.signOut({ scope: 'local' })
			} catch (signOutError) {
				console.warn(
					'Failed to clear local auth session after email conflict; redirecting to sign-in anyway.',
					{ error: signOutError }
				)
			}

			// The sign-out's cookie deletions reach the browser through
			// `sessionCookieMiddleware`, which carries them on this redirect too.
			throw redirect('/sign-in?error=email_conflict')
		}

		throw new Response(`Failed to initialize user data: ${message}`, {
			status: 500
		})
	}
}
