import { parseGrantedScopes, type AgentScope } from './agent-scopes'

export type ConsentDecision =
	| { intent: 'deny' }
	| { intent: 'approve'; organizationId: string; scopes: AgentScope[] }

export type ConsentFormResult =
	{ ok: true; decision: ConsentDecision } | { ok: false; error: string }

/**
 * Reads the consent page's form. Kept out of the route so it can be tested
 * without a database: the route module opens one at import.
 *
 * The OAuth client is deliberately not read from the form. The action asks
 * Supabase which client the authorization belongs to, so a grant can only
 * ever be recorded for the client the user actually saw.
 */
export function parseConsentForm(formData: FormData): ConsentFormResult {
	const intent = formData.get('intent')

	if (intent === 'deny') {
		return { ok: true, decision: { intent: 'deny' } }
	}

	if (intent !== 'approve') {
		return { ok: false, error: 'Choose whether to allow access.' }
	}

	const organizationId = formData.get('organizationId')
	if (typeof organizationId !== 'string' || organizationId.trim() === '') {
		return { ok: false, error: 'Choose an organization.' }
	}

	const submitted = formData
		.getAll('scope')
		.filter((value): value is string => typeof value === 'string')
	const scopes = parseGrantedScopes(submitted)
	if (!scopes) {
		return { ok: false, error: 'The permissions on this form are not valid.' }
	}

	return {
		ok: true,
		decision: {
			intent: 'approve',
			organizationId: organizationId.trim(),
			scopes
		}
	}
}

/**
 * The organization the consent page starts on: the one the client was granted
 * before, then the user's current one, then their first. A previous choice
 * the user is no longer a member of is skipped, or the page would preselect
 * an organization the server refuses, and with a single membership there is
 * no picker to correct it.
 */
export function chooseConsentOrganization(
	memberOrganizationIds: readonly string[],
	previous: string | null,
	current: string
): string {
	const isMember = (id: string | null): id is string =>
		id !== null && memberOrganizationIds.includes(id)

	if (isMember(previous)) return previous
	if (isMember(current)) return current
	return memberOrganizationIds[0] ?? current
}

/**
 * The OAuth clients whose Supabase consent must be withdrawn before a
 * consent page is read: those the user approved in Supabase but that have no
 * valid Vectreal grant, either none at all or one in an organization the user
 * has left.
 *
 * Supabase approves a client it already holds consent for without showing
 * this page, so a consent outliving its grant (an organization deleted, a
 * membership removed) would hand the client a token the agent API refuses,
 * with no page on which to choose again. Withdrawing it makes Supabase ask.
 */
export function consentsWithoutValidGrant(input: {
	consentedClientIds: readonly string[]
	grants: ReadonlyArray<{ oauthClientId: string; organizationId: string }>
	memberOrganizationIds: readonly string[]
}): string[] {
	const validClients = new Set(
		input.grants
			.filter(({ organizationId }) =>
				input.memberOrganizationIds.includes(organizationId)
			)
			.map(({ oauthClientId }) => oauthClientId)
	)
	return input.consentedClientIds.filter((id) => !validClients.has(id))
}

/**
 * The consent page's document headers. A consent screen must never be framed:
 * another site could overlay it and have the user click "Allow" for a client
 * it started a sign-in for.
 *
 * The action's cookies are carried too. When a route exports `headers`, React
 * Router builds a non-redirect action response from it, so a session the
 * action refreshed would otherwise lose its rotated refresh token on a 400,
 * and the browser would be signed out once the old one expires.
 */
export function consentDocumentHeaders(input: {
	loaderHeaders: Headers
	actionHeaders: Headers
}): Headers {
	const headers = new Headers(input.loaderHeaders)
	for (const cookie of input.actionHeaders.getSetCookie()) {
		headers.append('Set-Cookie', cookie)
	}
	headers.set('Content-Security-Policy', "frame-ancestors 'none'")
	headers.set('X-Frame-Options', 'DENY')
	return headers
}

/** Where approval sends the browser, as the page should name it. */
export function describeRedirectTarget(redirectUri: string): string {
	try {
		return new URL(redirectUri).host
	} catch {
		return redirectUri
	}
}
