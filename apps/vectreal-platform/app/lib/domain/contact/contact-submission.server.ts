import { eq } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'

import {
	CONTACT_HONEYPOT_FIELD,
	CONTACT_SOURCE_VALUES,
	type ContactActionData,
	type ContactInquiryType,
	type ContactSource
} from './contact-shared'
import { getDbClient } from '../../../db/client'
import { contactSubmissions } from '../../../db/schema'
import { encryptSensitiveValue } from '../../security/pii-encryption.server'

import type { PostHogContext } from '../../posthog/posthog-middleware'

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 5

const validInquiryTypes: ContactInquiryType[] = [
	'support',
	'sales',
	'partnership',
	'other'
]

const rateLimiter = new Map<string, number[]>()
let rateLimiterEvictCounter = 0
const RATE_LIMITER_EVICT_EVERY = 50

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

function getClientIp(request: Request): string {
	const cfIp = request.headers.get('cf-connecting-ip')
	if (cfIp) {
		return cfIp
	}

	const forwarded = request.headers.get('x-forwarded-for')
	if (forwarded) {
		return forwarded.split(',')[0]?.trim() || 'unknown'
	}

	return 'unknown'
}

function isRateLimited(key: string): boolean {
	const now = Date.now()
	const windowStart = now - RATE_LIMIT_WINDOW_MS
	const attempts = rateLimiter.get(key) ?? []
	const recentAttempts = attempts.filter((timestamp) => timestamp > windowStart)

	recentAttempts.push(now)
	rateLimiter.set(key, recentAttempts)

	// Periodically evict expired entries to prevent unbounded Map growth.
	rateLimiterEvictCounter += 1
	if (rateLimiterEvictCounter >= RATE_LIMITER_EVICT_EVERY) {
		rateLimiterEvictCounter = 0
		for (const [k, timestamps] of rateLimiter) {
			const fresh = timestamps.filter((t) => t > windowStart)
			if (fresh.length === 0) {
				rateLimiter.delete(k)
			} else {
				rateLimiter.set(k, fresh)
			}
		}
	}

	return recentAttempts.length > RATE_LIMIT_MAX_REQUESTS
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
		return 'other'
	} catch {
		return 'other'
	}
}

async function sendContactNotification(args: {
	to: string[]
	subject: string
	text: string
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
	const resendApiKey = process.env.RESEND_API_KEY
	const fromEmail =
		process.env.CONTACT_FROM_EMAIL ?? 'Vectreal <info@vectreal.com>'

	if (!resendApiKey) {
		if (process.env.NODE_ENV === 'production') {
			return {
				ok: false,
				error: 'Contact email provider is not configured.'
			}
		}

		console.warn(
			'[contact] RESEND_API_KEY not configured - skipping send in dev'
		)
		return { ok: true }
	}

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${resendApiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				from: fromEmail,
				to: args.to,
				subject: args.subject,
				text: args.text
			})
		})

		if (!response.ok) {
			const body = await response.text()
			return {
				ok: false,
				error: `Email provider error (${response.status}): ${body}`
			}
		}

		const payload = (await response.json()) as { id?: string }

		return { ok: true, messageId: payload.id }
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Unknown email provider error'

		return {
			ok: false,
			error: `Failed to send contact notification: ${message}`
		}
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

async function sendInternalContactNotification(args: {
	name: string
	email: string
	inquiryType: ContactInquiryType
	message: string
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
	const inboxEmail = process.env.CONTACT_INBOX_EMAIL ?? 'info@vectreal.com'

	return sendContactNotification({
		to: [inboxEmail],
		subject: `[Contact] ${args.inquiryType} inquiry from ${args.name}`,
		text: [
			`Name: ${args.name}`,
			`Email: ${args.email}`,
			`Inquiry type: ${args.inquiryType}`,
			'',
			args.message
		].join('\n')
	})
}

async function sendSubmitterConfirmation(args: {
	referenceCode: string
	email: string
	inquiryType: ContactInquiryType
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
	return sendContactNotification({
		to: [args.email],
		subject: `We received your message (${args.referenceCode})`,
		text: [
			`Thanks for contacting Vectreal.`,
			'',
			`Reference code: ${args.referenceCode}`,
			`Inquiry type: ${args.inquiryType}`,
			'',
			`Our team typically responds within one business day.`,
			`If needed, reply directly to info@vectreal.com and include your reference code.`
		].join('\n')
	})
}

function captureServerEvent(args: {
	context: unknown
	request: Request
	event: string
	properties: Record<string, string | number | boolean | null>
}) {
	const posthog = (args.context as PostHogContext).posthog
	if (!posthog) {
		return
	}

	const distinctId =
		args.request.headers.get('X-POSTHOG-DISTINCT-ID') ?? 'contact-anonymous'

	posthog.capture({
		distinctId,
		event: args.event,
		properties: args.properties
	})
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
		captureServerEvent({
			context: args.context,
			request: args.request,
			event: 'contact_form_blocked',
			properties: {
				block_reason: 'honeypot',
				inquiry_type: inquiryType,
				client_type: 'web'
			}
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
		captureServerEvent({
			context: args.context,
			request: args.request,
			event: 'contact_form_submit_failed',
			properties: {
				failure_stage: 'validation',
				inquiry_type: inquiryType,
				client_type: 'web'
			}
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

	const clientIp = getClientIp(args.request)
	const rateLimitKey = `${clientIp}:${email}`
	if (isRateLimited(rateLimitKey)) {
		captureServerEvent({
			context: args.context,
			request: args.request,
			event: 'contact_form_blocked',
			properties: {
				block_reason: 'rate_limit',
				inquiry_type: inquiryType,
				client_type: 'web'
			}
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
				captureServerEvent({
					context: args.context,
					request: args.request,
					event: 'contact_form_submit_failed',
					properties: {
						failure_stage: 'db',
						inquiry_type: inquiryType,
						client_type: 'web'
					}
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

		captureServerEvent({
			context: args.context,
			request: args.request,
			event: 'contact_form_submit_failed',
			properties: {
				failure_stage: 'provider',
				inquiry_type: inquiryType,
				client_type: 'web'
			}
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

		captureServerEvent({
			context: args.context,
			request: args.request,
			event: 'contact_form_submit_failed',
			properties: {
				failure_stage: 'provider',
				inquiry_type: inquiryType,
				error_code: 'confirmation_email_failed',
				client_type: 'web'
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

	captureServerEvent({
		context: args.context,
		request: args.request,
		event: 'contact_form_submitted',
		properties: {
			inquiry_type: inquiryType,
			delivery_channel: 'resend',
			response_time_bucket_ms: getResponseTimeBucket(Date.now() - requestStart),
			client_type: 'web',
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
