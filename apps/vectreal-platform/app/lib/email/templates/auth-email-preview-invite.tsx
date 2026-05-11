import * as React from 'react'

import { AuthEmail } from './auth-email'

export default function InvitePreview() {
  return (
    <AuthEmail
      action="invite"
      displayName="Jane"
      ctaHref="https://vectreal.com/auth/confirm?token_hash=abc123&type=invite"
    />
  )
}
