import {
	findIntakeLetter,
	type ModelIntakeLetter,
	recordIntakeLetterScan
} from './model-intake-repository.server'
import {
	intakeLetterDestination,
	normalizeIntakeLetterCode,
	parseIntakeStorePages
} from './model-intake-shared'
import { recordRateLimitAttempt } from '../../http/rate-limit.server'
import { reportServerError } from '../../observability/report-server-error.server'

/**
 * Lookups per address per ten minutes. A reader opening the short address,
 * the form and a submit spends three; guessing codes to learn whom we wrote to
 * needs billions.
 */
const LETTER_LOOKUP_RATE_LIMIT = {
	bucket: 'model-intake-letter',
	maxRequests: 30,
	windowMs: 10 * 60 * 1000
} as const

export const intakeLetterDeps = {
	now: () => new Date(),
	isRateLimited: (request: Request) =>
		recordRateLimitAttempt(request, LETTER_LOOKUP_RATE_LIMIT).limited,
	findIntakeLetter,
	recordIntakeLetterScan,
	reportServerError,
	storePages: () => parseIntakeStorePages(process.env.MODEL_INTAKE_STORE_PAGES)
}

export type IntakeLetterDeps = typeof intakeLetterDeps

/**
 * The letter a submitted code names, or null for one we never posted. A read
 * that fails throws rather than answering null: the letter decides whether an
 * agency must confirm its client's OK, and a request filed as if it came with
 * no letter would skip that question.
 */
export async function lookupIntakeLetter(
	request: Request,
	code: string | null,
	deps: IntakeLetterDeps = intakeLetterDeps
): Promise<ModelIntakeLetter | null> {
	return code ? deps.findIntakeLetter(code) : null
}

/**
 * The lookup a visitor's address can trigger: the short address and the
 * form's page. It shows the organization, so it is rate-limited; the submit
 * reads the code its own form carried through `lookupIntakeLetter` instead,
 * and reveals nothing.
 */
export async function resolveIntakeLetter(
	request: Request,
	raw: string | null,
	deps: IntakeLetterDeps = intakeLetterDeps
): Promise<ModelIntakeLetter | null> {
	const code = normalizeIntakeLetterCode(raw)
	if (!code || deps.isRateLimited(request)) return null
	// Here a failed read costs only the greeting and the link to the letter,
	// and the submit reads the code again for itself.
	try {
		return await lookupIntakeLetter(request, code, deps)
	} catch (error) {
		deps.reportServerError(error, { request })
		return null
	}
}

/** `/c/<code>`: counts the scan of a letter we posted, then names where the reader goes. */
export async function followIntakeShortLink(
	request: Request,
	raw: string | null,
	deps: IntakeLetterDeps = intakeLetterDeps
): Promise<string> {
	const letter = await resolveIntakeLetter(request, raw, deps)
	if (letter) {
		await deps
			.recordIntakeLetterScan(letter.code, deps.now())
			.catch((error: unknown) => deps.reportServerError(error, { request }))
	}
	const storePages = deps.storePages()
	if (!storePages.ok) {
		// A bad value must not strand a printed code: it opens the form instead.
		deps.reportServerError(
			new Error(`MODEL_INTAKE_STORE_PAGES: ${storePages.error}`),
			{ request }
		)
	}
	return intakeLetterDestination(letter, storePages.ok ? storePages.pages : {})
}
