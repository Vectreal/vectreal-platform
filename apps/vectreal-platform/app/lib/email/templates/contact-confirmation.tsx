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
	Text
} from '@react-email/components'
import * as React from 'react'

import type { ContactInquiryType } from '../../domain/contact/contact-shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContactConfirmationEmailProps {
	displayName: string
	referenceCode: string
	inquiryType: ContactInquiryType
}

// ---------------------------------------------------------------------------
// Static config
// ---------------------------------------------------------------------------

const INQUIRY_LABEL: Record<ContactInquiryType, string> = {
	support: 'support',
	sales: 'sales',
	partnership: 'partnership',
	other: 'general'
}

const BASE_URL = 'https://vectreal.com'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContactConfirmationEmail({
	displayName,
	referenceCode,
	inquiryType
}: ContactConfirmationEmailProps) {
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
						format: 'woff2'
					}}
					fontWeight={400}
					fontStyle="normal"
				/>
				<Font
					fontFamily="DM Sans"
					fallbackFontFamily="Arial"
					webFont={{
						url: 'https://fonts.gstatic.com/s/dmsans/v15/rP2Fp2ywxg089UriASitCBimCw.woff2',
						format: 'woff2'
					}}
					fontWeight={600}
					fontStyle="normal"
				/>
			</Head>

			<Preview>
				We&apos;ve received your {label} inquiry and will be in touch soon.
			</Preview>

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
								</tr>
							</tbody>
						</table>
					</Section>

					{/* ── Content ── */}
					<Section style={s.content}>
						<Heading as="h1" style={s.heading}>
							We&apos;ve got your message, {displayName}!
						</Heading>

						<Text style={s.intro}>
							Thanks for reaching out. Your {label} inquiry is with our team -
							we&apos;ll get back to you within one business day. Usually
							sooner.
						</Text>

						{/* Reference code */}
						<Section style={s.codeBox}>
							<Text style={s.codeLabel}>Your reference code</Text>
							<Text style={s.code}>{referenceCode}</Text>
						</Section>

						<Hr style={s.hr} />

						<Text style={s.outro}>
							Need to follow up? Reply to this email with your reference code
							and we&apos;ll pick up the thread. You can also reach us directly
							at{' '}
							<Link href="mailto:info@vectreal.com" style={s.link}>
								info@vectreal.com
							</Link>
							.
						</Text>
					</Section>

					{/* ── Footer ── */}
					<Section style={s.footer}>
						<Text style={s.footerNav}>
							<Link href={BASE_URL} style={s.footerLink}>
								vectreal.com
							</Link>
							<span style={s.dot}> · </span>
							<Link href={`${BASE_URL}/docs`} style={s.footerLink}>
								Docs
							</Link>
							<span style={s.dot}> · </span>
							<Link href={`${BASE_URL}/news-room`} style={s.footerLink}>
								News Room
							</Link>
							<span style={s.dot}> · </span>
							<Link href={`${BASE_URL}/contact`} style={s.footerLink}>
								Help &amp; Support
							</Link>
						</Text>
						<Text style={s.footerNav}>
							<Link href="https://github.com/vectreal/" style={s.footerLink}>
								GitHub
							</Link>
							<span style={s.dot}> · </span>
							<Link href="https://discord.gg/A9a3nPkZw7" style={s.footerLink}>
								Discord
							</Link>
							<span style={s.dot}> · </span>
							<Link href="https://x.com/vectreal" style={s.footerLink}>
								X
							</Link>
							<span style={s.dot}> · </span>
							<Link href="https://reddit.com/r/vectreal/" style={s.footerLink}>
								Reddit
							</Link>
							<span style={s.dot}> · </span>
							<Link href="https://youtube.com/vectreal/" style={s.footerLink}>
								YouTube
							</Link>
						</Text>
						<Text style={s.footerLegal}>
							{'© '}
							{year}
							{' Vectreal'}
							<span style={s.dot}> · </span>
							<Link href={`${BASE_URL}/privacy-policy`} style={s.footerLink}>
								Privacy
							</Link>
							<span style={s.dot}> · </span>
							<Link href={`${BASE_URL}/terms-of-service`} style={s.footerLink}>
								Terms
							</Link>
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
		fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif"
	},
	container: {
		maxWidth: '560px',
		margin: '32px auto',
		backgroundColor: '#ffffff',
		borderRadius: '12px',
		border: '1px solid #e4e4e7'
	},

	// Header
	header: {
		padding: '20px 32px',
		borderBottom: '1px solid #f0f0f2'
	},
	brandName: {
		fontSize: '17px',
		fontWeight: 700,
		color: '#111111',
		verticalAlign: 'middle',
		letterSpacing: '-0.01em'
	},

	// Content
	content: {
		padding: '36px 32px 32px'
	},
	heading: {
		margin: '0 0 14px',
		fontSize: '26px',
		lineHeight: '1.25',
		fontWeight: 600,
		color: '#111111',
		letterSpacing: '-0.02em'
	},
	intro: {
		margin: '0 0 28px',
		fontSize: '16px',
		lineHeight: '1.7',
		color: '#3f3f46'
	},

	// Reference code box
	codeBox: {
		margin: '0 0 28px',
		padding: '20px',
		backgroundColor: '#fafafa',
		borderRadius: '10px',
		border: '1px solid #e4e4e7',
		textAlign: 'center'
	},
	codeLabel: {
		margin: '0 0 8px',
		fontSize: '11px',
		fontWeight: 600,
		color: '#71717a',
		textTransform: 'uppercase',
		letterSpacing: '0.06em',
		textAlign: 'center'
	},
	code: {
		margin: '0',
		fontSize: '28px',
		letterSpacing: '6px',
		fontWeight: 700,
		color: '#111111',
		textAlign: 'center'
	},

	link: {
		color: '#fc6c18',
		textDecoration: 'none'
	},
	hr: {
		borderColor: '#f0f0f2',
		margin: '28px 0'
	},
	outro: {
		margin: '0',
		fontSize: '14px',
		lineHeight: '1.65',
		color: '#71717a'
	},

	// Footer
	footer: {
		padding: '22px 32px 24px',
		backgroundColor: '#fafafa',
		borderTop: '1px solid #f0f0f2'
	},
	footerNav: {
		margin: '0 0 6px',
		fontSize: '13px',
		color: '#a1a1aa',
		textAlign: 'center'
	},
	footerLegal: {
		margin: '10px 0 0',
		fontSize: '12px',
		color: '#a1a1aa',
		textAlign: 'center'
	},
	footerLink: {
		color: '#71717a',
		textDecoration: 'none'
	},
	dot: {
		color: '#d4d4d8'
	}
}

export default ContactConfirmationEmail
