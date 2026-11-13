import { createClient, StorageApiError } from '@supabase/supabase-js'

import { MODEL_INTAKE_MAX_PHOTO_BYTES } from './model-intake-shared'

import type { IntakePhoto } from './model-intake-photos.server'

/**
 * Free-model photos and attachments, in a bucket of their own.
 *
 * Separate from `assets` so nothing that serves scene files can ever reach a
 * brand's photos, and so the purge deletes by prefix without touching anything
 * else. Private: the only way in is a signed URL minted for staff.
 *
 * Everything of one request lives under `<id>/`: the photos at its top, the
 * files staff attach under `<id>/files/`. Deleting a request deletes that
 * whole folder, so nothing stored for it can outlive it.
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

async function removePaths(paths: string[]): Promise<void> {
	if (paths.length === 0) return
	const { error } = await getStorage().from(MODEL_INTAKE_BUCKET).remove(paths)
	if (error) {
		throw new Error(`Failed to delete intake files: ${error.message}`)
	}
}

export function deleteIntakePhotos(paths: string[]): Promise<void> {
	return removePaths(paths)
}

let liftLimitPromise: Promise<void> | null = null

/**
 * Lets the bucket take attachments larger than a photo. The bucket was made
 * with the photo limit, and a signed upload is held to the bucket's limit;
 * photos keep theirs because the server checks each before uploading it.
 * Without a bucket limit, Supabase's project-wide one applies.
 */
function liftBucketSizeLimit(): Promise<void> {
	if (!liftLimitPromise) {
		liftLimitPromise = (async () => {
			await ensureBucket()
			const { error } = await getStorage().updateBucket(MODEL_INTAKE_BUCKET, {
				public: false,
				fileSizeLimit: null
			})
			if (error) {
				throw new Error(
					`Failed to lift the intake bucket limit: ${error.message}`
				)
			}
		})().catch((error) => {
			liftLimitPromise = null
			throw error
		})
	}
	return liftLimitPromise
}

/** Where a request's attached files live. */
function intakeAttachmentFolder(submissionId: string): string {
	return `${submissionId}/files`
}

/**
 * A URL the browser uploads one attachment to, straight to storage: large
 * files never pass through the app or its proxy's body limit. `exists` when a
 * file of that name is already attached: it is never overwritten.
 */
export async function createIntakeAttachmentUpload(
	submissionId: string,
	name: string
): Promise<string | 'exists'> {
	await liftBucketSizeLimit()
	const { data, error } = await getStorage()
		.from(MODEL_INTAKE_BUCKET)
		.createSignedUploadUrl(`${intakeAttachmentFolder(submissionId)}/${name}`)
	// Storage answers HTTP 400 and puts the 409 in its body.
	if (error instanceof StorageApiError && error.statusCode === '409') {
		return 'exists'
	}
	if (error || !data) {
		throw new Error(`Failed to create an upload URL: ${error?.message}`)
	}
	return data.signedUrl
}

export interface IntakeAttachment {
	name: string
	bytes: number | null
	/** Signed, and it downloads under the file's name rather than opening. */
	url: string
}

/** A request's attached files, each with a download link that lasts `expiresInSeconds`. */
export async function listIntakeAttachments(
	submissionId: string,
	expiresInSeconds: number
): Promise<IntakeAttachment[]> {
	const folder = intakeAttachmentFolder(submissionId)
	const bucket = getStorage().from(MODEL_INTAKE_BUCKET)
	const { data, error } = await bucket.list(folder, {
		limit: 1000,
		sortBy: { column: 'name', order: 'asc' }
	})
	if (error) throw new Error(`Failed to list attachments: ${error.message}`)
	const files = (data ?? []).filter((entry) => entry.id !== null)
	return Promise.all(
		files.map(async (file) => {
			const { data: signed, error: signError } = await bucket.createSignedUrl(
				`${folder}/${file.name}`,
				expiresInSeconds,
				{ download: file.name }
			)
			if (signError || !signed) {
				throw new Error(`Failed to sign an attachment: ${signError?.message}`)
			}
			const size = file.metadata?.size
			return {
				name: file.name,
				bytes: typeof size === 'number' ? size : null,
				url: signed.signedUrl
			}
		})
	)
}

export async function deleteIntakeAttachment(
	submissionId: string,
	name: string
): Promise<void> {
	await removePaths([`${intakeAttachmentFolder(submissionId)}/${name}`])
}

/** One page of a folder listing: a file has an id, a folder has none. */
type ListFolder = (
	prefix: string,
	offset: number
) => Promise<{ name: string; id: string | null }[]>

const LIST_PAGE = 1000

/**
 * Every file path under `prefix`, however deep. Storage lists one level and
 * one page at a time, so this walks both; a request's folder is the photos
 * plus `files/`, but nothing here assumes that.
 */
async function walkStorageFolder(
	list: ListFolder,
	prefix: string
): Promise<string[]> {
	const paths: string[] = []
	for (let offset = 0; ; offset += LIST_PAGE) {
		const entries = await list(prefix, offset)
		for (const entry of entries) {
			const path = `${prefix}/${entry.name}`
			if (entry.id === null)
				paths.push(...(await walkStorageFolder(list, path)))
			else paths.push(path)
		}
		if (entries.length < LIST_PAGE) return paths
	}
}

/** Lowercase, as Postgres writes a uuid and as every folder is named from one. */
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** The request ids that have a folder in the bucket. */
export async function listIntakeFolderIds(): Promise<string[]> {
	const bucket = getStorage().from(MODEL_INTAKE_BUCKET)
	const ids: string[] = []
	for (let offset = 0; ; offset += LIST_PAGE) {
		const { data, error } = await bucket.list('', { limit: LIST_PAGE, offset })
		if (error) throw new Error(`Failed to list the bucket: ${error.message}`)
		const entries = data ?? []
		for (const entry of entries) {
			if (entry.id === null && UUID_PATTERN.test(entry.name)) {
				ids.push(entry.name)
			}
		}
		if (entries.length < LIST_PAGE) return ids
	}
}

/** Deletes everything stored for one request: its photos, its attachments, anything else under `<id>/`. */
export async function deleteIntakeFolder(submissionId: string): Promise<void> {
	const bucket = getStorage().from(MODEL_INTAKE_BUCKET)
	const paths = await walkStorageFolder(async (prefix, offset) => {
		const { data, error } = await bucket.list(prefix, {
			limit: LIST_PAGE,
			offset
		})
		if (error) throw new Error(`Failed to list ${prefix}: ${error.message}`)
		return data ?? []
	}, submissionId)
	for (let start = 0; start < paths.length; start += LIST_PAGE) {
		await removePaths(paths.slice(start, start + LIST_PAGE))
	}
}
