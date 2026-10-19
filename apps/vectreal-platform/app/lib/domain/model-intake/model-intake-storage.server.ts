import { createClient } from '@supabase/supabase-js'

import { MODEL_INTAKE_MAX_PHOTO_BYTES } from './model-intake-shared'

import type { IntakePhoto } from './model-intake-photos.server'

/**
 * Free-model photos, in a bucket of their own.
 *
 * Separate from `assets` so nothing that serves scene files can ever reach a
 * brand's photos, and so the purge deletes by prefix without touching anything
 * else. Private: the only way in is a signed URL minted for staff.
 */
export const MODEL_INTAKE_BUCKET = 'model-intake'

/** How long a photo link in the notification email lasts. */
export const MODEL_INTAKE_EMAIL_LINK_SECONDS = 7 * 24 * 60 * 60

/** How long a photo link on the internal page lasts: one working session, not a week. */
export const MODEL_INTAKE_PAGE_LINK_SECONDS = 60 * 60

function getStorage() {
	const supabaseUrl = process.env.SUPABASE_URL?.trim()
	const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
	if (!supabaseUrl || !secretKey) {
		throw new Error(
			'Missing required environment variables: SUPABASE_URL and SUPABASE_SECRET_KEY must be set'
		)
	}
	return createClient(supabaseUrl, secretKey, {
		auth: { persistSession: false }
	}).storage
}

let ensureBucketPromise: Promise<void> | null = null

/** Creates the private bucket on first use, as `asset-storage.server.ts` does for `assets`. */
function ensureBucket(): Promise<void> {
	if (!ensureBucketPromise) {
		ensureBucketPromise = (async () => {
			const storage = getStorage()
			const { data } = await storage.getBucket(MODEL_INTAKE_BUCKET)
			if (data) return
			const { error } = await storage.createBucket(MODEL_INTAKE_BUCKET, {
				public: false,
				fileSizeLimit: MODEL_INTAKE_MAX_PHOTO_BYTES
			})
			if (error && !error.message.toLowerCase().includes('already exists')) {
				throw new Error(
					`Failed to create storage bucket ${MODEL_INTAKE_BUCKET}: ${error.message}`
				)
			}
		})().catch((error) => {
			ensureBucketPromise = null
			throw error
		})
	}
	return ensureBucketPromise
}

/** Where each photo of a request is stored. Known before upload, so the row can name them first. */
export function intakePhotoPaths(
	submissionId: string,
	photos: IntakePhoto[]
): string[] {
	return photos.map(
		(photo, index) => `${submissionId}/${index + 1}.${photo.extension}`
	)
}

/** Uploads the photos to `intakePhotoPaths`. */
export async function uploadIntakePhotos(
	submissionId: string,
	photos: IntakePhoto[]
): Promise<void> {
	await ensureBucket()
	const storage = getStorage().from(MODEL_INTAKE_BUCKET)
	const paths = intakePhotoPaths(submissionId, photos)

	for (const [index, photo] of photos.entries()) {
		const { error } = await storage.upload(paths[index], photo.bytes, {
			contentType: photo.contentType,
			upsert: false
		})
		if (error) {
			throw new Error(`Failed to upload intake photo: ${error.message}`)
		}
	}
}

export async function signIntakePhotoUrls(
	paths: string[],
	expiresInSeconds: number
): Promise<string[]> {
	if (paths.length === 0) return []
	const { data, error } = await getStorage()
		.from(MODEL_INTAKE_BUCKET)
		.createSignedUrls(paths, expiresInSeconds)
	if (error || !data) {
		throw new Error(`Failed to sign intake photo URLs: ${error?.message}`)
	}
	return data.map((entry) => entry.signedUrl ?? '')
}

export async function deleteIntakePhotos(paths: string[]): Promise<void> {
	if (paths.length === 0) return
	const { error } = await getStorage().from(MODEL_INTAKE_BUCKET).remove(paths)
	if (error) {
		throw new Error(`Failed to delete intake photos: ${error.message}`)
	}
}
