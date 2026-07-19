import {
	createContext,
	useContext,
	useEffect,
	useRef,
	type ReactNode
} from 'react'
import { useFetcher, useLocation } from 'react-router'

import { useOnResume } from './use-on-resume'
import { hasClientSupabaseAuthCookie } from '../lib/sessions/supabase-auth-cookie'

import type { User } from '@supabase/supabase-js'

interface CurrentUserContextValue {
	/** The resolved user, or null when signed out / not yet loaded. */
	user: User | null
	/** True once the session endpoint has responded at least once. */
	ready: boolean
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null)

const SESSION_ENDPOINT = '/auth/session'

/**
 * Client-hydrated current user for public (CDN-cacheable) pages.
 *
 * Public HTML is cached anonymously and cannot carry per-visitor auth, so the
 * nav renders signed-out on first paint and this provider resolves the real
 * session from `/auth/session` (always no-store). The fetch is gated on the
 * presence of the Supabase auth cookie, so anonymous visitors (the audience the
 * cache serves) never make the request. It resolves on mount, on every route
 * change (to reflect sign-in/out navigations), and when the tab regains focus.
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
	const fetcher = useFetcher<{ user: User | null }>()
	const { pathname } = useLocation()
	const user = fetcher.data?.user ?? null

	// Consult the server when an auth cookie exists, or when we still hold a user
	// that may need clearing (e.g. just signed out, cookie already removed).
	const loadSession = () => {
		if (fetcher.state !== 'idle') return
		if (!hasClientSupabaseAuthCookie() && !user) return
		fetcher.load(SESSION_ENDPOINT)
	}
	const loadSessionRef = useRef(loadSession)
	loadSessionRef.current = loadSession

	useEffect(() => {
		loadSessionRef.current()
	}, [pathname])

	useOnResume(() => loadSessionRef.current())

	const value: CurrentUserContextValue = {
		user,
		ready: fetcher.data !== undefined
	}

	return (
		<CurrentUserContext.Provider value={value}>
			{children}
		</CurrentUserContext.Provider>
	)
}

export function useCurrentUser(): CurrentUserContextValue {
	const ctx = useContext(CurrentUserContext)
	if (!ctx) {
		throw new Error('useCurrentUser must be used inside CurrentUserProvider')
	}
	return ctx
}
