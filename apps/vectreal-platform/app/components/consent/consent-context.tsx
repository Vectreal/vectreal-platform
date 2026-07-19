import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode
} from 'react'
import { useFetcher, useLocation } from 'react-router'

import {
	CONSENT_POLICY_VERSION,
	type ConsentChoices,
	readConsentCookie
} from '../../lib/consent/consent-cookie'

export type { ConsentChoices }

interface ConsentContextValue {
	/** Current resolved consent state. null = not yet answered (banner should show). */
	consent: ConsentChoices | null
	/** Policy version of the stored consent, null if none. */
	consentVersion: string | null
	/** Save a new consent choice for the user. */
	saveConsent: (choices: Omit<ConsentChoices, 'necessary'>) => void
	/** Whether the preferences dialog is open. */
	preferencesOpen: boolean
	setPreferencesOpen: (open: boolean) => void
	/**
	 * True once consent has been read from the cookie on the client. Until then
	 * the banner stays hidden so server and first client render agree (the HTML
	 * is CDN-cached and cannot carry per-visitor consent).
	 */
	hydrated: boolean
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

interface ConsentProviderProps {
	children: ReactNode
}

export function ConsentProvider({ children }: ConsentProviderProps) {
	const fetcher = useFetcher()
	const [consent, setConsent] = useState<ConsentChoices | null>(null)
	const [consentVersion, setConsentVersion] = useState<string | null>(null)
	const [hydrated, setHydrated] = useState(false)
	const [preferencesOpen, setPreferencesOpen] = useState(false)
	const optimisticPreviousRef = useRef<{
		consent: ConsentChoices | null
		consentVersion: string | null
	} | null>(null)

	// Hydrate consent from the client-readable cookie after mount. This is the
	// single source of truth for banner visibility and is immune to CDN caching
	// of the server-rendered HTML.
	useEffect(() => {
		const stored = readConsentCookie()
		if (stored) {
			setConsent(stored.choices)
			setConsentVersion(stored.version)
		}
		setHydrated(true)
	}, [])

	// On error response from the action, roll back the optimistic update.
	useEffect(() => {
		if (
			fetcher.state === 'idle' &&
			fetcher.data &&
			typeof fetcher.data === 'object'
		) {
			const d = fetcher.data as Record<string, unknown>
			if (typeof d.error === 'string') {
				// Restore pre-submit values from before the optimistic update.
				setConsent(optimisticPreviousRef.current?.consent ?? null)
				setConsentVersion(optimisticPreviousRef.current?.consentVersion ?? null)
			}
			optimisticPreviousRef.current = null
		}
	}, [fetcher.state, fetcher.data])

	// Sync PostHog persistence and opt-in/out whenever analytics consent changes.
	// null = first visit, no decision yet - stay in memory mode (DSGVO-safe).
	// accepted → switch to localStorage+cookie persistence so the session
	//   persists across pages, then opt in.
	// rejected → stay in memory mode and opt out.
	useEffect(() => {
		if (typeof window === 'undefined') return
		// posthog-js is loaded globally via PostHogProvider in entry.client
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ph = (window as any).posthog
		if (!ph) return
		if (consent === null) return
		if (consent.analytics) {
			ph.set_config({ persistence: 'localStorage+cookie' })
			ph.opt_in_capturing()
		} else {
			ph.set_config({ persistence: 'memory' })
			ph.opt_out_capturing()
		}
	}, [consent?.analytics, consent])

	const saveConsent = useCallback(
		(choices: Omit<ConsentChoices, 'necessary'>) => {
			// Fire before switching persistence so the event is always captured
			// in memory mode - no cookies required, DSGVO-safe.
			if (typeof window !== 'undefined') {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const ph = (window as any).posthog
				if (ph) {
					ph.capture(
						choices.analytics
							? 'cookie_consent_accepted'
							: 'cookie_consent_rejected',
						{
							functional: choices.functional,
							marketing: choices.marketing
						}
					)
				}
			}

			// Optimistic update — hides the banner immediately without waiting for
			// the server round-trip. Rolled back on error response above.
			optimisticPreviousRef.current = { consent, consentVersion }
			setConsent({
				necessary: true,
				functional: choices.functional,
				analytics: choices.analytics,
				marketing: choices.marketing
			})
			setConsentVersion(CONSENT_POLICY_VERSION)

			fetcher.submit(
				{ ...choices, necessary: true },
				{
					method: 'post',
					action: '/api/consent',
					encType: 'application/json'
				}
			)
		},
		[fetcher, consent, consentVersion]
	)

	return (
		<ConsentContext.Provider
			value={{
				consent,
				consentVersion,
				saveConsent,
				preferencesOpen,
				setPreferencesOpen,
				hydrated
			}}
		>
			{children}
		</ConsentContext.Provider>
	)
}

export function useConsent(): ConsentContextValue {
	const ctx = useContext(ConsentContext)
	if (!ctx) throw new Error('useConsent must be used inside ConsentProvider')
	return ctx
}

/** Returns true when the consent banner should be displayed. */
export function useNeedsBanner(policyVersion: string): boolean {
	const { consent, consentVersion, hydrated } = useConsent()
	const { pathname } = useLocation()

	// Stay hidden until the cookie has been read on the client so SSR and the
	// first client render agree (no hydration mismatch, no flash for consenters).
	if (!hydrated) return false

	// Don't show banner on the privacy policy page, to avoid confusion
	if (pathname === '/privacy-policy') return false

	// Don't show the banner on the preview pages. Consent managemnent must be done on the embedding site.
	if (pathname.startsWith('/preview/')) return false

	return consent === null || consentVersion !== policyVersion
}
