import { StructuredLoadError } from './types'

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
	const message = toErrorMessage(error)
	const derivedCode = message.includes('missing required referenced assets')
		? 'missing_assets'
		: code

	return createStructuredLoadError({
		code: derivedCode,
		message,
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
	const message = toErrorMessage(error)

	let code: StructuredLoadError['code'] = 'server_load_failed'
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
