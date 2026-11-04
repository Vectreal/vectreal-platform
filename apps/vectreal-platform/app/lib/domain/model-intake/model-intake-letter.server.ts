import {
	findIntakeLetter,
	type ModelIntakeLetter,
	recordIntakeLetterScan
} from './model-intake-repository.server'
import {
	intakeLetterDestination,
	normalizeIntakeLetterCode
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
	reportServerError
}

export type IntakeLetterDeps = typeof intakeLetterDeps

/**
 * The letter a code names, or null for one we never posted or one that cannot
 * be read right now. Null only costs the greeting and the link to the letter:
 * the form works the same without it.
 */
export async function lookupIntakeLetter(
	request: Request,
	code: string | null,
	deps: IntakeLetterDeps = intakeLetterDeps
): Promise<ModelIntakeLetter | null> {
	if (!code) return null
	try {
		return await deps.findIntakeLetter(code)
	} catch (error) {
		deps.reportServerError(error, { request })
		return null
	}
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
	return lookupIntakeLetter(request, code, deps)
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
	return intakeLetterDestination(letter)
}
