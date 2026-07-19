import { redirect } from 'react-router'

import { getAuthUser } from '../../http/auth.server'
import { hasSupabaseAuthCookie } from '../../sessions/supabase-auth-cookie.server'
import { createSupabaseClient } from '../../supabase.server'
import {
	initializeUserDefaults,
	type UserWithDefaults
} from '../user/user-repository.server'

import type { User } from '@supabase/supabase-js'

export interface OptionalUserResult {
	user: User | null
	headers: Headers
}

/**
 * Resolve the current user without redirecting — the read path for the
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
		return { user: null, headers: new Headers() }
	}

	const { client, headers } = await createSupabaseClient(request)
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
		return { user: null, headers }
	}

	return { user: user ?? null, headers }
}

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
			const { client, headers: signOutHeaders } =
				await createSupabaseClient(request)
			try {
				await client.auth.signOut({ scope: 'local' })
			} catch (signOutError) {
				console.warn(
					'Failed to clear local auth session after email conflict; redirecting to sign-in anyway.',
					{ error: signOutError }
				)
			}

			const redirectHeaders = new Headers(headers as HeadersInit)
			signOutHeaders.forEach((value, key) => {
				if (key.toLowerCase() === 'set-cookie') {
					redirectHeaders.append(key, value)
					return
				}

				redirectHeaders.set(key, value)
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
