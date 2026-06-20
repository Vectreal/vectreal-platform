import { getConsent } from './consent-repository.server'
import { type ConsentChoices } from '../../../components/consent/consent-context'
import { getSession as getConsentSession } from '../../sessions/consent-session.server'
import { hasSupabaseAuthCookie } from '../../sessions/supabase-auth-cookie.server'
import { createSupabaseClient } from '../../supabase.server'

export interface ConsentLoaderResult {
	consentState: ConsentChoices | null
	consentVersion: string | null
	/** Headers containing rotated Supabase tokens, if a refresh occurred. */
	supabaseHeaders: Headers | null
}

/**
 * Resolves consent state for the current visitor.
 *
 * Reads `choices` + `version` from the signed consent cookie first (the common
 * path — fast, no DB, survives auth-session expiry). Falls back to a DB lookup
 * only when the cookie has no consent data, in which case it also calls Supabase
 * to get the authenticated userId and captures any rotated auth tokens so they
 * can be forwarded to the browser even on unprotected pages.
 */
export async function resolveConsent(
	request: Request
): Promise<ConsentLoaderResult> {
	const consentSession = await getConsentSession(request.headers.get('Cookie'))
	const sessionChoices = consentSession.get('choices') ?? null
	const sessionVersion = consentSession.get('version') ?? null

	if (sessionChoices && sessionVersion) {
		return {
			consentState: {
				necessary: true,
				functional: sessionChoices.functional,
				analytics: sessionChoices.analytics,
				marketing: sessionChoices.marketing
			},
			consentVersion: sessionVersion,
			supabaseHeaders: null
		}
	}

	// Cookie missing consent — fall back to DB lookup.
	let userId: string | null = null
	let supabaseHeaders: Headers | null = null

	const hasAuthCookie = hasSupabaseAuthCookie(
		request.headers.get('Cookie') ?? ''
	)
	if (hasAuthCookie) {
		const { client, headers } = await createSupabaseClient(request)
		const {
			data: { user }
		} = await client.auth.getUser()
		userId = user?.id ?? null
		supabaseHeaders = headers
	}

	const anonymousId = consentSession.get('anonymousId') ?? null
	const record = await getConsent(userId, anonymousId).catch(() => null)

	return {
		consentState: record
			? {
					necessary: true,
					functional: record.functional,
					analytics: record.analytics,
					marketing: record.marketing
				}
			: null,
		consentVersion: record?.version ?? null,
		supabaseHeaders
	}
}
