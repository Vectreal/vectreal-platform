import {
  Body,
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

import type { ContactInquiryType } from '../../domain/contact/contact-shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContactInternalEmailProps {
  name: string
  email: string
  inquiryType: ContactInquiryType
  message: string
}

// ---------------------------------------------------------------------------
// Static config
// ---------------------------------------------------------------------------

const INQUIRY_LABEL: Record<ContactInquiryType, string> = {
  support: 'Support',
  sales: 'Sales',
  partnership: 'Partnership',
  other: 'Other',
}

const BASE_URL = 'https://vectreal.com'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContactInternalEmail({
  name,
  email,
  inquiryType,
  message,
}: ContactInternalEmailProps) {
  const label = INQUIRY_LABEL[inquiryType]
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

      <Preview>New {label} inquiry from {name}</Preview>

      <Body style={s.body}>
        <Container style={s.container}>

          {/* ── Header ── */}
          <Section style={s.header}>
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
                  <td style={{ verticalAlign: 'middle', paddingLeft: '12px' }}>
                    <span style={s.badge}>{label} inquiry</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* ── Content ── */}
          <Section style={s.content}>
            <Heading as="h1" style={s.heading}>
              New {label} inquiry from {name}
            </Heading>

            <Text style={s.intro}>
              A contact form submission just came in. Reply directly to this email — it&apos;s set to reach {name} at their inbox.
            </Text>

            {/* Submission data */}
            <Section style={s.dataCard}>
              <table cellPadding="0" cellSpacing="0" border={0} style={{ width: '100%' }}>
                <tbody>
                  <tr>
                    <td style={s.dataLabel}>Name</td>
                    <td style={s.dataValue}>{name}</td>
                  </tr>
                  <tr>
                    <td style={s.dataLabel}>Email</td>
                    <td style={s.dataValue}>
                      <Link href={`mailto:${email}`} style={s.emailLink}>{email}</Link>
                    </td>
                  </tr>
                  <tr>
                    <td style={s.dataLabel}>Type</td>
                    <td style={s.dataValue}>{label}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* Message */}
            <Text style={s.messageLabel}>Message</Text>
            <Section style={s.messageBox}>
              <Text style={s.messageText}>{message}</Text>
            </Section>

            <Hr style={s.hr} />

            <Text style={s.outro}>
              Hit reply to respond directly to {name}. The Reply-To header is set to their address.
            </Text>
          </Section>

          {/* ── Footer (internal — minimal) ── */}
          <Section style={s.footer}>
            <Text style={s.footerLegal}>
              {'© '}{year}{' Vectreal · Internal notification — do not forward'}
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

// ---------------------------------------------------------------------------
// Styles
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
    letterSpacing: '-0.01em',
  },
  badge: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#fc6c18',
    backgroundColor: '#fff4ee',
    border: '1px solid #fcd9c0',
    borderRadius: '4px',
    padding: '2px 8px',
    verticalAlign: 'middle',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },

  // Content
  content: {
    padding: '36px 32px 32px',
  },
  heading: {
    margin: '0 0 14px',
    fontSize: '22px',
    lineHeight: '1.25',
    fontWeight: 600,
    color: '#111111',
    letterSpacing: '-0.02em',
  },
  intro: {
    margin: '0 0 24px',
    fontSize: '15px',
    lineHeight: '1.65',
    color: '#3f3f46',
  },

  // Submission data card
  dataCard: {
    margin: '0 0 24px',
    padding: '20px',
    backgroundColor: '#fafafa',
    borderRadius: '10px',
    border: '1px solid #e4e4e7',
  },
  dataLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    paddingBottom: '12px',
    paddingRight: '20px',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
  },
  dataValue: {
    fontSize: '14px',
    color: '#111111',
    paddingBottom: '12px',
    verticalAlign: 'top',
  },
  emailLink: {
    color: '#fc6c18',
    textDecoration: 'none',
  },

  // Message
  messageLabel: {
    margin: '0 0 8px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  messageBox: {
    margin: '0 0 28px',
    padding: '16px 20px',
    backgroundColor: '#fafafa',
    borderRadius: '10px',
    border: '1px solid #e4e4e7',
    borderLeft: '3px solid #fc6c18',
  },
  messageText: {
    margin: '0',
    fontSize: '14px',
    lineHeight: '1.7',
    color: '#3f3f46',
    whiteSpace: 'pre-wrap',
  },

  hr: {
    borderColor: '#f0f0f2',
    margin: '28px 0',
  },
  outro: {
    margin: '0',
    fontSize: '13px',
    lineHeight: '1.65',
    color: '#71717a',
  },

  // Footer
  footer: {
    padding: '18px 32px',
    backgroundColor: '#fafafa',
    borderTop: '1px solid #f0f0f2',
  },
  footerLegal: {
    margin: '0',
    fontSize: '12px',
    color: '#a1a1aa',
    textAlign: 'center',
  },
}

export default ContactInternalEmail
