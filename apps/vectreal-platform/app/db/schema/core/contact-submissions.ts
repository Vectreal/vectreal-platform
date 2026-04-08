import {
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'

import { users } from './users'

export const contactSubmissionStatusEnum = pgEnum('contact_submission_status', [
	'queued',
	'sent',
	'partial',
	'failed'
])

export const contactSubmissions = pgTable(
	'contact_submissions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		referenceCode: text('reference_code').notNull().unique(),
		userId: uuid('user_id').references(() => users.id, {
			onDelete: 'set null'
		}),
		source: text('source').notNull().default('direct'),
		isAuthenticated: boolean('is_authenticated').notNull().default(false),
		name: text('name').notNull(),
		email: text('email').notNull(),
		inquiryType: text('inquiry_type').notNull(),
		message: text('message').notNull(),
		status: contactSubmissionStatusEnum('status').notNull().default('queued'),
		failureStage: text('failure_stage'),
		provider: text('provider').notNull().default('resend'),
		internalMessageId: text('internal_message_id'),
		confirmationMessageId: text('confirmation_message_id'),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('contact_submissions_email_idx').on(table.email),
		index('contact_submissions_status_idx').on(table.status),
		index('contact_submissions_created_at_idx').on(table.createdAt)
	]
).enableRLS()
