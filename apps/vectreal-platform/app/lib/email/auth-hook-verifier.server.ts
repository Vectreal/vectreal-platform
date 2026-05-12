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
      'Missing required environment variable: SEND_EMAIL_HOOK_SECRET',
    )
  }
  // Strip known prefixes, trim whitespace that may be injected during CI/CD
  // transmission, then normalise URL-safe base64 (- → +, _ → /) so Node's
  // Buffer decoder handles both standard and URL-safe variants correctly.
  const base64 = raw
    .trim()
    .replace(/^v1,whsec_/, '')
    .replace(/^whsec_/, '')
    .trim()
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  return Buffer.from(base64, 'base64')
}

// The webhook-signature header contains space-separated "v1,<base64sig>" tokens.
function extractV1Signatures(header: string): Buffer[] {
  return header
    .split(/\s+/)
    .filter((entry) => entry.startsWith('v1,'))
    .map((entry) => Buffer.from(entry.slice(3), 'base64'))
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
    throw new Error('Missing required webhook headers')
  }

  const ts = Number.parseInt(timestamp, 10)
  if (Number.isNaN(ts)) {
    throw new Error('Invalid webhook timestamp')
  }

  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) {
    throw new Error('Webhook timestamp is outside the allowed window')
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
      received.length === expected.length && timingSafeEqual(received, expected),
  )

  if (!verified) {
    throw new Error('Invalid webhook signature')
  }

  return JSON.parse(args.payload) as AuthHookPayload
}
