import { describe, expect, it, vi } from 'vitest'

import { MODEL_INTAKE_MAX_ATTACHMENT_BYTES } from './model-intake-shared'
import { createIntakeAttachmentUpload } from './model-intake-storage.server'

const storage = vi.hoisted(() => ({
	updates: [] as { fileSizeLimit?: number | null }[]
}))

vi.mock('@supabase/supabase-js', () => ({
	StorageApiError: class extends Error {},
	createClient: () => ({
		storage: {
			getBucket: async () => ({ data: { id: 'model-intake' } }),
			updateBucket: async (
				_id: string,
				options: { fileSizeLimit?: number | null }
			) => {
				storage.updates.push(options)
				return { error: null }
			},
			from: () => ({
				createSignedUploadUrl: async () => ({
					data: { signedUrl: 'http://storage.test/upload' },
					error: null
				})
			})
		}
	})
}))

describe('createIntakeAttachmentUpload', () => {
	it('holds the bucket to the attachment limit the card prints', async () => {
		process.env.SUPABASE_URL = 'http://storage.test'
		process.env.SUPABASE_SECRET_KEY = 'test'
		await createIntakeAttachmentUpload('id', 'part.step')
		expect(storage.updates).toEqual([
			{ public: false, fileSizeLimit: MODEL_INTAKE_MAX_ATTACHMENT_BYTES }
		])
	})
})
