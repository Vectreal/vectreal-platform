import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Link,
	Section,
	Text
} from '@react-email/components'
import * as React from 'react'

/**
 * The inbox's copy of a free-model request. Internal, so English only, and the
 * one place the brand's details are shown in plain text: the internal page
 * deliberately never decrypts them.
 */
export interface ModelIntakeInternalEmailProps {
	referenceCode: string
	name: string
	email: string
	company: string
	productType: string
	needsReview: boolean
	size: string
	batch: string
	locale: string
	message: string
	photoUrls: string[]
	intakePageUrl: string
}

export function ModelIntakeInternalEmail(props: ModelIntakeInternalEmailProps) {
	const rows: Array<[string, string]> = [
		['Reference', props.referenceCode],
		['Name', props.name],
		['Email', props.email],
		['Company', props.company],
		[
			'Product type',
			props.needsReview
				? `${props.productType} (review first)`
				: props.productType
		],
		['Size', props.size],
		['Batch', props.batch],
		['Language', props.locale],
		['Message', props.message || '(none)']
	]

	return (
		<Html lang="en" dir="ltr">
			<Head />
			<Body style={s.body}>
				<Container style={s.container}>
					<Heading as="h1" style={s.heading}>
						Free-model request {props.referenceCode}
					</Heading>
					<Section>
						{rows.map(([label, value]) => (
							<Text key={label} style={s.row}>
								<strong>{label}:</strong> {value}
							</Text>
						))}
					</Section>
					<Section>
						{props.photoUrls.map((url, index) => (
							<Text key={url} style={s.row}>
								<Link href={url}>Photo {index + 1}</Link> (link valid for 7
								days)
							</Text>
						))}
					</Section>
					<Text style={s.row}>
						<Link href={props.intakePageUrl}>Open the intake page</Link>
					</Text>
				</Container>
			</Body>
		</Html>
	)
}

const s: Record<string, React.CSSProperties> = {
	body: {
		margin: '0',
		backgroundColor: '#f4f4f5',
		fontFamily: "'Helvetica Neue', Arial, sans-serif"
	},
	container: {
		maxWidth: '600px',
		margin: '24px auto',
		padding: '24px',
		backgroundColor: '#ffffff'
	},
	heading: { margin: '0 0 16px', fontSize: '20px', color: '#111111' },
	row: { margin: '0 0 6px', fontSize: '14px', color: '#3f3f46' }
}

export default ModelIntakeInternalEmail
