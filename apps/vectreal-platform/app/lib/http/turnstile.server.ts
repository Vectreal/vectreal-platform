interface TurnstileVerificationResponse {
	success: boolean
	'error-codes'?: string[]
}

const TURNSTILE_VERIFY_URL =
	'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export async function verifyTurnstileToken(
	token: string
): Promise<{ success: boolean; errorCodes?: string[] }> {
	const turnstileSecretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY
	const trimmedToken = token.trim()

	if (!turnstileSecretKey) {
		if (process.env.NODE_ENV !== 'production') {
			console.warn(
				'[turnstile] CLOUDFLARE_TURNSTILE_SECRET_KEY is not set. Skipping verification in non-production.'
			)
			return { success: true }
		}

		return { success: false, errorCodes: ['missing-input-secret'] }
	}

	if (!trimmedToken) {
		return { success: false, errorCodes: ['missing-input-response'] }
	}

	try {
		const response = await fetch(TURNSTILE_VERIFY_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				secret: turnstileSecretKey,
				response: trimmedToken
			})
		})

		if (!response.ok) {
			return { success: false, errorCodes: ['verification-request-failed'] }
		}

		const payload =
			(await response.json()) as TurnstileVerificationResponse

		if (!payload.success) {
			return {
				success: false,
				errorCodes: payload['error-codes'] ?? ['verification-failed']
			}
		}

		return { success: true }
	} catch {
		return { success: false, errorCodes: ['verification-request-failed'] }
	}
}
