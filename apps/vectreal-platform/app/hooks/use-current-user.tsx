import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useFetcher } from 'react-router'

import { useOnResume } from './use-on-resume'

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
 * nav renders signed-out on first paint and this provider fetches the real
 * session from `/auth/session` (always `no-store`) after mount. It also
 * re-fetches when the tab regains focus so sign-in/out in another tab is picked
 * up without a full reload.
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
	const fetcher = useFetcher<{ user: User | null }>()

	// Initial hydration after mount (runs once).
	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data === undefined) {
			fetcher.load(SESSION_ENDPOINT)
		}
	}, [fetcher])

	useOnResume(() => {
		if (fetcher.state === 'idle') {
			fetcher.load(SESSION_ENDPOINT)
		}
	})

	const value: CurrentUserContextValue = {
		user: fetcher.data?.user ?? null,
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
