import { createHmac, timingSafeEqual } from 'node:crypto'

import { eq, or } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { contactSubmissions } from '../../../db/schema'

interface ResendWebhookData {
	email_id?: string
}

interface ResendWebhookPayload {
	type: string
	created_at?: string
	data?: ResendWebhookData
}

const DELIVERY_SUCCESS_TYPES = new Set(['email.delivered'])
const DELIVERY_FAILURE_TYPES = new Set(['email.bounced', 'email.complained'])

function shouldSetFailed(currentStatus: string): boolean {
	return currentStatus !== 'failed'
}

function shouldSetPartial(currentStatus: string): boolean {
	return currentStatus !== 'failed' && currentStatus !== 'partial'
}

function resolveResendWebhookSecret(): string {
	const secret = process.env.RESEND_WEBHOOK_SECRET
	if (!secret) {
		throw new Error('RESEND_WEBHOOK_SECRET is not configured')
	}
	return secret
}

function decodeWebhookSecret(secret: string): Buffer {
	const encoded = secret.startsWith('whsec_') ? secret.slice(6) : secret
	return Buffer.from(encoded, 'base64')
}

function parseV1Signatures(signatureHeader: string): string[] {
	// Svix can send one or multiple signatures in the form: v1,<sig>
	// Some environments join repeated headers with whitespace.
	const entries = signatureHeader
		.split(/\s+/)
		.flatMap((entry) => entry.split(';'))
	return entries
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((entry) => {
			const [version, signature] = entry.split(',')
			if (version !== 'v1' || !signature) {
				return null
			}
			return signature
		})
		.filter((value): value is string => Boolean(value))
}

function verifySignature(args: {
	payload: string
	id: string
	timestamp: string
	signature: string
	secret: string
}) {
	const timestampSeconds = Number.parseInt(args.timestamp, 10)
	if (Number.isNaN(timestampSeconds)) {
		throw new Error('Invalid webhook timestamp')
	}

	const nowSeconds = Math.floor(Date.now() / 1000)
	const ageSeconds = Math.abs(nowSeconds - timestampSeconds)
	if (ageSeconds > 300) {
		throw new Error('Webhook timestamp is outside the allowed window')
	}

	const signedContent = `${args.id}.${args.timestamp}.${args.payload}`
	const secret = decodeWebhookSecret(args.secret)
	const digest = createHmac('sha256', secret)
		.update(signedContent)
		.digest('base64')

	const expected = Buffer.from(digest)
	const receivedSignatures = parseV1Signatures(args.signature)
	if (receivedSignatures.length === 0) {
		throw new Error('Missing v1 webhook signature')
	}

	const verified = receivedSignatures.some((candidate) => {
		const received = Buffer.from(candidate)
		if (received.length !== expected.length) {
			return false
		}
		return timingSafeEqual(received, expected)
	})

	if (!verified) {
		throw new Error('Invalid webhook signature')
	}
}

export function verifyResendWebhook(args: {
	payload: string
	headers: {
		id: string
		timestamp: string
		signature: string
	}
}): ResendWebhookPayload {
	verifySignature({
		payload: args.payload,
		id: args.headers.id,
		timestamp: args.headers.timestamp,
		signature: args.headers.signature,
		secret: resolveResendWebhookSecret()
	})

	return JSON.parse(args.payload) as ResendWebhookPayload
}

export async function processResendWebhookEvent(
	event: ResendWebhookPayload
): Promise<{
	ignored: boolean
	reason?: string
}> {
	const emailId = event.data?.email_id
	if (!emailId) {
		return { ignored: true, reason: 'missing_email_id' }
	}

	const db = getDbClient()
	const [submission] = await db
		.select({
			id: contactSubmissions.id,
			status: contactSubmissions.status,
			internalMessageId: contactSubmissions.internalMessageId,
			confirmationMessageId: contactSubmissions.confirmationMessageId
		})
		.from(contactSubmissions)
		.where(
			or(
				eq(contactSubmissions.internalMessageId, emailId),
				eq(contactSubmissions.confirmationMessageId, emailId)
			)
		)
		.limit(1)

	if (!submission) {
		return { ignored: true, reason: 'submission_not_found' }
	}

	const isInternalEmail = submission.internalMessageId === emailId
	const isConfirmationEmail = submission.confirmationMessageId === emailId

	if (DELIVERY_SUCCESS_TYPES.has(event.type)) {
		return { ignored: false }
	}

	if (DELIVERY_FAILURE_TYPES.has(event.type)) {
		if (isInternalEmail) {
			if (!shouldSetFailed(submission.status)) {
				return { ignored: false }
			}

			await db
				.update(contactSubmissions)
				.set({
					status: 'failed',
					failureStage: 'provider',
					updatedAt: new Date()
				})
				.where(eq(contactSubmissions.id, submission.id))
			return { ignored: false }
		}

		if (isConfirmationEmail) {
			if (!shouldSetPartial(submission.status)) {
				return { ignored: false }
			}

			await db
				.update(contactSubmissions)
				.set({
					status: 'partial',
					failureStage: 'provider',
					updatedAt: new Date()
				})
				.where(eq(contactSubmissions.id, submission.id))
			return { ignored: false }
		}
	}

	return { ignored: true, reason: 'unsupported_event_type' }
}
