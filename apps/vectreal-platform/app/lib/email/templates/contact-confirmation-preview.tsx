import * as React from 'react'

import { ContactConfirmationEmail } from './contact-confirmation'

export default function ContactConfirmationPreview() {
  return (
    <ContactConfirmationEmail
      displayName="Jane"
      referenceCode="VCTR-3F9A"
      inquiryType="partnership"
    />
  )
}
