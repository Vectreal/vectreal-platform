export const CONTACT_HONEYPOT_FIELD = 'website'

export const CONTACT_SOURCE_VALUES = [
	'direct',
	'pricing_cta',
	'footer',
	'other'
] as const

export type ContactSource = (typeof CONTACT_SOURCE_VALUES)[number]

export type ContactInquiryType = 'support' | 'sales' | 'partnership' | 'other'

export interface ContactActionData {
	status: 'idle' | 'success' | 'error'
	referenceCode?: string
	notice?: string
	formError?: string
	fieldErrors?: {
		name?: string
		email?: string
		inquiryType?: string
		message?: string
	}
	fields?: {
		name: string
		email: string
		inquiryType: ContactInquiryType
		message: string
	}
}
