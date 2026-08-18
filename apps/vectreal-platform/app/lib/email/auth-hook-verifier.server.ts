import { createHmac, timingSafeEqual } from 'node:crypto'

// ---------------------------------------------------------------------------
// Payload types (mirrored from Supabase Auth send_email hook spec)
// ---------------------------------------------------------------------------

export interface AuthHookUser {
	id: string
	email?: string
	user_metadata?: {
		name?: string
		username?: string
	}
}

export type RawEmailActionType =
	| 'signup'
	| 'recovery'
	| 'email'
	| 'magic_link'
	| 'magiclink'
	| 'email_change_new'
	| 'email_change_current'
	| 'invite'
	| 'reauthentication'
	| 'password_changed_notification'

export interface AuthHookEmailData {
	email_action_type: RawEmailActionType
	token: string
	token_hash: string
	token_new?: string
	token_hash_new?: string
	redirect_to?: string
	site_url: string
}

export interface AuthHookPayload {
	user: AuthHookUser
	email_data: AuthHookEmailData
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function resolveSecret(): Buffer {
	const raw = process.env.SEND_EMAIL_HOOK_SECRET
	if (!raw || !raw.trim()) {
		throw new Error(
			'SEND_EMAIL_HOOK_SECRET is not set. ' +
				'Copy the signing secret from the Supabase dashboard; the ' +
				'"v1,whsec_" prefix is optional.'
		)
	}

	// Accept the secret in any of the forms it is copied in: with the Supabase
	// dashboard's "v1,whsec_" prefix, with a bare "whsec_" prefix, or as the raw
	// base64 payload. Whitespace can bleed in during CI/CD injection, and some
	// sources emit URL-safe base64, so normalize that too (- → +, _ → /) before
	// handing it to Node's Buffer decoder.
	const base64 = raw
		.trim()
		.replace(/^v1,whsec_/, '')
		.replace(/^whsec_/, '')
		.trim()
		.replace(/-/g, '+')
		.replace(/_/g, '/')

	const decoded = Buffer.from(base64, 'base64')

	if (decoded.length < 16) {
		throw new Error(
			`SEND_EMAIL_HOOK_SECRET decoded to only ${decoded.length} bytes - ` +
				'the value is likely truncated. Copy the whole secret from the ' +
				'Supabase dashboard.'
		)
	}

	return decoded
}

// The webhook-signature header contains space-separated "v1,<base64sig>" tokens.
// Normalize URL-safe base64 (- → +, _ → /) before decoding so both standard
// and URL-safe encodings from Supabase are handled correctly.
function extractV1Signatures(header: string): Buffer[] {
	return header
		.split(/\s+/)
		.filter((entry) => entry.startsWith('v1,'))
		.map((entry) => {
			const b64 = entry.slice(3).replace(/-/g, '+').replace(/_/g, '/')
			return Buffer.from(b64, 'base64')
		})
		.filter((buf) => buf.length > 0)
}

export function verifyAuthHookRequest(args: {
	payload: string
	headers: {
		id: string | null
		timestamp: string | null
		signature: string | null
	}
}): AuthHookPayload {
	const { id, timestamp, signature } = args.headers

	if (!id || !timestamp || !signature) {
		throw new Error(
			`Missing required webhook headers (id=${!!id}, timestamp=${!!timestamp}, signature=${!!signature})`
		)
	}

	const ts = Number.parseInt(timestamp, 10)
	if (Number.isNaN(ts)) {
		throw new Error('Invalid webhook timestamp')
	}

	if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) {
		throw new Error(
			`Webhook timestamp is outside the allowed window (ts=${ts}, now=${Math.floor(Date.now() / 1000)})`
		)
	}

	const secret = resolveSecret()
	const expected = createHmac('sha256', secret)
		.update(`${id}.${timestamp}.${args.payload}`)
		.digest()

	const candidates = extractV1Signatures(signature)

	if (candidates.length === 0) {
		throw new Error('Missing v1 webhook signature')
	}

	const verified = candidates.some(
		(received) =>
			received.length === expected.length && timingSafeEqual(received, expected)
	)

	if (!verified) {
		const diagInfo = candidates.map((c) => c.length).join(',')
		throw new Error(
			`Invalid webhook signature (secret_bytes=${secret.length}, expected_bytes=${expected.length}, received_lengths=[${diagInfo}])`
		)
	}

	return JSON.parse(args.payload) as AuthHookPayload
}
