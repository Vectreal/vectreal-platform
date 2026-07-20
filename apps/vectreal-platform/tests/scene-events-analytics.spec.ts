import { describe, expect, it } from 'vitest'

import { buildSceneUploadFailedAnalyticsProps } from '../app/lib/domain/analytics/scene-events'

import type { StructuredLoadError } from '@vctrl/hooks/use-load-model'

describe('buildSceneUploadFailedAnalyticsProps', () => {
	it('builds canonical payload with extension-based file_format and size', () => {
		const error: StructuredLoadError = {
			code: 'gltf_load_failed',
			message: 'Failed to parse GLTF',
			recoverable: true,
			source: 'local-upload',
			context: {
				fileName: 'spaceship.gltf',
				fileSize: 1200
			}
		}

		expect(buildSceneUploadFailedAnalyticsProps(error, 'fallback')).toEqual({
			file_format: 'gltf',
			error_code: 'gltf_load_failed',
			error_message: 'Failed to parse GLTF',
			file_size_bytes: 1200
		})
	})

	it('falls back to fileType and fallback message when needed', () => {
		const error: StructuredLoadError = {
			code: 'binary_load_failed',
			message: '',
			recoverable: true,
			source: 'local-upload',
			context: {
				fileType: 'GLB'
			}
		}

		expect(
			buildSceneUploadFailedAnalyticsProps(error, 'Default message')
		).toEqual({
			file_format: 'glb',
			error_code: 'binary_load_failed',
			error_message: 'Default message'
		})
	})

	it('uses unknown file_format when no format context is available', () => {
		const error: StructuredLoadError = {
			code: 'unknown',
			message: 'Oops',
			recoverable: true,
			source: 'local-upload'
		}

		expect(
			buildSceneUploadFailedAnalyticsProps(error, 'fallback').file_format
		).toBe('unknown')
	})
})
