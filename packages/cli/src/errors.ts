import { VectrealApiError, VectrealContractError } from '@vctrl/sdk'

/**
 * Exit codes, documented in `vectreal --help`. Scripts and the later scene
 * commands branch on them, so a value never changes meaning.
 */
export const EXIT = {
	ok: 0,
	failure: 1,
	usage: 2,
	notSignedIn: 3
} as const

/** A mistake in how the command was called. */
export class UsageError extends Error {
	override readonly name = 'UsageError'
	readonly exitCode = EXIT.usage
}

/** No usable session for the origin: never signed in, signed out, or revoked. */
export class NotSignedInError extends Error {
	override readonly name = 'NotSignedInError'
	readonly exitCode = EXIT.notSignedIn

	constructor(origin: string) {
		super(`Not signed in to ${origin}. Run: vectreal login`)
	}
}

/**
 * The API refused the token itself. A revoked session's access token still
 * verifies until it expires, so this, not a failed refresh, is how a CLI
 * whose access was revoked from the dashboard first hears of it.
 */
export function isRefusedToken(error: unknown): error is VectrealApiError {
	return error instanceof VectrealApiError && error.code === 'invalid_token'
}

export function describeError(error: unknown): string {
	if (isRefusedToken(error)) {
		return `The server no longer accepts this session (${error.message}). Run: vectreal login`
	}
	if (error instanceof VectrealApiError) {
		return `The server refused (${error.status}${error.code ? `, ${error.code}` : ''}): ${error.message}`
	}
	if (error instanceof VectrealContractError) {
		return `${error.message}. Is this a Vectreal server, and is the CLI up to date?`
	}
	return error instanceof Error ? error.message : String(error)
}
