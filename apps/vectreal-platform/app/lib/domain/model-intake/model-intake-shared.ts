/*
  The free-model offer's rules: what it accepts, which letter batch a request
  came from, and what a request must carry. Client-safe and free of copy, so the
  form, the action, the emails and the internal page all read one definition.
  The words for every code below live in `MODEL_INTAKE_COPY` in
  `constants/product-copy.ts`.
*/

export const MODEL_INTAKE_LOCALES = ['en', 'de'] as const
export type ModelIntakeLocale = (typeof MODEL_INTAKE_LOCALES)[number]

/** `?lang=de` picks German; anything else is English. */
export function resolveIntakeLocale(raw: string | null): ModelIntakeLocale {
	return raw === 'de' ? 'de' : 'en'
}

/**
 * Accepted product types. Hard surfaces only, from the 15 to 18 Oct demo
 * timings; glass, enamel and cast iron are out because their cleanup runs long.
 * `other` is accepted but flagged for a look before any work starts.
 */
export const MODEL_INTAKE_PRODUCT_TYPES = [
	'furniture',
	'shoes',
	'bags',
	'electronics',
	'ceramics',
	'other'
] as const
export type ModelIntakeProductType = (typeof MODEL_INTAKE_PRODUCT_TYPES)[number]

export function isIntakeProductType(
	value: unknown
): value is ModelIntakeProductType {
	return MODEL_INTAKE_PRODUCT_TYPES.includes(value as ModelIntakeProductType)
}

/**
 * Letter batches, one QR code each. A closed list so a mistyped slug on a
 * letter cannot invent a batch nobody counts; adding a batch is a line here.
 */
export const MODEL_INTAKE_BATCHES = [
	'2026-10-30-brands',
	'2026-10-30-agencies',
	'2026-11-13-brands'
] as const
export type ModelIntakeBatch = (typeof MODEL_INTAKE_BATCHES)[number] | 'direct'

/** `?b=<slug>`: a listed batch, or `direct` for no code or an unknown one. */
export function resolveIntakeBatch(raw: string | null): ModelIntakeBatch {
	return MODEL_INTAKE_BATCHES.includes(
		raw as (typeof MODEL_INTAKE_BATCHES)[number]
	)
		? (raw as ModelIntakeBatch)
		: 'direct'
}

export const MODEL_INTAKE_PHOTO_COUNT = 3
export const MODEL_INTAKE_MAX_PHOTO_BYTES = 15 * 1024 * 1024

/** Three photos at the cap, plus room for the text fields and the multipart framing. */
const MODEL_INTAKE_MAX_BODY_BYTES =
	MODEL_INTAKE_PHOTO_COUNT * MODEL_INTAKE_MAX_PHOTO_BYTES + 1024 * 1024

/**
 * Whether a submit may be read at all, from its declared length.
 *
 * The body is buffered whole by `request.formData()` before CSRF or the bot
 * check can run, so the length is checked first, and a request that declares
 * none is refused: a browser always declares one for a form post, and a
 * chunked body with no length is the shape that would stream without limit.
 */
export function isIntakeBodyAcceptable(contentLength: string | null): boolean {
	if (contentLength === null || !/^\d+$/.test(contentLength)) return false
	return Number(contentLength) <= MODEL_INTAKE_MAX_BODY_BYTES
}
/** What the file input offers. The server checks the bytes, not this list. */
export const MODEL_INTAKE_PHOTO_ACCEPT =
	'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif'
export const MODEL_INTAKE_MIN_SIZE_CM = 1
export const MODEL_INTAKE_MAX_SIZE_CM = 500
export const MODEL_INTAKE_MAX_MESSAGE_LENGTH = 2000
export const MODEL_INTAKE_MAX_TEXT_LENGTH = 200

/** Deletion runs this long after delivery, or after receipt while undelivered. */
export const MODEL_INTAKE_RETENTION_DAYS = 90

/**
 * Bumped whenever the wording of either consent changes, so every stored
 * consent names the text it was given against.
 */
export const MODEL_INTAKE_CONSENT_VERSION = '2026-10-19'

export const MODEL_INTAKE_HONEYPOT_FIELD = 'website'

export const MODEL_INTAKE_SIZE_FIELDS = ['height', 'width', 'depth'] as const
export type ModelIntakeSizeField = (typeof MODEL_INTAKE_SIZE_FIELDS)[number]

export type ModelIntakeFieldErrorCode =
	| 'name'
	| 'email'
	| 'company'
	| 'productType'
	| 'photosCount'
	| 'photoType'
	| 'photoSize'
	| 'size'
	| 'message'
	| 'consent'

export type ModelIntakeFormErrorCode =
	'validation' | 'bot' | 'rateLimit' | 'server'

export interface ModelIntakeFieldErrors {
	name?: ModelIntakeFieldErrorCode
	email?: ModelIntakeFieldErrorCode
	company?: ModelIntakeFieldErrorCode
	productType?: ModelIntakeFieldErrorCode
	/** The photo a per-file error is about, 1-based, travels in `photoIndex`. */
	photos?: ModelIntakeFieldErrorCode
	photoIndex?: number
	size?: ModelIntakeFieldErrorCode
	message?: ModelIntakeFieldErrorCode
	consentFollowUp?: ModelIntakeFieldErrorCode
	consentPhotos?: ModelIntakeFieldErrorCode
}

/** What a failed submit hands back so the form keeps what was typed. Photos cannot be refilled. */
export interface ModelIntakeFields {
	name: string
	email: string
	company: string
	productType: string
	height: string
	width: string
	depth: string
	message: string
}

export type ModelIntakeActionData =
	| { status: 'success'; referenceCode?: string; confirmationFailed?: boolean }
	| {
			status: 'error'
			formError: ModelIntakeFormErrorCode
			fieldErrors?: ModelIntakeFieldErrors
			fields?: ModelIntakeFields
	  }

export interface ModelIntakeSize {
	heightCm: number | null
	widthCm: number | null
	depthCm: number | null
}

/** One size field: empty is allowed, otherwise a number of centimeters in range. */
export function parseIntakeSizeCm(raw: string): number | null | 'invalid' {
	const trimmed = raw.trim().replace(',', '.')
	if (trimmed === '') return null
	if (!/^\d+(\.\d+)?$/.test(trimmed)) return 'invalid'
	const value = Number(trimmed)
	return value >= MODEL_INTAKE_MIN_SIZE_CM && value <= MODEL_INTAKE_MAX_SIZE_CM
		? value
		: 'invalid'
}

export interface ModelIntakeTextInput extends ModelIntakeFields {
	consentFollowUp: boolean
	consentPhotos: boolean
}

export interface ModelIntakeValidated {
	name: string
	email: string
	company: string
	productType: ModelIntakeProductType
	size: ModelIntakeSize
	message: string
}

/**
 * Every rule on the typed fields, without the photos (which need their bytes).
 * Pure, so a spec reaches each refusal without a request.
 */
export function validateIntakeFields(
	input: ModelIntakeTextInput
):
	| { ok: true; value: ModelIntakeValidated }
	| { ok: false; fieldErrors: ModelIntakeFieldErrors } {
	const fieldErrors: ModelIntakeFieldErrors = {}
	const name = input.name.trim()
	const email = input.email.trim().toLowerCase()
	const company = input.company.trim()
	const message = input.message.trim()

	// The name is repeated in the confirmation sent to the given address, so it
	// may carry no link or markup: otherwise anyone could mail a stranger a URL
	// in our name.
	if (
		name.length < 2 ||
		name.length > MODEL_INTAKE_MAX_TEXT_LENGTH ||
		/[<>@:/]|www\./i.test(name)
	) {
		fieldErrors.name = 'name'
	}
	if (
		email.length > MODEL_INTAKE_MAX_TEXT_LENGTH ||
		!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
	) {
		fieldErrors.email = 'email'
	}
	if (company.length < 2 || company.length > MODEL_INTAKE_MAX_TEXT_LENGTH) {
		fieldErrors.company = 'company'
	}
	if (!isIntakeProductType(input.productType)) {
		fieldErrors.productType = 'productType'
	}
	if (message.length > MODEL_INTAKE_MAX_MESSAGE_LENGTH) {
		fieldErrors.message = 'message'
	}
	if (!input.consentFollowUp) fieldErrors.consentFollowUp = 'consent'
	if (!input.consentPhotos) fieldErrors.consentPhotos = 'consent'

	const height = parseIntakeSizeCm(input.height)
	const width = parseIntakeSizeCm(input.width)
	const depth = parseIntakeSizeCm(input.depth)
	if (height === 'invalid' || width === 'invalid' || depth === 'invalid') {
		fieldErrors.size = 'size'
	}

	if (Object.keys(fieldErrors).length > 0) {
		return { ok: false, fieldErrors }
	}

	return {
		ok: true,
		value: {
			name,
			email,
			company,
			productType: input.productType as ModelIntakeProductType,
			size: {
				heightCm: height as number | null,
				widthCm: width as number | null,
				depthCm: depth as number | null
			},
			message
		}
	}
}

/** The internal page's lifecycle. Deletion is not a status: a deleted request is gone. */
export const MODEL_INTAKE_STATUSES = [
	'received',
	'in_cleanup',
	'delivered',
	'pilot_booked'
] as const
export type ModelIntakeStatus = (typeof MODEL_INTAKE_STATUSES)[number]

export const MODEL_INTAKE_OUTCOMES = ['usable', 'unusable'] as const
export type ModelIntakeOutcome = (typeof MODEL_INTAKE_OUTCOMES)[number]

/** Whole minutes between two instants, never negative. */
export function cleanupMinutesBetween(start: Date, finish: Date): number {
	return Math.max(0, Math.round((finish.getTime() - start.getTime()) / 60_000))
}

export function addRetentionDays(from: Date): Date {
	return new Date(from.getTime() + MODEL_INTAKE_RETENTION_DAYS * 86_400_000)
}

export function buildIntakeUrl(
	origin: string,
	batch: (typeof MODEL_INTAKE_BATCHES)[number],
	locale: ModelIntakeLocale
): string {
	const url = new URL('/free-model', origin)
	url.searchParams.set('b', batch)
	if (locale === 'de') url.searchParams.set('lang', 'de')
	return url.toString()
}
