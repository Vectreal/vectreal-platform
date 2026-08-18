import type { StructuredLoadError } from '@vctrl/hooks/use-load-model'

/**
 * What the publisher says when a model the user just picked will not load.
 *
 * Keyed on the error code rather than the loader's raw message so the copy stays
 * actionable: every one of these tells the user what to do next.
 */
export function getUploadLoadErrorMessage(
	error: StructuredLoadError | null
): string {
	switch (error?.code) {
		case 'missing_assets':
			return 'Model references missing assets. Upload the full model folder (including textures/buffers) and retry.'
		case 'unsupported_format':
			return 'Unsupported model format. Upload a .gltf, .glb, or .usdz file.'
		case 'multiple_models':
			return 'Multiple models found. Upload one model at a time.'
		case 'quota_exceeded':
			return 'Upload limit reached for this plan. Upgrade to continue uploading models.'
		case 'not_found':
			return 'Scene could not be found. Refresh and try again.'
		default:
			return error?.message || 'Failed to load model'
	}
}

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
