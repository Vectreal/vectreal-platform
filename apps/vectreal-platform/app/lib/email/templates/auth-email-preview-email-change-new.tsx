import * as React from 'react'

import { AuthEmail } from './auth-email'

export default function EmailChangeNewPreview() {
  return (
    <AuthEmail
      action="email_change_new"
      displayName="Jane"
      ctaHref="https://vectreal.com/auth/confirm?token_hash=abc123&type=email_change"
    />
  )
}
