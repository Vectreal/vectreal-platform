import { randomBytes } from 'node:crypto'

import { eq } from 'drizzle-orm'

import {
	CONTACT_HONEYPOT_FIELD,
	CONTACT_SOURCE_VALUES,
	type ContactActionData,
	type ContactInquiryType,
	type ContactSource
} from './contact-shared'
import { getDbClient } from '../../../db/client'
import { contactSubmissions } from '../../../db/schema'
import {
	sendInternalContactNotification,
	sendSubmitterConfirmation
} from '../../email/contact-email-sender.server'
import { recordRateLimitAttempt } from '../../http/rate-limit.server'
import { encryptSensitiveValue } from '../../security/pii-encryption.server'
import {
	captureServerEvent,
	type ServerAnalyticsEvent
} from '../analytics/server-events.server'

import type { PostHogContext } from '../../posthog/posthog-middleware'

/** Five submissions per address per ten minutes, as before. */
const CONTACT_RATE_LIMIT = {
	bucket: 'contact-form',
	maxRequests: 5,
	windowMs: 10 * 60 * 1000
} as const

const validInquiryTypes: ContactInquiryType[] = [
	'support',
	'sales',
	'partnership',
	'other'
]

export interface ContactSubmitResult {
	status: number
	body: ContactActionData
}

function normalizeEmail(input: FormDataEntryValue | null): string {
	if (typeof input !== 'string') {
		return ''
	}

	return input.trim().toLowerCase()
}

function normalizeText(input: FormDataEntryValue | null): string {
	if (typeof input !== 'string') {
		return ''
	}

	return input.trim()
}

function parseInquiryType(
	input: FormDataEntryValue | null
): ContactInquiryType {
	if (typeof input !== 'string') {
		return 'support'
	}

	return validInquiryTypes.includes(input as ContactInquiryType)
		? (input as ContactInquiryType)
		: 'support'
}

export function buildContactSource(request: Request): ContactSource {
	const url = new URL(request.url)
	const explicitSource = url.searchParams.get('source')
	if (CONTACT_SOURCE_VALUES.includes(explicitSource as ContactSource)) {
		return explicitSource as ContactSource
	}
	const referer = request.headers.get('referer')
	if (!referer) {
		return 'direct'
	}

	try {
		const refererUrl = new URL(referer)
		if (refererUrl.pathname.startsWith('/pricing')) {
			return 'pricing_cta'
		}
		if (refererUrl.pathname.includes('footer')) {
			return 'footer'
		}
		return 'other'
	} catch {
		return 'other'
	}
}

function buildReferenceCode() {
	const suffix = randomBytes(4).toString('hex').toUpperCase()
	return `VCTR-${suffix}`
}

function getResponseTimeBucket(durationMs: number) {
	if (durationMs < 250) return 'lt_250ms'
	if (durationMs < 1000) return '250ms_1s'
	if (durationMs < 3000) return '1s_3s'
	return 'gte_3s'
}

function fireEvent(
	context: unknown,
	request: Request,
	event: ServerAnalyticsEvent
) {
	const posthog = (context as PostHogContext).posthog
	const distinctId =
		request.headers.get('X-POSTHOG-DISTINCT-ID') ?? 'contact-anonymous'
	captureServerEvent(posthog, request, distinctId, event)
}

export async function submitContactForm(args: {
	request: Request
	context: unknown
	formData: FormData
	userId: string | null
	isAuthenticated: boolean
	source: ContactSource
}): Promise<ContactSubmitResult> {
	const requestStart = Date.now()

	const name = normalizeText(args.formData.get('name'))
	const email = normalizeEmail(args.formData.get('email'))
	const message = normalizeText(args.formData.get('message'))
	const inquiryType = parseInquiryType(args.formData.get('inquiryType'))
	const honeypotValue = normalizeText(args.formData.get(CONTACT_HONEYPOT_FIELD))

	const fields = {
		name,
		email,
		inquiryType,
		message
	}

	if (honeypotValue.length > 0) {
		fireEvent(args.context, args.request, {
			name: 'contact_form_blocked',
			props: { block_reason: 'honeypot', inquiry_type: inquiryType }
		})

		return { status: 200, body: { status: 'success' } }
	}

	const fieldErrors: ContactActionData['fieldErrors'] = {}

	if (name.length < 2) {
		fieldErrors.name = 'Please enter your name.'
	}

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		fieldErrors.email = 'Please provide a valid email address.'
	}

	if (!validInquiryTypes.includes(inquiryType)) {
		fieldErrors.inquiryType = 'Please select a valid inquiry type.'
	}

	if (message.length < 10) {
		fieldErrors.message = 'Please add at least 10 characters.'
	}

	if (message.length > 4000) {
		fieldErrors.message = 'Please keep the message under 4000 characters.'
	}

	if (Object.keys(fieldErrors).length > 0) {
		fireEvent(args.context, args.request, {
			name: 'contact_form_submit_failed',
			props: { failure_stage: 'validation', inquiry_type: inquiryType }
		})

		return {
			status: 400,
			body: {
				status: 'error',
				formError: 'Please fix the highlighted fields.',
				fieldErrors,
				fields
			}
		}
	}

	// Keyed on the address as well as the caller, as it was before: one person
	// legitimately writing about two things should not be blocked by their own
	// first message.
	const rateLimit = recordRateLimitAttempt(args.request, {
		...CONTACT_RATE_LIMIT,
		keyParts: [email]
	})
	if (rateLimit.limited) {
		fireEvent(args.context, args.request, {
			name: 'contact_form_blocked',
			props: { block_reason: 'rate_limit', inquiry_type: inquiryType }
		})

		return {
			status: 429,
			body: {
				status: 'error',
				formError:
					'Too many requests from this address. Please wait a few minutes and try again.',
				fields
			}
		}
	}

	const db = getDbClient()

	let submission: { id: string; referenceCode: string } | undefined
	const MAX_INSERT_ATTEMPTS = 3
	for (let attempt = 1; attempt <= MAX_INSERT_ATTEMPTS; attempt++) {
		const referenceCode = buildReferenceCode()
		try {
			const [row] = await db
				.insert(contactSubmissions)
				.values({
					referenceCode,
					userId: args.userId,
					source: args.source,
					isAuthenticated: args.isAuthenticated,
					name: encryptSensitiveValue(name),
					email: encryptSensitiveValue(email),
					inquiryType,
					message: encryptSensitiveValue(message),
					status: 'queued'
				})
				.returning({
					id: contactSubmissions.id,
					referenceCode: contactSubmissions.referenceCode
				})
			submission = row
			break
		} catch (insertError) {
			const isUniqueViolation =
				insertError instanceof Error &&
				insertError.message.includes('unique constraint')
			if (!isUniqueViolation || attempt === MAX_INSERT_ATTEMPTS) {
				fireEvent(args.context, args.request, {
					name: 'contact_form_submit_failed',
					props: { failure_stage: 'db', inquiry_type: inquiryType }
				})
				return {
					status: 500,
					body: {
						status: 'error',
						formError:
							'We could not record your message right now. Please email info@vectreal.com directly.',
						fields
					}
				}
			}
		}
	}

	if (!submission) {
		// This should not be reached: the loop above always either assigns
		// submission on break or returns early. Guard for type-safety.
		return {
			status: 500,
			body: {
				status: 'error',
				formError:
					'We could not record your message right now. Please email info@vectreal.com directly.',
				fields
			}
		}
	}

	const sendResult = await sendInternalContactNotification({
		name,
		email,
		message,
		inquiryType
	})

	if (!sendResult.ok) {
		await db
			.update(contactSubmissions)
			.set({
				status: 'failed',
				failureStage: 'provider',
				updatedAt: new Date()
			})
			.where(eq(contactSubmissions.id, submission.id))

		fireEvent(args.context, args.request, {
			name: 'contact_form_submit_failed',
			props: { failure_stage: 'provider', inquiry_type: inquiryType }
		})

		return {
			status: 502,
			body: {
				status: 'error',
				formError:
					'We could not submit your message right now. Please email info@vectreal.com directly.',
				fields
			}
		}
	}

	const confirmationResult = await sendSubmitterConfirmation({
		displayName: name,
		referenceCode: submission.referenceCode,
		email,
		inquiryType
	})

	if (!confirmationResult.ok) {
		await db
			.update(contactSubmissions)
			.set({
				status: 'partial',
				failureStage: 'provider',
				provider: 'resend',
				internalMessageId: sendResult.messageId ?? null,
				updatedAt: new Date()
			})
			.where(eq(contactSubmissions.id, submission.id))

		fireEvent(args.context, args.request, {
			name: 'contact_form_submit_failed',
			props: {
				failure_stage: 'provider',
				inquiry_type: inquiryType,
				error_code: 'confirmation_email_failed'
			}
		})
	}

	if (confirmationResult.ok) {
		await db
			.update(contactSubmissions)
			.set({
				status: 'sent',
				provider: 'resend',
				internalMessageId: sendResult.messageId ?? null,
				confirmationMessageId: confirmationResult.messageId ?? null,
				updatedAt: new Date()
			})
			.where(eq(contactSubmissions.id, submission.id))
	}

	fireEvent(args.context, args.request, {
		name: 'contact_form_submitted',
		props: {
			inquiry_type: inquiryType,
			delivery_channel: 'resend',
			response_time_bucket_ms: getResponseTimeBucket(Date.now() - requestStart),
			anti_bot_mode: 'csrf_honeypot_rate_limit'
		}
	})

	return {
		status: 200,
		body: {
			status: 'success',
			referenceCode: submission.referenceCode,
			notice: confirmationResult.ok
				? undefined
				: 'Your request was received, but we could not send the confirmation email. Keep your reference code for follow-up.'
		}
	}
}
