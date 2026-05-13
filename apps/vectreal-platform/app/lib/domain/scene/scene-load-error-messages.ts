import type { StructuredLoadError } from '@vctrl/hooks/use-load-model'

function isStructuredLoadError(error: unknown): error is StructuredLoadError {
	if (!error || typeof error !== 'object') {
		return false
	}

	const candidate = error as Partial<StructuredLoadError>
	return (
		typeof candidate.code === 'string' &&
		typeof candidate.message === 'string' &&
		typeof candidate.source === 'string'
	)
}

export function getDashboardSceneLoadErrorMessage(error: unknown): string {
	if (isStructuredLoadError(error)) {
		switch (error.code) {
			case 'not_found':
				return 'Scene not found. It may have been removed or your access may have changed.'
			case 'quota_exceeded':
				return 'This scene cannot be loaded because your current plan limit was reached.'
			case 'server_load_failed':
				return 'Scene loading failed due to a server or network issue. Retry in a moment.'
			case 'missing_assets':
				return 'Scene assets are incomplete. Re-open this scene in Publisher and re-save to repair asset links.'
			default:
				return error.message
		}
	}

	if (error instanceof Error) {
		return error.message
	}

	if (typeof error === 'string' && error.trim().length > 0) {
		return error
	}

	return 'Failed to load scene.'
}
