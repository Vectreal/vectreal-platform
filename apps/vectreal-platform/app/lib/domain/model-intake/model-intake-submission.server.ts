import { randomBytes, randomUUID } from 'node:crypto'

import { prepareIntakePhotos } from './model-intake-photos.server'
import {
	deleteIntakeRow,
	insertIntakeSubmission,
	setIntakeEmailStatus,
	type NewModelIntakeRow
} from './model-intake-repository.server'
import {
	addRetentionDays,
	MODEL_INTAKE_CONSENT_VERSION,
	MODEL_INTAKE_HONEYPOT_FIELD,
	MODEL_INTAKE_SIZE_FIELDS,
	type ModelIntakeActionData,
	type ModelIntakeBatch,
	type ModelIntakeFields,
	type ModelIntakeLocale,
	type ModelIntakeSize,
	validateIntakeFields
} from './model-intake-shared'
import {
	deleteIntakePhotos,
	intakePhotoPaths,
	MODEL_INTAKE_EMAIL_LINK_SECONDS,
	signIntakePhotoUrls,
	uploadIntakePhotos
} from './model-intake-storage.server'
import { MODEL_INTAKE_COPY } from '../../../constants/product-copy'
import {
	sendIntakeConfirmation,
	sendIntakeInternalNotification
} from '../../email/model-intake-email-sender.server'
import { recordRateLimitAttempt } from '../../http/rate-limit.server'
import { encryptSensitiveValue } from '../../security/pii-encryption.server'

/** Three requests per address per hour: a brand sends one product, maybe two. */
const MODEL_INTAKE_RATE_LIMIT = {
	bucket: 'model-intake',
	maxRequests: 3,
	windowMs: 60 * 60 * 1000
} as const

export interface ModelIntakeSubmitResult {
	status: number
	body: ModelIntakeActionData
	/** What happened, for the route's analytics event. Never shown. */
	outcome:
		'submitted' | 'honeypot' | 'validation' | 'rate_limit' | 'storage' | 'db'
}

/** Everything with a side effect, so a spec runs the real flow on fakes. */
export const modelIntakeDeps = {
	now: () => new Date(),
	newId: (): string => randomUUID(),
	newReferenceCode: () =>
		`VCTR-${randomBytes(4).toString('hex').toUpperCase()}`,
	isRateLimited: (request: Request) =>
		recordRateLimitAttempt(request, MODEL_INTAKE_RATE_LIMIT).limited,
	prepareIntakePhotos,
	uploadIntakePhotos,
	deleteIntakePhotos,
	signIntakePhotoUrls,
	insertIntakeSubmission,
	deleteIntakeRow,
	setIntakeEmailStatus,
	sendIntakeInternalNotification,
	sendIntakeConfirmation,
	encrypt: encryptSensitiveValue
}

export type ModelIntakeDeps = typeof modelIntakeDeps

function text(formData: FormData, key: string): string {
	const value = formData.get(key)
	return typeof value === 'string' ? value : ''
}

function readFields(formData: FormData): ModelIntakeFields {
	return {
		name: text(formData, 'name'),
		email: text(formData, 'email'),
		company: text(formData, 'company'),
		productType: text(formData, 'productType'),
		height: text(formData, 'height'),
		width: text(formData, 'width'),
		depth: text(formData, 'depth'),
		message: text(formData, 'message')
	}
}

/** Empty file inputs arrive as zero-byte files; they are not photos. */
function readPhotos(formData: FormData): File[] {
	return formData
		.getAll('photos')
		.filter((entry): entry is File => entry instanceof File && entry.size > 0)
}

function describeSize(size: ModelIntakeSize): string {
	const parts = MODEL_INTAKE_SIZE_FIELDS.map((field) => {
		const value = size[`${field}Cm`]
		return value === null ? null : `${field[0].toUpperCase()} ${value} cm`
	}).filter(Boolean)
	return parts.length > 0 ? parts.join(' x ') : '(not given)'
}

/**
 * Records one free-model request: checks it, stores the photos and the row,
 * then tells the inbox and the brand.
 *
 * Bot verification and CSRF are the route's, before this runs. The row is
 * written before the photos, naming the paths they will have, so no photo is
 * ever stored without a row: the purge walks rows, and a photo no row named
 * would outlive the retention period. A failed upload removes the row again;
 * a crash between the two leaves a row with a `deleteAfter`, which the purge
 * clears with whatever photos did arrive.
 */
export async function submitModelIntake(
	args: {
		request: Request
		formData: FormData
		locale: ModelIntakeLocale
		batch: ModelIntakeBatch
		intakePageUrl: string
	},
	deps: ModelIntakeDeps = modelIntakeDeps
): Promise<ModelIntakeSubmitResult> {
	const { formData, locale, batch } = args
	const fields = readFields(formData)

	// Answered like a success so a bot learns nothing from the reply.
	if (text(formData, MODEL_INTAKE_HONEYPOT_FIELD).trim().length > 0) {
		return { status: 200, body: { status: 'success' }, outcome: 'honeypot' }
	}

	const validated = validateIntakeFields({
		...fields,
		consentFollowUp: formData.get('consentFollowUp') === 'on',
		consentPhotos: formData.get('consentPhotos') === 'on'
	})
	const photos = await deps.prepareIntakePhotos(readPhotos(formData))

	if (!validated.ok || !photos.ok) {
		return {
			status: 400,
			body: {
				status: 'error',
				formError: 'validation',
				fieldErrors: {
					...(validated.ok ? {} : validated.fieldErrors),
					...(photos.ok ? {} : photos.fieldErrors)
				},
				fields
			},
			outcome: 'validation'
		}
	}

	if (deps.isRateLimited(args.request)) {
		return {
			status: 429,
			body: { status: 'error', formError: 'rateLimit', fields },
			outcome: 'rate_limit'
		}
	}

	const value = validated.value
	const id = deps.newId()
	const referenceCode = deps.newReferenceCode()
	const now = deps.now()
	const serverError = (outcome: ModelIntakeSubmitResult['outcome']) => ({
		status: 500,
		body: { status: 'error' as const, formError: 'server' as const, fields },
		outcome
	})

	const row: NewModelIntakeRow = {
		id,
		referenceCode,
		locale,
		batch,
		productType: value.productType,
		name: deps.encrypt(value.name),
		email: deps.encrypt(value.email),
		company: deps.encrypt(value.company),
		message: value.message ? deps.encrypt(value.message) : null,
		heightCm: value.size.heightCm,
		widthCm: value.size.widthCm,
		depthCm: value.size.depthCm,
		photoPaths: intakePhotoPaths(id, photos.photos),
		consentVersion: MODEL_INTAKE_CONSENT_VERSION,
		consentFollowUpAt: now,
		consentPhotosAt: now,
		// Undelivered requests are not kept indefinitely either.
		deleteAfter: addRetentionDays(now)
	}

	try {
		await deps.insertIntakeSubmission(row)
	} catch {
		return serverError('db')
	}

	try {
		await deps.uploadIntakePhotos(id, photos.photos)
	} catch {
		/*
		  The row goes only once every photo it names is gone. If removing them
		  fails too, the row stays: its `deleteAfter` lets the purge finish the
		  job, where a photo with no row would never be found again.
		*/
		try {
			await deps.deleteIntakePhotos(row.photoPaths)
			await deps.deleteIntakeRow(id)
		} catch {
			// Left for the purge, as above.
		}
		return serverError('storage')
	}

	const photoUrls = await deps
		.signIntakePhotoUrls(row.photoPaths, MODEL_INTAKE_EMAIL_LINK_SECONDS)
		.catch(() => [])
	const internal = await deps.sendIntakeInternalNotification({
		referenceCode,
		name: value.name,
		email: value.email,
		company: value.company,
		productType:
			MODEL_INTAKE_COPY.en.fields.productType.options[value.productType],
		needsReview: value.productType === 'other',
		size: describeSize(value.size),
		batch,
		locale,
		message: value.message,
		photoUrls,
		intakePageUrl: args.intakePageUrl
	})

	const confirmation = await deps.sendIntakeConfirmation({
		locale,
		email: value.email,
		displayName: value.name,
		referenceCode
	})
	/*
	  The request is stored either way, and the internal page lists it with this
	  status, so a failed alert is not the brand's problem to solve by emailing
	  the photos again.
	*/
	// Bookkeeping only: the request is saved and confirmed, so a failure here
	// must not tell the brand otherwise and invite a duplicate.
	await deps
		.setIntakeEmailStatus(
			id,
			internal.ok && confirmation.ok
				? 'sent'
				: internal.ok || confirmation.ok
					? 'partial'
					: 'failed'
		)
		.catch(() => {})

	return {
		status: 200,
		body: {
			status: 'success',
			referenceCode,
			confirmationFailed: !confirmation.ok
		},
		outcome: 'submitted'
	}
}
