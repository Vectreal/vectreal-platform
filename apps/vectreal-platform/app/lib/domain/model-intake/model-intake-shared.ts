/*
  The free-model offer's rules: what it accepts, which letter batch a request
  came from, and what a request must carry. Client-safe and free of copy, so the
  form, the action, the emails and the internal page all read one definition.
  The words for every code below live in `MODEL_INTAKE_COPY` in
  `constants/product-copy.ts`.
*/

export const MODEL_INTAKE_PATH = '/free-model'

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

/**
 * Whom a letter was written to: a brand, whose code opens its category's
 * sample-store page, or an agency, whose code opens the agency page. A closed
 * list for the same reason as the batches.
 */
export const MODEL_INTAKE_AUDIENCES = ['brand', 'agency'] as const
export type ModelIntakeAudience = (typeof MODEL_INTAKE_AUDIENCES)[number]

export function isIntakeAudience(value: unknown): value is ModelIntakeAudience {
	return MODEL_INTAKE_AUDIENCES.includes(value as ModelIntakeAudience)
}

/**
 * The sample-store product a brand letter's card shows and its QR code opens.
 * Separate from the category, which is the form's product type: a shoe brand
 * may well be shown the lamp.
 */
export const MODEL_INTAKE_SHOWCASES = [
	'lamp',
	'fire',
	'coffee',
	'furniture'
] as const
export type ModelIntakeShowcase = (typeof MODEL_INTAKE_SHOWCASES)[number]

export function isIntakeShowcase(value: unknown): value is ModelIntakeShowcase {
	return MODEL_INTAKE_SHOWCASES.includes(value as ModelIntakeShowcase)
}

export type IntakeStorePages = Partial<Record<ModelIntakeShowcase, string>>

/**
 * `MODEL_INTAKE_STORE_PAGES`, as `lamp=https://…,fire=https://…`: the store
 * page for each showcase. Unset or empty is no pages, so every brand letter
 * opens the form. Anything malformed refuses the whole value rather than
 * routing some letters and not others.
 */
export function parseIntakeStorePages(
	raw: string | undefined
): { ok: true; pages: IntakeStorePages } | { ok: false; error: string } {
	const pages: IntakeStorePages = {}
	for (const entry of (raw ?? '').split(',')) {
		if (entry.trim() === '') continue
		const separator = entry.indexOf('=')
		const showcase = entry.slice(0, separator).trim()
		const page = entry.slice(separator + 1).trim()
		if (separator < 0 || !isIntakeShowcase(showcase)) {
			return {
				ok: false,
				error: `"${entry.trim()}" does not start with a showcase (${MODEL_INTAKE_SHOWCASES.join(', ')}) and "=".`
			}
		}
		if (!URL.canParse(page) || new URL(page).protocol !== 'https:') {
			return { ok: false, error: `The ${showcase} page is not an https URL.` }
		}
		pages[showcase] = page
	}
	return { ok: true, pages }
}

/**
 * An agency sends its client's photos, not its own, so a request from an
 * agency letter also confirms the client agreed. Decided by the letter the
 * server looked up, never by anything the form posts.
 */
export function intakeLetterAsksClientConsent(
	letter: { audience: ModelIntakeAudience } | null
): boolean {
	return letter?.audience === 'agency'
}

/** The page an agency letter's short address opens. German only, like the agency letters. */
export const MODEL_INTAKE_AGENCY_PAGE_PATH = '/agenturen'

/**
 * `?c=<code>`: the one letter a link was printed for. Opaque on purpose, so the
 * URL names no organization or person; the code is looked up on the server.
 */
export const MODEL_INTAKE_LETTER_PARAM = 'c'

/**
 * What a letter code is made of: no 0, O, 1, I or L, so a code read off the
 * card is typed back the way it was printed. Eight of these are about 850
 * billion codes, which no one walks through to learn whom we wrote to.
 */
export const MODEL_INTAKE_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const MODEL_INTAKE_CODE_LENGTH = 8

const LETTER_CODE_PATTERN = new RegExp(
	`^[${MODEL_INTAKE_CODE_ALPHABET}]{${MODEL_INTAKE_CODE_LENGTH}}$`
)

/** A printed letter code as typed: case and surrounding spaces do not matter. */
export function normalizeIntakeLetterCode(raw: string | null): string | null {
	const code = raw?.trim().toUpperCase() ?? ''
	return LETTER_CODE_PATTERN.test(code) ? code : null
}

/** A fresh code from the CSPRNG, by rejection so every character is equally likely. */
export function mintIntakeLetterCode(): string {
	const size = MODEL_INTAKE_CODE_ALPHABET.length
	const ceiling = 256 - (256 % size)
	let code = ''
	while (code.length < MODEL_INTAKE_CODE_LENGTH) {
		for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
			if (byte < ceiling && code.length < MODEL_INTAKE_CODE_LENGTH) {
				code += MODEL_INTAKE_CODE_ALPHABET[byte % size]
			}
		}
	}
	return code
}

/**
 * The short address a letter's QR code encodes and its card prints:
 * `/c/<code>`, which records the scan and forwards the reader.
 */
export const MODEL_INTAKE_SHORT_LINK_PREFIX = '/c/'

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
 * Bumped whenever the wording of any consent changes, or one is added, so every
 * stored consent names the text it was given against.
 */
export const MODEL_INTAKE_CONSENT_VERSION = '2026-11-10'

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
	consentClient?: ModelIntakeFieldErrorCode
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
	/** Whether this request must carry `consentClient`: see `intakeLetterAsksClientConsent`. */
	asksClientConsent: boolean
	consentClient: boolean
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
	if (input.asksClientConsent && !input.consentClient) {
		fieldErrors.consentClient = 'consent'
	}

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
	const url = new URL(MODEL_INTAKE_PATH, origin)
	url.searchParams.set('b', batch)
	if (locale === 'de') url.searchParams.set('lang', 'de')
	return url.toString()
}

/** The form for one letter's reader: `/free-model?c=<code>`, in the letter's language. */
export function intakeLetterFormPath(
	code: string,
	locale: ModelIntakeLocale
): string {
	const search = new URLSearchParams({ [MODEL_INTAKE_LETTER_PARAM]: code })
	if (locale === 'de') search.set('lang', 'de')
	return `/free-model?${search.toString()}`
}

export function buildIntakeShortUrl(origin: string, code: string): string {
	return new URL(`${MODEL_INTAKE_SHORT_LINK_PREFIX}${code}`, origin).toString()
}

/**
 * Where `/c/<code>` sends a reader. An agency letter opens the agency page; a
 * brand letter opens its showcase's store page, or the form while it has none.
 * Both carry the code on, so the form still greets the reader when they reach
 * it; the store's own link to the form reads the `c` appended here. A code we
 * never posted opens the plain form.
 */
export function intakeLetterDestination(
	letter: {
		code: string
		audience: ModelIntakeAudience
		showcase: ModelIntakeShowcase | null
		locale: ModelIntakeLocale
	} | null,
	storePages: IntakeStorePages
): string {
	if (!letter) return '/free-model'
	if (letter.audience === 'agency') {
		const search = new URLSearchParams({
			[MODEL_INTAKE_LETTER_PARAM]: letter.code
		})
		return `${MODEL_INTAKE_AGENCY_PAGE_PATH}?${search.toString()}`
	}
	const storePage = letter.showcase && storePages[letter.showcase]
	if (storePage) {
		const url = new URL(storePage)
		url.searchParams.set(MODEL_INTAKE_LETTER_PARAM, letter.code)
		return url.toString()
	}
	return intakeLetterFormPath(letter.code, letter.locale)
}
