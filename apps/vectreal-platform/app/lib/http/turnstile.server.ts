import { randomUUID } from 'node:crypto'

interface TurnstileVerificationResponse {
	success: boolean
	hostname?: string
	'error-codes'?: string[]
}

const TURNSTILE_VERIFY_URL =
	'https://challenges.cloudflare.com/turnstile/v0/siteverify'

function getClientIp(request: Request): string | null {
	const cfIp = request.headers.get('cf-connecting-ip')?.trim()
	if (cfIp) {
		return cfIp
	}

	const forwarded = request.headers.get('x-forwarded-for')?.trim()
	if (forwarded) {
		return forwarded.split(',')[0]?.trim() || null
	}

	return null
}

export async function verifyTurnstileToken(
	token: string,
	request?: Request
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
		const requestBody = new URLSearchParams({
			secret: turnstileSecretKey,
			response: trimmedToken,
			idempotency_key: randomUUID()
		})

		const clientIp = request ? getClientIp(request) : null
		if (clientIp) {
			requestBody.set('remoteip', clientIp)
		}

		const response = await fetch(TURNSTILE_VERIFY_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: requestBody
		})

		if (!response.ok) {
			return { success: false, errorCodes: ['verification-request-failed'] }
		}

		const payload = (await response.json()) as TurnstileVerificationResponse

		if (!payload.success) {
			return {
				success: false,
				errorCodes: payload['error-codes'] ?? ['verification-failed']
			}
		}

		const expectedHostname = request
			? new URL(request.url).hostname.toLowerCase()
			: null
		const responseHostname = payload.hostname?.toLowerCase()

		if (
			expectedHostname &&
			responseHostname &&
			responseHostname !== expectedHostname
		) {
			return { success: false, errorCodes: ['hostname-mismatch'] }
		}

		return { success: true }
	} catch {
		return { success: false, errorCodes: ['verification-request-failed'] }
	}
}
