import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
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
  heading: (name: string) => string
  intro: (name: string) => string
  ctaLabel?: string
  outro: string
}

const TEMPLATE_BY_ACTION: Record<CanonicalEmailAction, TemplateConfig> = {
  signup: {
    subject: 'Confirm your Vectreal account',
    preview: 'One click to confirm your email and get started.',
    heading: (name) => `Welcome to Vectreal, ${name}!`,
    intro: () =>
      "You're one confirmation away from publishing your first 3D experience. Click below to verify your email and get started — we're excited to have you.",
    ctaLabel: 'Confirm my email →',
    outro:
      "This link expires in 24 hours. If you didn't sign up for Vectreal, you can safely ignore this email.",
  },
  recovery: {
    subject: 'Reset your Vectreal password',
    preview: 'A password reset was requested for your account.',
    heading: () => "Let's get you back in",
    intro: (name) =>
      `Hey ${name}, forgot your password? No big deal — it happens to the best of us. Click below to set a new one.`,
    ctaLabel: 'Reset my password →',
    outro:
      "Didn't request this? No action needed — your password remains unchanged and your account is safe.",
  },
  magic_link: {
    subject: 'Your Vectreal sign-in link',
    preview: 'Your one-click sign-in link is ready.',
    heading: () => 'Your sign-in link is here',
    intro: (name) =>
      `Hey ${name}, here's your one-click pass into Vectreal. No password needed — just click below.`,
    ctaLabel: 'Sign me in →',
    outro:
      "This link expires in 1 hour and works only once. If you didn't request it, you can safely ignore this.",
  },
  email_change_new: {
    subject: 'Confirm your new Vectreal email',
    preview: 'Confirm your new email address to complete the switch.',
    heading: () => 'Confirm your new email address',
    intro: () =>
      "You're almost done switching your email address. Confirm the new one below to make the change official.",
    ctaLabel: 'Confirm new email →',
    outro:
      "Didn't request this change? Please contact support immediately to secure your account.",
  },
  email_change_current: {
    subject: 'Approve your Vectreal email change',
    preview: 'Approve the email change request from your current address.',
    heading: () => 'Approve your email change request',
    intro: () =>
      'A request was made to update your Vectreal account to a new email address. Approve it from your current address before the switch is made.',
    ctaLabel: 'Approve this change →',
    outro:
      "Didn't make this request? Ignore this email — no changes will be applied without your approval.",
  },
  invite: {
    subject: "You've been invited to Vectreal",
    preview: 'Someone invited you to their team on Vectreal.',
    heading: () => "You've been invited to Vectreal",
    intro: () =>
      "Someone's pulling you into the 3D publishing world. Join your team on Vectreal and start building together.",
    ctaLabel: 'Accept invitation →',
    outro:
      "Not sure what this is? No account will be created without your action — you can safely ignore this email.",
  },
  reauthentication: {
    subject: 'Your Vectreal verification code',
    preview: 'Your one-time verification code — expires shortly.',
    heading: () => 'Your verification code',
    intro: () =>
      'Use the one-time code below to complete your secure action. It expires in 10 minutes.',
    outro:
      "Never share this code with anyone — Vectreal will never ask for it. If you didn't request this, your account is safe.",
  },
  password_changed_notification: {
    subject: 'Your Vectreal password was changed',
    preview: 'Your account password was just updated.',
    heading: () => 'Your password was changed',
    intro: (name) =>
      `Hey ${name}, this is a confirmation that the password on your Vectreal account was just updated. If that was you — you're all set.`,
    outro:
      "Wasn't you? Reset your password immediately at vectreal.com and reach out to our support team. Act quickly.",
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

const BASE_URL = 'https://vectreal.com'

export function AuthEmail({ action, displayName, ctaHref, code }: AuthEmailProps) {
  const tpl = TEMPLATE_BY_ACTION[action]
  const year = new Date().getFullYear()

  return (
    <Html lang="en" dir="ltr">
      <Head>
        <Font
          fontFamily="DM Sans"
          fallbackFontFamily="Arial"
          webFont={{
            url: 'https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZOIHQ.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="DM Sans"
          fallbackFontFamily="Arial"
          webFont={{
            url: 'https://fonts.gstatic.com/s/dmsans/v15/rP2Fp2ywxg089UriASitCBimCw.woff2',
            format: 'woff2',
          }}
          fontWeight={600}
          fontStyle="normal"
        />
      </Head>

      <Preview>{tpl.preview}</Preview>

      <Body style={s.body}>
        <Container style={s.container}>

          {/* ── Header ── */}
          <Section style={s.header}>
            {/* Table layout: SVGs are blocked in Gmail/Outlook/Yahoo — use hosted PNG */}
            <table cellPadding="0" cellSpacing="0" border={0}>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: 'middle' }}>
                    <Img
                      src={`${BASE_URL}/android-chrome-192x192.png`}
                      width="22"
                      height="22"
                      alt="Vectreal logo"
                      style={{ display: 'block' }}
                    />
                  </td>
                  <td style={{ verticalAlign: 'middle', paddingLeft: '8px' }}>
                    <span style={s.brandName}>Vectreal</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* ── Content ── */}
          <Section style={s.content}>
            <Heading as="h1" style={s.heading}>
              {tpl.heading(displayName)}
            </Heading>

            <Text style={s.intro}>{tpl.intro(displayName)}</Text>

            {ctaHref && tpl.ctaLabel && (
              <Section style={s.buttonRow}>
                <Button href={ctaHref} style={s.button}>
                  {tpl.ctaLabel}
                </Button>
              </Section>
            )}

            {code && (
              <Section style={s.codeBox}>
                <Text style={s.code}>{code}</Text>
              </Section>
            )}

            <Hr style={s.hr} />

            <Text style={s.outro}>{tpl.outro}</Text>
          </Section>

          {/* ── Footer ── */}
          <Section style={s.footer}>
            <Text style={s.footerNav}>
              <Link href={BASE_URL} style={s.footerLink}>vectreal.com</Link>
              <span style={s.dot}> · </span>
              <Link href={`${BASE_URL}/docs`} style={s.footerLink}>Docs</Link>
              <span style={s.dot}> · </span>
              <Link href={`${BASE_URL}/news-room`} style={s.footerLink}>News Room</Link>
              <span style={s.dot}> · </span>
              <Link href={`${BASE_URL}/contact`} style={s.footerLink}>Help &amp; Support</Link>
            </Text>
            <Text style={s.footerNav}>
              <Link href="https://github.com/vectreal/" style={s.footerLink}>GitHub</Link>
              <span style={s.dot}> · </span>
              <Link href="https://discord.gg/A9a3nPkZw7" style={s.footerLink}>Discord</Link>
              <span style={s.dot}> · </span>
              <Link href="https://x.com/vectreal" style={s.footerLink}>X</Link>
              <span style={s.dot}> · </span>
              <Link href="https://reddit.com/r/vectreal/" style={s.footerLink}>Reddit</Link>
              <span style={s.dot}> · </span>
              <Link href="https://youtube.com/vectreal/" style={s.footerLink}>YouTube</Link>
            </Text>
            <Text style={s.footerLegal}>
              {'© '}{year}{' Vectreal'}
              <span style={s.dot}> · </span>
              <Link href={`${BASE_URL}/privacy-policy`} style={s.footerLink}>Privacy</Link>
              <span style={s.dot}> · </span>
              <Link href={`${BASE_URL}/terms-of-service`} style={s.footerLink}>Terms</Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

// ---------------------------------------------------------------------------
// Styles
// Brand: white bg · #111111 text · #fc6c18 orange accent · DM Sans
// ---------------------------------------------------------------------------

const s: Record<string, React.CSSProperties> = {
  body: {
    margin: '0',
    padding: '0',
    backgroundColor: '#f4f4f5',
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },
  container: {
    maxWidth: '560px',
    margin: '32px auto',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e4e4e7',
  },

  // Header
  header: {
    padding: '20px 32px',
    borderBottom: '1px solid #f0f0f2',
  },
  brandName: {
    fontSize: '17px',
    fontWeight: 700,
    color: '#111111',
    verticalAlign: 'middle',
    marginLeft: '8px',
    letterSpacing: '-0.01em',
  },

  // Content
  content: {
    padding: '36px 32px 32px',
  },
  heading: {
    margin: '0 0 14px',
    fontSize: '26px',
    lineHeight: '1.25',
    fontWeight: 600,
    color: '#111111',
    letterSpacing: '-0.02em',
  },
  intro: {
    margin: '0 0 28px',
    fontSize: '16px',
    lineHeight: '1.7',
    color: '#3f3f46',
  },

  // CTA button
  buttonRow: {
    margin: '0 0 28px',
  },
  button: {
    display: 'inline-block',
    padding: '13px 26px',
    backgroundColor: '#fc6c18',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600,
    textDecoration: 'none',
    letterSpacing: '-0.01em',
  },

  // OTP code
  codeBox: {
    margin: '0 0 28px',
    padding: '20px',
    backgroundColor: '#fafafa',
    borderRadius: '10px',
    border: '1px solid #e4e4e7',
    textAlign: 'center',
  },
  code: {
    margin: '0',
    fontSize: '34px',
    letterSpacing: '10px',
    fontWeight: 700,
    color: '#111111',
    textAlign: 'center',
  },

  hr: {
    borderColor: '#f0f0f2',
    margin: '28px 0',
  },
  outro: {
    margin: '0',
    fontSize: '14px',
    lineHeight: '1.65',
    color: '#71717a',
  },

  // Footer
  footer: {
    padding: '22px 32px 24px',
    backgroundColor: '#fafafa',
    borderTop: '1px solid #f0f0f2',
  },
  footerNav: {
    margin: '0 0 6px',
    fontSize: '13px',
    color: '#a1a1aa',
    textAlign: 'center',
  },
  footerLegal: {
    margin: '10px 0 0',
    fontSize: '12px',
    color: '#a1a1aa',
    textAlign: 'center',
  },
  footerLink: {
    color: '#71717a',
    textDecoration: 'none',
  },
  dot: {
    color: '#d4d4d8',
  },
}

export default AuthEmail
