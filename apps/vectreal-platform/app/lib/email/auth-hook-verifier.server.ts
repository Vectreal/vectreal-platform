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
				'Store only the base64 payload (without the "v1,whsec_" prefix) - ' +
				'the comma in the Supabase dashboard format is corrupted by Cloud Run env var injection.'
		)
	}

	// Strip known prefixes, trim whitespace that may bleed in during CI/CD
	// injection, then normalise URL-safe base64 (- → +, _ → /) so Node's
	// Buffer decoder handles both standard and URL-safe variants correctly.
	//
	// IMPORTANT: the GitHub secret must be stored WITHOUT the "v1,whsec_"
	// prefix because Cloud Run uses comma as its env var delimiter - a value
	// like "v1,whsec_abc" is silently truncated to "v1" at runtime. Store
	// only the base64 payload; this function handles both forms defensively.
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
				'the value is likely truncated. Ensure the GitHub secret contains ' +
				'only the base64 payload (no "v1,whsec_" prefix).'
		)
	}

	return decoded
}

// The webhook-signature header contains space-separated "v1,<base64sig>" tokens.
// Normalise URL-safe base64 (- → +, _ → /) before decoding so both standard
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
