import { Resend } from 'resend'

function resolveResendApiKey(): string {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error('Missing required environment variable: RESEND_API_KEY')
  }
  return key
}

export function resolveAuthFromEmail(): string {
  const from = process.env.AUTH_FROM_EMAIL
  if (!from) {
    throw new Error('Missing required environment variable: AUTH_FROM_EMAIL')
  }
  return from
}

let cachedResend: Resend | null = null

export function getResendClient(): Resend {
  if (cachedResend) return cachedResend
  cachedResend = new Resend(resolveResendApiKey())
  return cachedResend
}
