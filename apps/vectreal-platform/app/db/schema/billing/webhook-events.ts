import {
	index,
	json,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'

/**
 * Idempotency key registry for billing webhook events.
 * Prevents double-processing of provider webhook payloads.
 *
 * Keys are scoped to a provider + event ID pair and expire after a
 * retention window to keep the table small.
 */
export const billingWebhookEventStatusEnum = pgEnum(
	'billing_webhook_event_status',
	['pending', 'processed', 'failed']
)

export const billingWebhookEvents = pgTable(
	'billing_webhook_events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** Billing provider name, e.g. "stripe". */
		provider: text('provider').notNull(),
		/** Provider-assigned event ID used for idempotency. */
		providerEventId: text('provider_event_id').notNull(),
		/** Webhook event type, e.g. "invoice.payment_succeeded". */
		eventType: text('event_type').notNull(),
		status: billingWebhookEventStatusEnum('status')
			.notNull()
			.default('pending'),
		/** Raw event payload stored for audit / replay. */
		payload: json('payload'),
		errorMessage: text('error_message'),
		processedAt: timestamp('processed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('billing_webhook_events_provider_event_id_idx').on(
			table.provider,
			table.providerEventId
		),
		index('billing_webhook_events_status_idx').on(table.status),
		index('billing_webhook_events_created_at_idx').on(table.createdAt)
	]
)
