import * as React from 'react'

import { AuthEmail } from './auth-email'

export default function PasswordChangedPreview() {
  return (
    <AuthEmail
      action="password_changed_notification"
      displayName="Jane"
    />
  )
}
