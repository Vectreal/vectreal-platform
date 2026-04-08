import { ApiResponse } from '@shared/utils'

import { Route } from './+types/webhook'
import {
	processResendWebhookEvent,
	verifyResendWebhook
} from '../../../lib/domain/contact/resend-webhook-processor.server'

export async function action({ request }: Route.ActionArgs): Promise<Response> {
	if (request.method !== 'POST') {
		return ApiResponse.methodNotAllowed()
	}

	const id = request.headers.get('svix-id')
	const timestamp = request.headers.get('svix-timestamp')
	const signature = request.headers.get('svix-signature')

	if (!id || !timestamp || !signature) {
		return ApiResponse.badRequest('Missing webhook signature headers')
	}

	let payload: string
	try {
		payload = await request.text()
	} catch {
		return ApiResponse.badRequest('Failed to read request body')
	}

	let event
	try {
		event = verifyResendWebhook({
			payload,
			headers: { id, timestamp, signature }
		})
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Invalid webhook signature'
		console.warn('[contact/webhook] signature verification failed', { message })
		return ApiResponse.error('Invalid webhook signature', 400)
	}

	try {
		const result = await processResendWebhookEvent(event)
		if (result.ignored) {
			console.debug('[contact/webhook] event ignored', {
				eventType: event.type,
				reason: result.reason
			})
		} else {
			console.info('[contact/webhook] event processed', {
				eventType: event.type,
				emailId: event.data?.email_id
			})
		}

		return ApiResponse.success({ received: true })
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Internal processing error'
		console.error('[contact/webhook] processing failed', {
			eventType: event.type,
			message
		})
		return ApiResponse.serverError(message)
	}
}
