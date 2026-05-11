import * as React from 'react'

import { AuthEmail } from './auth-email'

export default function MagicLinkPreview() {
  return (
    <AuthEmail
      action="magic_link"
      displayName="Jane"
      ctaHref="https://vectreal.com/auth/confirm?token_hash=abc123&type=email"
    />
  )
}
