import {
	Body,
	Container,
	Head,
	Hr,
	Html,
	Preview,
	Section,
	Text
} from '@react-email/components'
import * as React from 'react'

import { MODEL_INTAKE_COPY } from '../../../constants/product-copy'

import type { ModelIntakeLocale } from '../../domain/model-intake/model-intake-shared'

export interface ModelIntakeConfirmationEmailProps {
	locale: ModelIntakeLocale
	displayName: string
	referenceCode: string
}

/** What the brand receives, in the language it wrote in. */
export function ModelIntakeConfirmationEmail({
	locale,
	displayName,
	referenceCode
}: ModelIntakeConfirmationEmailProps) {
	const copy = MODEL_INTAKE_COPY[locale].confirmationEmail

	return (
		<Html lang={locale} dir="ltr">
			<Head />
			<Preview>{copy.preview}</Preview>
			<Body style={s.body}>
				<Container style={s.container}>
					<Section style={s.content}>
						{/* Text, not a heading: the plain-text part capitalizes headings. */}
						<Text style={s.greeting}>{copy.greeting(displayName)}</Text>
						<Text style={s.text}>{copy.body}</Text>
						<Section style={s.codeBox}>
							<Text style={s.codeLabel}>{copy.reference}</Text>
							<Text style={s.code}>{referenceCode}</Text>
						</Section>
						<Hr style={s.hr} />
						<Text style={s.muted}>{copy.deletion}</Text>
						<Text style={s.muted}>{copy.signature}</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	)
}

const s: Record<string, React.CSSProperties> = {
	body: {
		margin: '0',
		backgroundColor: '#f4f4f5',
		fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif"
	},
	container: {
		maxWidth: '560px',
		margin: '32px auto',
		backgroundColor: '#ffffff',
		borderRadius: '12px'
	},
	content: { padding: '36px 32px 32px' },
	greeting: {
		margin: '0 0 14px',
		fontSize: '20px',
		fontWeight: 600,
		color: '#111111'
	},
	text: {
		margin: '0 0 24px',
		fontSize: '16px',
		lineHeight: '1.7',
		color: '#3f3f46'
	},
	codeBox: {
		margin: '0 0 24px',
		padding: '20px',
		backgroundColor: '#fafafa',
		borderRadius: '10px',
		textAlign: 'center'
	},
	codeLabel: {
		margin: '0 0 8px',
		fontSize: '11px',
		fontWeight: 600,
		color: '#71717a',
		textTransform: 'uppercase',
		letterSpacing: '0.06em'
	},
	code: {
		margin: '0',
		fontSize: '24px',
		letterSpacing: '4px',
		fontWeight: 700,
		color: '#111111'
	},
	hr: { borderColor: '#f0f0f2', margin: '24px 0' },
	muted: {
		margin: '0 0 8px',
		fontSize: '14px',
		lineHeight: '1.65',
		color: '#71717a'
	}
}

export default ModelIntakeConfirmationEmail
