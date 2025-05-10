import { ApiResponse } from '@vctrl-ui/utils'

import {
	commitSession,
	getSession
} from '../../lib/sessions/theme-session.server'

import type { Route } from './+types/update-theme'

export async function action({ request }: Route.ActionArgs) {
	try {
		const formData = await request.formData()
		const themeMode = formData.get('themeMode') as string

		if (!themeMode) {
			return ApiResponse.error('Missing themeMode', 400)
		}

		const session = await getSession(request.headers.get('Cookie'))
		session.set('themeMode', themeMode)

		return new Response(JSON.stringify({ success: true, data: '/settings' }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Set-Cookie': await commitSession(session)
			}
		})
	} catch (error) {
		console.error('Error in update-theme:', error)

		return ApiResponse.error(
			error instanceof Error ? error.message : 'Unknown error occurred',
			500
		)
	}
}
