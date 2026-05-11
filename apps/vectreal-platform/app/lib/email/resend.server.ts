import { Resend } from 'resend'

function resolveResendApiKey(): string {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error('Missing required environment variable: RESEND_API_KEY')
  }
  return key
}

export function resolveFromEmail(): string {
  const from = process.env.FROM_EMAIL
  if (!from) {
    throw new Error('Missing required environment variable: FROM_EMAIL')
  }
  return from
}

export function resolveContactInboxEmail(): string {
  const inbox = process.env.CONTACT_INBOX_EMAIL
  if (!inbox) {
    throw new Error('Missing required environment variable: CONTACT_INBOX_EMAIL')
  }
  return inbox
}

let cachedResend: Resend | null = null

export function getResendClient(): Resend {
  if (cachedResend) return cachedResend
  cachedResend = new Resend(resolveResendApiKey())
  return cachedResend
}
