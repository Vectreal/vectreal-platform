import { data } from 'react-router'

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
