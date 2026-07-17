import { data } from 'react-router'

import { Route } from './+types/consent'
import { upsertConsent } from '../../lib/domain/consent/consent-repository.server'
import { ensureSameOriginMutation } from '../../lib/http/csrf.server'
import {
	type ConsentChoices,
	CONSENT_POLICY_VERSION,
	serializeConsentCookieHeader
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

	// Always commit the consent cookie — this is the source of truth for the
	// banner. It is unsigned so it will never be invalidated by a secret rotation.
	const cookieHeader = await serializeConsentCookieHeader({
		version: CONSENT_POLICY_VERSION,
		choices
	})

	// Persist to DB for compliance auditing (best-effort, non-blocking).
	// A failure here must never prevent the cookie from being set.
	try {
		const ipCountry =
			request.headers.get('CF-IPCountry') ||
			request.headers.get('X-Vercel-IP-Country') ||
			null
		const userAgent = request.headers.get('User-Agent')

		const { client } = await createSupabaseClient(request)
		const {
			data: { user }
		} = await client.auth.getUser()

		// Only persist DB record for authenticated users. Anonymous visitors are
		// covered by the cookie alone; the DB record is purely for compliance.
		if (user?.id) {
			await upsertConsent({
				userId: user.id,
				anonymousId: null,
				choices,
				version: CONSENT_POLICY_VERSION,
				ipCountry,
				userAgent
			})
		}
	} catch (err) {
		console.error('[consent] DB persist failed (non-fatal):', err)
	}

	return data(
		{
			necessary: true,
			functional: choices.functional,
			analytics: choices.analytics,
			marketing: choices.marketing,
			version: CONSENT_POLICY_VERSION
		},
		{
			headers: { 'Set-Cookie': cookieHeader }
		}
	)
}
