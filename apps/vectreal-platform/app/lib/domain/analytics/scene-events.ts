import type { StructuredLoadError } from '@vctrl/hooks/use-load-model'

interface SceneUploadFailedAnalyticsProps {
	client_type: 'web'
	file_format: string
	error_code: string
	error_message: string
	file_size_bytes?: number
}

function inferFileFormat(error: StructuredLoadError): string {
	const fileName =
		typeof error.context?.fileName === 'string' ? error.context.fileName : null

	if (fileName && fileName.includes('.')) {
		return fileName.split('.').pop()?.toLowerCase() || 'unknown'
	}

	const fileType =
		typeof error.context?.fileType === 'string' ? error.context.fileType : null
	if (fileType) {
		return fileType.toLowerCase()
	}

	return 'unknown'
}

export function buildSceneUploadFailedAnalyticsProps(
	error: StructuredLoadError,
	fallbackMessage: string
): SceneUploadFailedAnalyticsProps {
	const props: SceneUploadFailedAnalyticsProps = {
		client_type: 'web',
		file_format: inferFileFormat(error),
		error_code: error.code,
		error_message: error.message || fallbackMessage
	}

	if (typeof error.context?.fileSize === 'number') {
		props.file_size_bytes = error.context.fileSize
	}

	return props
}
