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

function resolveHookSecret(): string {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET
  if (!secret) {
    throw new Error(
      'Missing required environment variable: SEND_EMAIL_HOOK_SECRET',
    )
  }
  return secret
}

function decodeHookSecret(raw: string): Buffer {
  // Strip Supabase-style prefixes (v1,whsec_ or whsec_)
  const stripped = raw.replace(/^v1,whsec_/, '').replace(/^whsec_/, '')
  return Buffer.from(stripped, 'base64')
}

function parseV1Signatures(signatureHeader: string): string[] {
  return signatureHeader
    .split(/\s+/)
    .flatMap((entry) => entry.split(';'))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const comma = entry.indexOf(',')
      if (comma === -1) return []
      const version = entry.slice(0, comma)
      const sig = entry.slice(comma + 1)
      return version === 'v1' && sig ? [sig] : []
    })
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

  const timestampSeconds = Number.parseInt(timestamp, 10)
  if (Number.isNaN(timestampSeconds)) {
    throw new Error('Invalid webhook timestamp')
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSeconds - timestampSeconds) > 300) {
    throw new Error('Webhook timestamp is outside the allowed window')
  }

  const secret = decodeHookSecret(resolveHookSecret())
  const signedContent = `${id}.${timestamp}.${args.payload}`
  const digest = createHmac('sha256', secret)
    .update(signedContent)
    .digest('base64')

  const expected = Buffer.from(digest)
  const candidates = parseV1Signatures(signature)

  if (candidates.length === 0) {
    throw new Error('Missing v1 webhook signature')
  }

  const verified = candidates.some((candidate) => {
    const received = Buffer.from(candidate)
    return (
      received.length === expected.length &&
      timingSafeEqual(received, expected)
    )
  })

  if (!verified) {
    throw new Error('Invalid webhook signature')
  }

  return JSON.parse(args.payload) as AuthHookPayload
}
