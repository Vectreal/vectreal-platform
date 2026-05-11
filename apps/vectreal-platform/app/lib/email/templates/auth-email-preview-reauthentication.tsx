import * as React from 'react'

import { AuthEmail } from './auth-email'

export default function ReauthenticationPreview() {
  return (
    <AuthEmail
      action="reauthentication"
      displayName="Jane"
      code="482931"
    />
  )
}
