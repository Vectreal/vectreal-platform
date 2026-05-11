import * as React from 'react'

import { AuthEmail } from './auth-email'

export default function SignupPreview() {
  return (
    <AuthEmail
      action="signup"
      displayName="Jane"
      ctaHref="https://vectreal.com/auth/confirm?token_hash=abc123&type=signup"
    />
  )
}
