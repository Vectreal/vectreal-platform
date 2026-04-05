import { data } from 'react-router'

import { Route } from './+types/consent'
import { upsertConsent } from '../../lib/domain/consent/consent-repository.server'
import { ensureSameOriginMutation } from '../../lib/http/csrf.server'
import {
	type ConsentChoices,
	CONSENT_POLICY_VERSION,
	commitSession,
	getSession
} from '../../lib/sessions/consent-session.server'
import { createSupabaseClient } from '../../lib/supabase.server'

function parseChoices(body: unknown): ConsentChoices | null {
	if (!body || typeof body !== 'object') return null
	const b = body as Record<string, unknown>
	if (
		typeof b.functional !== 'boolean' ||
		typeof b.analytics !== 'boolean' ||
		typeof b.marketing !== 'boolean'
	) {
		return null
	}
	return {
		necessary: true,
		functional: b.functional,
		analytics: b.analytics,
		marketing: b.marketing
	}
}

export async function action({ request }: Route.ActionArgs) {
	const originCheck = ensureSameOriginMutation(request)
	if (originCheck) return originCheck

	const body = await request.json().catch(() => null)
	const choices = parseChoices(body)

	if (!choices) {
		return data({ error: 'Invalid consent payload' }, { status: 400 })
	}

	const ipCountry =
		request.headers.get('CF-IPCountry') ||
		request.headers.get('X-Vercel-IP-Country') ||
		null
	const userAgent = request.headers.get('User-Agent')

	const { client } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()

	const consentSession = await getSession(request.headers.get('Cookie'))
	const anonymousId = consentSession.get('anonymousId') ?? null

	const saved = await upsertConsent({
		userId: user?.id ?? null,
		anonymousId,
		choices,
		version: CONSENT_POLICY_VERSION,
		ipCountry,
		userAgent
	})

	// Persist anonymous ID in cookie so future visits can find the record
	if (!user) {
		consentSession.set('anonymousId', saved.anonymousId ?? '')
	}

	consentSession.set('version', CONSENT_POLICY_VERSION)
	consentSession.set('choices', choices)

	const cookieHeader = await commitSession(consentSession)

	return data(
		{
			necessary: true,
			functional: saved.functional,
			analytics: saved.analytics,
			marketing: saved.marketing,
			version: saved.version
		},
		{
			headers: { 'Set-Cookie': cookieHeader }
		}
	)
}
