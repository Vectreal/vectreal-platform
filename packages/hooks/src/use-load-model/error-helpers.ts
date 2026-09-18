import { isMissingAssetsError } from '@vctrl/core/model-loader'

import { StructuredLoadError } from './types'

/**
 * A failure that already describes itself. The loaders throw these deliberately,
 * so normalizing one again would flatten its code and message into "unknown".
 */
export const isStructuredLoadError = (
	error: unknown
): error is StructuredLoadError =>
	typeof error === 'object' &&
	error !== null &&
	'code' in error &&
	'recoverable' in error &&
	'source' in error

export const createStructuredLoadError = ({
	code,
	message,
	recoverable,
	source,
	cause,
	context
}: StructuredLoadError): StructuredLoadError => ({
	code,
	message,
	recoverable,
	source,
	cause,
	context
})

export const toErrorMessage = (error: unknown): string => {
	if (error instanceof Error && error.message) {
		return error.message
	}

	if (typeof error === 'string' && error.trim().length > 0) {
		return error
	}

	return 'Unknown error'
}

export const normalizeLocalLoadError = (
	error: unknown,
	code: StructuredLoadError['code'],
	context?: Record<string, unknown>
): StructuredLoadError => {
	if (isStructuredLoadError(error)) return error

	/*
	  THE MARKER, NOT THE SENTENCE. This read `message.includes('missing
	  required referenced assets')`, which is the scene payload builder's
	  wording. The glTF loader refuses with `Missing required image files:`, so
	  its refusal never reached `missing_assets` and the reader was told to
	  check that a valid folder was a valid glTF, while the copy naming the real
	  problem sat unreachable in every surface that writes it.
	*/
	const derivedCode = isMissingAssetsError(error) ? 'missing_assets' : code

	return createStructuredLoadError({
		code: derivedCode,
		message: toErrorMessage(error),
		recoverable: true,
		source: 'local-upload',
		cause: error,
		context
	})
}

export const normalizeServerLoadError = (
	error: unknown,
	sceneId: string
): StructuredLoadError => {
	if (isStructuredLoadError(error)) return error

	const message = toErrorMessage(error)

	/*
	  A SAVED SCENE CAN BE INCOMPLETE TOO. `resolve-scene-payload` refuses a
	  manifest that omits a referenced asset, and that refusal used to land here
	  as `server_load_failed` - so the dashboard said "a server or network issue.
	  Retry in a moment." about a payload that will never load however many times
	  it is fetched. The sentence that names the real problem, and the repair,
	  was one `case` away and unreachable.
	*/
	let code: StructuredLoadError['code'] = isMissingAssetsError(error)
		? 'missing_assets'
		: 'server_load_failed'
	if (message.includes('Server responded with 404')) {
		code = 'not_found'
	} else if (
		message.includes('Server responded with 402') ||
		message.includes('Server responded with 403')
	) {
		code = 'quota_exceeded'
	}

	return createStructuredLoadError({
		code,
		message,
		recoverable: code !== 'not_found',
		source: 'server-load',
		cause: error,
		context: {
			sceneId
		}
	})
}
