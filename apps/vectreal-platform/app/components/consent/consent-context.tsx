import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode
} from 'react'
import { useFetcher } from 'react-router'

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

	// Sync PostHog opt-in/opt-out whenever analytics consent changes.
	// When consent is null (no decision yet) we leave PostHog in its default
	// opted-in state so events flow and the PostHog dashboard can verify
	// the SDK installation. Once the user makes a choice, we apply it.
	useEffect(() => {
		if (typeof window === 'undefined') return
		// posthog-js is loaded globally via PostHogProvider in entry.client
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ph = (window as any).posthog
		if (!ph) return
		// null means first visit — no stored decision yet, leave opted-in
		if (consent === null) return
		if (consent.analytics) {
			ph.opt_in_capturing()
		} else {
			ph.opt_out_capturing()
		}
	}, [consent?.analytics, consent])

	const saveConsent = useCallback(
		(choices: Omit<ConsentChoices, 'necessary'>) => {
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
	return consent === null || consentVersion !== policyVersion
}
