import { data } from 'react-router'

import { hasFunctionalConsent } from '../../lib/consent/consent-cookie'
import { ensureSameOriginMutation } from '../../lib/http/csrf.server'
import { buildThemeSetCookie, isThemeMode } from '../../lib/theme/theme-cookie'

import type { Route } from './+types/theme'

export async function action({ request }: Route.ActionArgs) {
	const originCheck = ensureSameOriginMutation(request)
	if (originCheck) {
		return originCheck
	}

	const formData = await request.formData()
	const themeMode = formData.get('themeMode')

	if (!isThemeMode(themeMode)) {
		return data({ error: 'Invalid theme mode' }, { status: 400 })
	}

	// The theme cookie is a Functional-category preference. Without that consent
	// the toggle still works for the session (the client applies the class
	// immediately), it just is not remembered across reloads.
	if (!hasFunctionalConsent(request)) {
		return data({ themeMode }, { headers: { 'Cache-Control': 'no-store' } })
	}

	return data(
		{ themeMode },
		{
			headers: {
				'Set-Cookie': buildThemeSetCookie(themeMode),
				'Cache-Control': 'no-store'
			}
		}
	)
}
