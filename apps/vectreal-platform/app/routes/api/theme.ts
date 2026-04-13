import { data } from 'react-router'

import { ensureSameOriginMutation } from '../../lib/http/csrf.server'
import {
	commitSession,
	getSession,
	type ThemeMode
} from '../../lib/sessions/theme-session.server'

import type { Route } from './+types/theme'

function parseThemeMode(value: FormDataEntryValue | null): ThemeMode | null {
	if (value === 'light' || value === 'dark' || value === 'system') {
		return value
	}

	return null
}

export async function action({ request }: Route.ActionArgs) {
	const originCheck = ensureSameOriginMutation(request)
	if (originCheck) {
		return originCheck
	}

	const formData = await request.formData()
	const themeMode = parseThemeMode(formData.get('themeMode'))

	if (!themeMode) {
		return data({ error: 'Invalid theme mode' }, { status: 400 })
	}

	const themeSession = await getSession(request.headers.get('Cookie'))
	themeSession.set('themeMode', themeMode)

	return data(
		{ themeMode },
		{ headers: { 'Set-Cookie': await commitSession(themeSession) } }
	)
}
