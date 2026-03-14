import {
	index,
	json,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core'

/**
 * Idempotency key registry for billing webhook events.
 * Prevents double-processing of provider webhook payloads.
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
		uniqueIndex('billing_webhook_events_provider_event_id_uidx').on(
			table.provider,
			table.providerEventId
		),
		index('billing_webhook_events_status_idx').on(table.status),
		index('billing_webhook_events_created_at_idx').on(table.createdAt)
	]
)
