
import { render } from '@react-email/render'
import { createElement } from 'react'

import { getResendClient, resolveContactInboxEmail, resolveFromEmail } from './resend.server'
import { ContactConfirmationEmail } from './templates/contact-confirmation'
import { ContactInternalEmail } from './templates/contact-internal'

import type { ContactInquiryType } from '../domain/contact/contact-shared'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function sendInternalContactNotification(args: {
  name: string
  email: string
  inquiryType: ContactInquiryType
  message: string
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!isResendConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[contact] RESEND_API_KEY not set — skipping internal notification in dev')
      return { ok: true }
    }
  }

  try {
    const element = createElement(ContactInternalEmail, { ...args })
    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ])

    const { data, error } = await getResendClient().emails.send({
      from: resolveFromEmail(),
      to: [resolveContactInboxEmail()],
      replyTo: `${args.name} <${args.email}>`,
      subject: `[Contact] ${args.inquiryType} inquiry from ${args.name}`,
      html,
      text,
    })

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, messageId: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: `Failed to send internal notification: ${message}` }
  }
}

export async function sendSubmitterConfirmation(args: {
  displayName: string
  referenceCode: string
  email: string
  inquiryType: ContactInquiryType
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!isResendConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[contact] RESEND_API_KEY not set — skipping confirmation email in dev')
      return { ok: true }
    }
  }

  try {
    const element = createElement(ContactConfirmationEmail, {
      displayName: args.displayName,
      referenceCode: args.referenceCode,
      inquiryType: args.inquiryType,
    })
    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ])

    const { data, error } = await getResendClient().emails.send({
      from: resolveFromEmail(),
      to: [args.email],
      subject: `We received your message (${args.referenceCode})`,
      html,
      text,
    })

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, messageId: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: `Failed to send confirmation: ${message}` }
  }
}
