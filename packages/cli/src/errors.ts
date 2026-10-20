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
