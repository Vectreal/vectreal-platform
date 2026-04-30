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

import { CONSENT_POLICY_VERSION } from '../../lib/consent/consent-policy'

export interface ConsentChoices {
	necessary: true
	functional: boolean
	analytics: boolean
	marketing: boolean
}

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
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

interface ConsentProviderProps {
	children: ReactNode
	/**
	 * Server-resolved initial consent state (from root loader).
	 * Pass null when no record exists yet.
	 */
	initialConsent: ConsentChoices | null
	initialVersion: string | null
}

export function ConsentProvider({
	children,
	initialConsent,
	initialVersion
}: ConsentProviderProps) {
	const fetcher = useFetcher()
	const [consent, setConsent] = useState<ConsentChoices | null>(initialConsent)
	const [consentVersion, setConsentVersion] = useState<string | null>(
		initialVersion
	)
	const [preferencesOpen, setPreferencesOpen] = useState(false)
	const optimisticPreviousRef = useRef<{
		consent: ConsentChoices | null
		version: string | null
	} | null>(null)

	// When the fetcher returns new data after saving, update local state
	useEffect(() => {
		if (
			fetcher.state === 'idle' &&
			fetcher.data &&
			typeof fetcher.data === 'object'
		) {
			const d = fetcher.data as Record<string, unknown>
			if (typeof d.analytics === 'boolean') {
				setConsent({
					necessary: true,
					functional: Boolean(d.functional),
					analytics: Boolean(d.analytics),
					marketing: Boolean(d.marketing)
				})
				if (typeof d.version === 'string') {
					setConsentVersion(d.version)
				}
				optimisticPreviousRef.current = null
			} else if (typeof d.error === 'string' && optimisticPreviousRef.current) {
				setConsent(optimisticPreviousRef.current.consent)
				setConsentVersion(optimisticPreviousRef.current.version)
				optimisticPreviousRef.current = null
			}
		}
	}, [fetcher.state, fetcher.data])

	// Sync PostHog persistence and opt-in/out whenever analytics consent changes.
	// null = first visit, no decision yet — stay in memory mode (DSGVO-safe).
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
			// in memory mode — no cookies required, DSGVO-safe.
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

			optimisticPreviousRef.current = {
				consent,
				version: consentVersion
			}

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
		[consent, consentVersion, fetcher]
	)

	return (
		<ConsentContext.Provider
			value={{
				consent,
				consentVersion,
				saveConsent,
				preferencesOpen,
				setPreferencesOpen
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
	const { consent, consentVersion } = useConsent()
	const { pathname } = useLocation()

	// Don't show banner on the privacy policy page, to avoid confusion
	if (pathname === '/privacy-policy') return false

	// Don't show the banner on the preview pages. Consent managemnent must be done on the embedding site.
	if (pathname.startsWith('/preview/')) return false

	return consent === null || consentVersion !== policyVersion
}
