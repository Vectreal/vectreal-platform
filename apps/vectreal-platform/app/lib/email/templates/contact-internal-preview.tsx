import * as React from 'react'

import { ContactInternalEmail } from './contact-internal'

export default function ContactInternalPreview() {
  return (
    <ContactInternalEmail
      name="Jane Smith"
      email="jane@example.com"
      inquiryType="partnership"
      message={"Hi Vectreal team,\n\nWe're building a 3D configurator for our furniture line and think your platform would be a great fit. We'd love to explore a white-label integration.\n\nWould you be open to a call next week?\n\nBest,\nJane"}
    />
  )
}
