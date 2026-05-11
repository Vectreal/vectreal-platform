import * as React from 'react'

import { AuthEmail } from './auth-email'

export default function RecoveryPreview() {
  return (
    <AuthEmail
      action="recovery"
      displayName="Jane"
      ctaHref="https://vectreal.com/auth/confirm?token_hash=abc123&type=recovery"
    />
  )
}
