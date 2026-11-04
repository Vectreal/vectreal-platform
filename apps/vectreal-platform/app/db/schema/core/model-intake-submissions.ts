import {
	index,
	integer,
	pgEnum,
	pgTable,
	real,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'

import {
	MODEL_INTAKE_OUTCOMES,
	MODEL_INTAKE_STATUSES
} from '../../../lib/domain/model-intake/model-intake-shared'

export const modelIntakeStatusEnum = pgEnum(
	'model_intake_status',
	MODEL_INTAKE_STATUSES
)

export const modelIntakeOutcomeEnum = pgEnum(
	'model_intake_outcome',
	MODEL_INTAKE_OUTCOMES
)

/** Whether both notification emails left, as `contact_submissions` records it. */
export const modelIntakeEmailStatusEnum = pgEnum('model_intake_email_status', [
	'queued',
	'sent',
	'partial',
	'failed'
])

/**
 * One posted letter, by the code printed on its card. Only the organization is
 * kept here, for the form's greeting and the internal page; the person it was
 * addressed to stays in the CSV the QR script writes for the sender.
 */
export const modelIntakeLetters = pgTable('model_intake_letters', {
	code: text('code').primaryKey(),
	organization: text('organization').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true })
		.notNull()
		.defaultNow()
}).enableRLS()

/**
 * One free-model request: a brand's three photos and who sent them.
 *
 * Name, email, company and message are encrypted with `encryptSensitiveValue`,
 * as contact submissions are. The photos live in the private `model-intake`
 * bucket under `<id>/`, and `photoPaths` names them. `deleteAfter` is when the
 * purge script removes the row and its photos: receipt plus the retention
 * period, moved to delivery plus the period on delivery, and cleared when a
 * pilot is booked, because the pilot agreement then governs.
 */
export const modelIntakeSubmissions = pgTable(
	'model_intake_submissions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		referenceCode: text('reference_code').notNull().unique(),
		locale: text('locale').notNull(),
		batch: text('batch').notNull(),
		/** The letter the link came from, when it carried a code we posted. */
		letterCode: text('letter_code').references(() => modelIntakeLetters.code, {
			onDelete: 'set null'
		}),
		productType: text('product_type').notNull(),
		name: text('name').notNull(),
		email: text('email').notNull(),
		company: text('company').notNull(),
		message: text('message'),
		heightCm: real('height_cm'),
		widthCm: real('width_cm'),
		depthCm: real('depth_cm'),
		photoPaths: text('photo_paths').array().notNull(),
		consentVersion: text('consent_version').notNull(),
		consentFollowUpAt: timestamp('consent_follow_up_at', {
			withTimezone: true
		}).notNull(),
		consentPhotosAt: timestamp('consent_photos_at', {
			withTimezone: true
		}).notNull(),
		emailStatus: modelIntakeEmailStatusEnum('email_status')
			.notNull()
			.default('queued'),
		status: modelIntakeStatusEnum('status').notNull().default('received'),
		cleanupStartedAt: timestamp('cleanup_started_at', { withTimezone: true }),
		cleanupFinishedAt: timestamp('cleanup_finished_at', {
			withTimezone: true
		}),
		cleanupMinutes: integer('cleanup_minutes'),
		outcome: modelIntakeOutcomeEnum('outcome'),
		deliveredAt: timestamp('delivered_at', { withTimezone: true }),
		deleteAfter: timestamp('delete_after', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('model_intake_submissions_batch_idx').on(table.batch),
		index('model_intake_submissions_created_at_idx').on(table.createdAt),
		index('model_intake_submissions_delete_after_idx').on(table.deleteAfter)
	]
).enableRLS()
