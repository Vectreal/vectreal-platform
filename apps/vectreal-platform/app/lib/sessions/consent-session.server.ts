import { createCookieSessionStorage } from 'react-router'

import { CONSENT_POLICY_VERSION } from '../consent/consent-policy'

export { CONSENT_POLICY_VERSION }

export const CONSENT_COOKIE_NAME = 'consent_anon'

export interface ConsentChoices {
	necessary: true
	functional: boolean
	analytics: boolean
	marketing: boolean
}

export interface ConsentSessionData {
	anonymousId?: string
	version?: string
	choices?: ConsentChoices
}

const sessionSecret = process.env.CSRF_SECRET ?? process.env.SESSION_SECRET
if (!sessionSecret && process.env.NODE_ENV === 'production') {
	throw new Error('Consent cookie session secret is required in production')
}

const resolvedSecret = sessionSecret || 'dev-only-consent-session-secret'

const { getSession, commitSession, destroySession } =
	createCookieSessionStorage<ConsentSessionData>({
		cookie: {
			name: CONSENT_COOKIE_NAME,
			httpOnly: true,
			maxAge: 60 * 60 * 24 * 365, // 1 year
			path: '/',
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			secrets: [resolvedSecret]
		}
	})

export { getSession, commitSession, destroySession }
