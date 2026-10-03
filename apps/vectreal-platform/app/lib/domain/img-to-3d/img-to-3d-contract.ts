/**
 * What an image-to-3D request may ask for, and what comes back.
 *
 * Pure and client-safe: the generate panel reads the same constants the action
 * validates against. The runtime states this contract a second time on its own
 * side of the wire, in `apps/img-to-3d-runtime/img_to_3d_runtime/params.py`,
 * and rejects anything outside it; the two lists are kept equal by hand.
 */

export const IMG_TO_3D_RESOLUTIONS = [512, 1024, 1536] as const
export const IMG_TO_3D_TEXTURE_SIZES = [1024, 2048, 4096] as const
export const IMG_TO_3D_DECIMATION_TARGET = { min: 10_000, max: 1_000_000 }
/** Seeds per image: one generation each, so several can be compared. */
export const IMG_TO_3D_SEED_COUNT = { min: 1, max: 3 }
export const IMG_TO_3D_MAX_SEED = 2 ** 31 - 1

export const IMG_TO_3D_IMAGE_TYPES = [
	'image/png',
	'image/jpeg',
	'image/webp'
] as const
/** The runtime's own default limit, mirrored so a large file fails here first. */
export const IMG_TO_3D_MAX_IMAGE_BYTES = 10 * 1024 * 1024

export type ImgTo3dResolution = (typeof IMG_TO_3D_RESOLUTIONS)[number]
export type ImgTo3dTextureSize = (typeof IMG_TO_3D_TEXTURE_SIZES)[number]

/** One generation's parameters, as the runtime receives them (seed aside). */
export interface ImgTo3dGenerationParams {
	readonly resolution: ImgTo3dResolution
	readonly textureSize: ImgTo3dTextureSize
	readonly decimationTarget: number
}

export interface ImgTo3dSubmission extends ImgTo3dGenerationParams {
	readonly image: File
	readonly seedCount: number
}

/**
 * A starting point for a web demo rather than the runtime's maximum: 1M
 * triangles at a 4K bake is tens of megabytes before optimization.
 */
export const DEFAULT_IMG_TO_3D_PARAMS = {
	resolution: 1024,
	textureSize: 2048,
	decimationTarget: 200_000,
	seedCount: 3
} as const satisfies Omit<ImgTo3dSubmission, 'image'>

/** The form field names the panel sends and the action reads. */
export const IMG_TO_3D_FIELDS = {
	image: 'image',
	resolution: 'resolution',
	textureSize: 'textureSize',
	decimationTarget: 'decimationTarget',
	seedCount: 'seedCount'
} as const

export type ImgTo3dParseResult =
	| { readonly ok: true; readonly submission: ImgTo3dSubmission }
	| { readonly ok: false; readonly error: ImgTo3dErrorKind }

function readInteger(formData: FormData, field: string): number | null {
	const raw = formData.get(field)
	if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) {
		return null
	}
	return Number(raw.trim())
}

function isOneOf<T extends number>(
	options: readonly T[],
	value: number | null
): value is T {
	return value !== null && (options as readonly number[]).includes(value)
}

function inRange(
	value: number | null,
	range: { min: number; max: number }
): value is number {
	return value !== null && value >= range.min && value <= range.max
}

export function parseImgTo3dSubmission(formData: FormData): ImgTo3dParseResult {
	const image = formData.get(IMG_TO_3D_FIELDS.image)
	if (!(image instanceof File) || image.size === 0) {
		return { ok: false, error: 'image_missing' }
	}
	if (!(IMG_TO_3D_IMAGE_TYPES as readonly string[]).includes(image.type)) {
		return { ok: false, error: 'image_type' }
	}
	if (image.size > IMG_TO_3D_MAX_IMAGE_BYTES) {
		return { ok: false, error: 'image_too_large' }
	}

	const resolution = readInteger(formData, IMG_TO_3D_FIELDS.resolution)
	const textureSize = readInteger(formData, IMG_TO_3D_FIELDS.textureSize)
	const decimationTarget = readInteger(
		formData,
		IMG_TO_3D_FIELDS.decimationTarget
	)
	const seedCount = readInteger(formData, IMG_TO_3D_FIELDS.seedCount)

	// The panel offers only valid settings, so a request outside them is a
	// hand-built one, and one kind covers every field.
	if (
		!isOneOf(IMG_TO_3D_RESOLUTIONS, resolution) ||
		!isOneOf(IMG_TO_3D_TEXTURE_SIZES, textureSize) ||
		!inRange(decimationTarget, IMG_TO_3D_DECIMATION_TARGET) ||
		!inRange(seedCount, IMG_TO_3D_SEED_COUNT)
	) {
		return { ok: false, error: 'invalid_settings' }
	}

	return {
		ok: true,
		submission: { image, resolution, textureSize, decimationTarget, seedCount }
	}
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export type ImgTo3dJobStatus = 'queued' | 'processing' | 'succeeded' | 'failed'

/** One submitted variant, as `POST /api/img-to-3d/generations` reports it. */
export interface ImgTo3dSubmittedJob {
	readonly jobId: string
	readonly seed: number
	readonly status: ImgTo3dJobStatus
	readonly error: ImgTo3dErrorKind | null
}

export interface ImgTo3dSubmitResponse {
	readonly batchId: string
	readonly jobs: readonly ImgTo3dSubmittedJob[]
}

/** `GET /api/img-to-3d/generations/:jobId`, as the runtime reports it. */
export interface ImgTo3dJobState {
	readonly jobId: string
	readonly status: ImgTo3dJobStatus
	readonly progress: number | null
	/** The runtime's stage name while processing; null once terminal. */
	readonly message: string | null
	readonly artifactReady: boolean
	readonly pollAfterMs: number
}

export function isTerminalImgTo3dStatus(status: ImgTo3dJobStatus): boolean {
	return status === 'succeeded' || status === 'failed'
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/*
  Every failure the panel can show, as a kind the API sends instead of a
  message. The copy is a total `Record`, so a new kind does not compile until
  it has words, the same rule as `lib/errors/error-state-copy.ts`. No
  exception text crosses the wire: the runtime writes a raw Python or CUDA
  error into a failed job, and that goes to the server log, not the page.
*/

export const IMG_TO_3D_ERROR_KINDS = [
	'image_missing',
	'image_type',
	'image_too_large',
	'invalid_settings',
	'runtime_unavailable',
	'runtime_rejected',
	'generation_failed',
	'open_failed',
	'unexpected'
] as const

export type ImgTo3dErrorKind = (typeof IMG_TO_3D_ERROR_KINDS)[number]

export const IMG_TO_3D_ERROR_COPY: Record<ImgTo3dErrorKind, string> = {
	image_missing: 'Choose an image to generate from.',
	image_type: 'The image must be a PNG, JPEG or WebP.',
	image_too_large: `The image must be ${IMG_TO_3D_MAX_IMAGE_BYTES / (1024 * 1024)} MB or smaller.`,
	invalid_settings: 'These settings are outside what generation accepts.',
	runtime_unavailable:
		'The generation runtime is not reachable. Trying again usually works.',
	runtime_rejected: 'The generation runtime refused this request.',
	// Internal tooling: the person reading this can read the runtime logs too.
	generation_failed:
		'Generation failed. The cause is in the runtime logs (nx run img-to-3d-runtime:modal-logs).',
	open_failed: 'The model could not be opened. Trying again usually works.',
	unexpected: 'Something went wrong. Trying again usually works.'
}

/** A kind read off the wire, or `unexpected` for anything else. */
export function imgTo3dErrorKind(value: unknown): ImgTo3dErrorKind {
	return (IMG_TO_3D_ERROR_KINDS as readonly unknown[]).includes(value)
		? (value as ImgTo3dErrorKind)
		: 'unexpected'
}
