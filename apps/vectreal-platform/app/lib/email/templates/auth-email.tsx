import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CanonicalEmailAction =
  | 'signup'
  | 'recovery'
  | 'magic_link'
  | 'email_change_new'
  | 'email_change_current'
  | 'invite'
  | 'reauthentication'
  | 'password_changed_notification'

export interface AuthEmailProps {
  action: CanonicalEmailAction
  displayName: string
  /** Confirmation link — undefined for reauthentication and password_changed_notification */
  ctaHref?: string
  /** OTP code — only for reauthentication */
  code?: string
}

// ---------------------------------------------------------------------------
// Static content config
// ---------------------------------------------------------------------------

interface TemplateConfig {
  subject: string
  preview: string
  heading: string
  intro: (name: string) => string
  ctaLabel?: string
  outro: string
}

const TEMPLATE_BY_ACTION: Record<CanonicalEmailAction, TemplateConfig> = {
  signup: {
    subject: 'Confirm your Vectreal account',
    preview: 'Confirm your email to finish creating your account.',
    heading: 'Welcome to Vectreal',
    intro: (name) =>
      `Hi ${name}, confirm your email address to finish creating your Vectreal account.`,
    ctaLabel: 'Confirm email',
    outro: 'This link expires automatically for your security.',
  },
  recovery: {
    subject: 'Reset your Vectreal password',
    preview: 'A password reset was requested for your account.',
    heading: 'Password reset requested',
    intro: (name) =>
      `Hi ${name}, use the link below to set a new password for your Vectreal account.`,
    ctaLabel: 'Reset password',
    outro:
      'If you did not request this change, ignore this email — your password will remain the same.',
  },
  magic_link: {
    subject: 'Sign in to Vectreal',
    preview: 'Your secure sign-in link is ready.',
    heading: 'Use your secure sign-in link',
    intro: (name) =>
      `Hi ${name}, click below to sign in to your Vectreal account.`,
    ctaLabel: 'Sign in',
    outro: 'If you did not request this email, you can safely ignore it.',
  },
  email_change_new: {
    subject: 'Confirm your new Vectreal email',
    preview: 'Confirm your new email address.',
    heading: 'Confirm your new email address',
    intro: () =>
      'We received a request to update the email on your Vectreal account. Confirm the new address below.',
    ctaLabel: 'Confirm new email',
    outro: 'If this was not you, please secure your account immediately.',
  },
  email_change_current: {
    subject: 'Approve your Vectreal email change',
    preview: 'Approve the email change request from your current address.',
    heading: 'Approve this email change',
    intro: () =>
      'Before we switch your account to a new email address, please approve the request from your current address.',
    ctaLabel: 'Approve change',
    outro:
      'If you did not make this request, ignore this email and keep your account secure.',
  },
  invite: {
    subject: 'You were invited to Vectreal',
    preview: 'Join your team on Vectreal.',
    heading: 'You have been invited',
    intro: () =>
      'Join your team on Vectreal to manage and publish 3D experiences together.',
    ctaLabel: 'Accept invite',
    outro: 'If this invitation was unexpected, you can ignore this email.',
  },
  reauthentication: {
    subject: 'Your Vectreal verification code',
    preview: 'Your one-time verification code.',
    heading: 'Verification required',
    intro: () =>
      'Use the verification code below to complete your secure action in Vectreal.',
    outro: 'This code expires shortly. Do not share it with anyone.',
  },
  password_changed_notification: {
    subject: 'Your Vectreal password was changed',
    preview: 'Your account password was just changed.',
    heading: 'Password changed',
    intro: () =>
      'Your Vectreal account password was just changed. If this was you, no further action is needed.',
    outro:
      'If you did not make this change, reset your password immediately and contact support.',
  },
}

// ---------------------------------------------------------------------------
// Subject accessor (used by the sender to set the email subject line)
// ---------------------------------------------------------------------------

export function getAuthEmailSubject(action: CanonicalEmailAction): string {
  return TEMPLATE_BY_ACTION[action].subject
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuthEmail({ action, displayName, ctaHref, code }: AuthEmailProps) {
  const tpl = TEMPLATE_BY_ACTION[action]

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{tpl.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brand}>Vectreal</Text>
          </Section>

          <Section style={styles.content}>
            <Heading as="h1" style={styles.heading}>
              {tpl.heading}
            </Heading>

            <Text style={styles.intro}>{tpl.intro(displayName)}</Text>

            {ctaHref && tpl.ctaLabel && (
              <Button href={ctaHref} style={styles.button}>
                {tpl.ctaLabel}
              </Button>
            )}

            {code && <Text style={styles.code}>{code}</Text>}

            <Hr style={styles.hr} />

            <Text style={styles.outro}>{tpl.outro}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ---------------------------------------------------------------------------
// Styles — brand theme: #050816 bg, #0d1530 card, #e8ecff text, #5b6bff accent
// ---------------------------------------------------------------------------

const styles = {
  body: {
    margin: '0',
    padding: '0',
    backgroundColor: '#050816',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: '#e8ecff',
  },
  container: {
    maxWidth: '560px',
    margin: '28px auto',
    border: '1px solid #1e2644',
    borderRadius: '14px',
    backgroundColor: '#0d1530',
    overflow: 'hidden',
  },
  header: {
    padding: '26px 28px',
    borderBottom: '1px solid #1e2644',
  },
  brand: {
    margin: '0',
    fontSize: '20px',
    fontWeight: 700,
    letterSpacing: '0.02em',
    color: '#ffffff',
  },
  content: {
    padding: '28px',
  },
  heading: {
    margin: '0 0 14px',
    fontSize: '24px',
    lineHeight: '1.3',
    fontWeight: 700,
    color: '#ffffff',
  },
  intro: {
    margin: '0 0 20px',
    color: '#ccd6f6',
    fontSize: '15px',
    lineHeight: '1.7',
  },
  button: {
    display: 'inline-block',
    padding: '12px 20px',
    backgroundColor: '#5b6bff',
    borderRadius: '8px',
    color: '#ffffff',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '15px',
  },
  code: {
    margin: '16px 0 0',
    fontSize: '26px',
    letterSpacing: '4px',
    fontWeight: '700',
    color: '#f5f7ff',
    textAlign: 'center' as const,
  },
  hr: {
    borderColor: '#1e2644',
    margin: '24px 0',
  },
  outro: {
    margin: '0',
    color: '#9aa6c5',
    fontSize: '14px',
    lineHeight: '1.6',
  },
} satisfies Record<string, React.CSSProperties>
