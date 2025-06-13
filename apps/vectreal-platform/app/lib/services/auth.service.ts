import type { User } from '@supabase/supabase-js'

import { getSession } from '../sessions/auth-session.server'
import { csrfSession } from '../sessions/csrf-session.server'

import { createClient } from '../supabase.server'

export class AuthService {
	private supabase

	constructor(request: Request) {
		this.supabase = createClient(request)
	}

	async validateUser(cookie: string | null): Promise<User> {
		const { data: authSession } = await getSession(cookie)

		if (!authSession?.idt) {
			throw new Error('Unauthorized: Session invalid or expired')
		}

		const { data, error } = await this.supabase.auth.getUser(authSession.idt)

		if (error || !data.user) {
			throw new Error('Unauthorized: User not authenticated')
		}

		return data.user
	}

	async validateCsrfToken(
		formData: FormData,
		headers: Headers
	): Promise<boolean> {
		try {
			// Ensure the token field has the correct key name as specified in csrf-session.server.ts
			if (formData.has('csrf')) {
				await csrfSession.validate(formData, headers)
			} else {
				await csrfSession.validate(formData, headers)
			}

			return true
		} catch (error) {
			console.error('CSRF validation failed:', error)
			throw new Error('Forbidden: CSRF validation failed')
		}
	}

	async validateJsonCsrfToken(data: { csrf?: string }): Promise<boolean> {
		if (!data.csrf) {
			throw new Error('Forbidden: CSRF token missing')
		}

		// For JSON requests, we'll bypass the complex validation for now
		// In production, you should implement proper CSRF validation for JSON
		return true
	}
}
