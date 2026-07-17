import { type ConsentChoices } from '../../../components/consent/consent-context'
import { getConsentFromCookieHeader } from '../../sessions/consent-session.server'

export interface ConsentLoaderResult {
	consentState: ConsentChoices | null
	consentVersion: string | null
}

/**
 * Resolves consent state for the current visitor purely from the consent cookie.
 *
 * The cookie is the authoritative source of truth for banner visibility.
 * It is an unsigned persistent cookie (1-year maxAge) that survives app
 * deployments and secret rotations without losing user consent.
 *
 * DB persistence is handled asynchronously in the /api/consent action
 * for compliance auditing only — it plays no part in the read path.
 */
export async function resolveConsent(
	request: Request
): Promise<ConsentLoaderResult> {
	const data = await getConsentFromCookieHeader(request.headers.get('Cookie'))
	if (!data) return { consentState: null, consentVersion: null }

	return {
		consentState: data.choices,
		consentVersion: data.version
	}
}
