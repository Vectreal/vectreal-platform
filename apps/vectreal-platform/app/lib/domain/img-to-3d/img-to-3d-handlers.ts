import { ApiResponse } from '@shared/utils'

import {
	IMG_TO_3D_DAILY_JOB_LIMIT,
	IMG_TO_3D_LIST_BATCH_LIMIT,
	IMG_TO_3D_MAX_IMAGE_BYTES,
	IMG_TO_3D_RETENTION_MS,
	imgTo3dSourceName,
	imgTo3dVariantFileName,
	parseImgTo3dSubmission,
	type ImgTo3dErrorKind,
	type ImgTo3dGenerationParams,
	type ImgTo3dJobState,
	type ImgTo3dListedBatch,
	type ImgTo3dListedVariant,
	type ImgTo3dSubmitResponse,
	type ImgTo3dSubmittedJob
} from './img-to-3d-contract'

import type { User } from '@supabase/supabase-js'

/**
 * The three image-to-3D endpoints, with everything that touches the database,
 * the network or the session passed in.
 *
 * A route module cannot be imported by a test (`getDbClient()` runs at module
 * scope), so the routes are one line each - they call these with
 * `imgTo3dServerDeps` - and the specs call them with fakes. That is what lets a
 * test prove every endpoint answers 404 to someone the gate refuses, against
 * the code that actually runs.
 */

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

/**
 * The runtime refused, failed or could not be reached. `detail` is for the
 * server log only; the caller receives `kind`.
 */
export class ImgTo3dRuntimeError extends Error {
	constructor(
		readonly kind: ImgTo3dErrorKind,
		/** What the platform answers its own caller with. */
		readonly status: number,
		detail?: string,
		/**
		 * The request was sent but no answer came, so the runtime may have
		 * acted on it: a submit that timed out may be running.
		 */
		readonly outcomeUnknown = false
	) {
		super(detail ?? kind)
		this.name = 'ImgTo3dRuntimeError'
	}
}

export interface ImgTo3dRuntimeSubmission extends ImgTo3dGenerationParams {
	readonly jobId: string
	readonly seed: number
	readonly image: File
}

export interface ImgTo3dRuntime {
	submit(submission: ImgTo3dRuntimeSubmission): Promise<void>
	status(jobId: string): Promise<ImgTo3dJobState>
	/** The GLB, as a response whose body is streamed on. */
	artifact(jobId: string): Promise<Response>
}

export interface ImgTo3dJobRecord {
	readonly id: string
	readonly organizationId: string
	readonly createdBy: string
	readonly batchId: string
	readonly seed: number
	readonly params: ImgTo3dGenerationParams
	readonly sourceName: string
}

/** A job as the Generations page lists it. */
export interface ImgTo3dJobListing {
	readonly id: string
	readonly batchId: string
	readonly seed: number
	readonly sourceName: string | null
	readonly createdAt: Date
	readonly createdByName: string | null
}

/** What a job's own routes need to know about it. */
export interface ImgTo3dOwnedJob {
	readonly id: string
	readonly seed: number
	readonly sourceName: string | null
}

export interface ImgTo3dJobStore {
	/**
	 * Records `jobs` unless that would take `userId` past `limit` jobs in the
	 * last 24 hours, atomically; `false` when refused, with nothing recorded.
	 */
	insertWithinDailyLimit(
		jobs: readonly ImgTo3dJobRecord[],
		userId: string,
		limit: number
	): Promise<boolean>
	/** The job, only if it belongs to `organizationId`. */
	findForOrganization(
		jobId: string,
		organizationId: string
	): Promise<ImgTo3dOwnedJob | null>
	/**
	 * Every job of the `batchLimit` most recent batches in `organizationId`,
	 * newest first.
	 */
	listForOrganization(
		organizationId: string,
		batchLimit: number
	): Promise<readonly ImgTo3dJobListing[]>
	remove(jobId: string): Promise<void>
}

export interface ImgTo3dHandlerDeps {
	authenticate(
		request: Request
	): Promise<{ user: User; headers?: HeadersInit } | Response>
	/** `resolveImgTo3dAccess`: the paying organization, or null to refuse. */
	resolveAccess(user: User): Promise<{ organizationId: string } | null>
	validateCsrf(request: Request, formData: FormData): Promise<Response | null>
	jobs: ImgTo3dJobStore
	runtime(): ImgTo3dRuntime
	newId(): string
	newSeed(): number
}

// ---------------------------------------------------------------------------
// Shared steps
// ---------------------------------------------------------------------------

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/*
  404, not 401 or 403, for a signed-out or refused caller and for a job outside
  their organization: anything else would confirm that the endpoint, or the job
  id, exists. For the same reason nothing about the request, its method
  included, is looked at before the caller is admitted.
*/
const NOT_FOUND = 'Not found'

/** The image plus the form's other fields and boundaries, generously. */
const MAX_SUBMIT_BYTES = IMG_TO_3D_MAX_IMAGE_BYTES + 64 * 1024

/**
 * Auth cookies are appended, not set: Supabase can rotate more than one in a
 * single response, and `set` would keep only the last.
 */
function withAuthHeaders(
	response: Response,
	authHeaders: HeadersInit | undefined
): Response {
	if (!authHeaders) return response
	const headers = new Headers(response.headers)
	new Headers(authHeaders).forEach((value, key) => headers.append(key, value))
	return new Response(response.body, { status: response.status, headers })
}

function runtimeFailure(error: unknown): Response {
	console.error('[img-to-3d]', error)
	if (error instanceof ImgTo3dRuntimeError) {
		return ApiResponse.error(error.kind, error.status)
	}
	return ApiResponse.error('unexpected' satisfies ImgTo3dErrorKind, 500)
}

/*
  A failed job's message is whatever the runtime caught: a Python traceback
  line, a CUDA out-of-memory report. It is logged here and never sent on.
*/
function withoutFailureDetail(state: ImgTo3dJobState): ImgTo3dJobState {
	if (state.status !== 'failed') return state
	if (state.message) {
		console.error(`[img-to-3d] job ${state.jobId} failed: ${state.message}`)
	}
	return { ...state, message: null }
}

/** Authenticated and allowed to generate, or the response that says otherwise. */
async function admit(
	request: Request,
	deps: ImgTo3dHandlerDeps
): Promise<
	{ user: User; organizationId: string; headers?: HeadersInit } | Response
> {
	const auth = await deps.authenticate(request)
	if (auth instanceof Response) return ApiResponse.notFound(NOT_FOUND)

	const access = await deps.resolveAccess(auth.user)
	if (!access) {
		return withAuthHeaders(ApiResponse.notFound(NOT_FOUND), auth.headers)
	}

	return { ...auth, organizationId: access.organizationId }
}

/** Admitted, asking with GET, and the job is theirs; or the response that says otherwise. */
async function admitToJob(
	request: Request,
	jobId: string | undefined,
	deps: ImgTo3dHandlerDeps
) {
	const admitted = await admit(request, deps)
	if (admitted instanceof Response) return admitted
	if (request.method !== 'GET') {
		return withAuthHeaders(ApiResponse.methodNotAllowed(), admitted.headers)
	}

	// Checked before the query: Postgres rejects a malformed uuid with an error.
	const job =
		jobId && UUID_PATTERN.test(jobId)
			? await deps.jobs.findForOrganization(jobId, admitted.organizationId)
			: null
	if (!job) {
		return withAuthHeaders(ApiResponse.notFound(NOT_FOUND), admitted.headers)
	}

	return { ...admitted, job }
}

/**
 * RFC 6266: an ASCII fallback, quotes and backslashes removed, for clients
 * that read only `filename`, and the exact name, percent-encoded, in
 * `filename*`. The name comes from the uploaded photo, so it is never
 * written into the header raw.
 */
function contentDisposition(fileName: string): string {
	const fallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_')
	// `encodeURIComponent` leaves these four, which RFC 5987 does not allow.
	const exact = encodeURIComponent(fileName).replace(
		/['()*]/g,
		(char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
	)
	return `attachment; filename="${fallback}"; filename*=UTF-8''${exact}`
}

/** A variant's state for the list, or null when the runtime could not say. */
async function listedState(
	runtime: ImgTo3dRuntime | null,
	jobId: string
): Promise<Pick<ImgTo3dListedVariant, 'status' | 'progress' | 'error'>> {
	const unknown = { status: null, progress: null, error: null }
	if (!runtime) return unknown
	try {
		const state = withoutFailureDetail(await runtime.status(jobId))
		return {
			status: state.status,
			progress: state.progress,
			error: state.status === 'failed' ? 'generation_failed' : null
		}
	} catch (error) {
		// The runtime does not know the job. Other refusals (a rotated token's
		// 401, a 429) may pass, so they stay unknown and are polled, as the
		// publisher's polling treats them.
		if (
			error instanceof ImgTo3dRuntimeError &&
			error.kind === 'runtime_rejected' &&
			error.status === 404
		) {
			return { status: 'failed', progress: null, error: 'runtime_rejected' }
		}
		console.error(`[img-to-3d] job ${jobId} status unavailable`, error)
		return unknown
	}
}

/** Status requests the Generations page's loader keeps in flight at once. */
const LIST_STATUS_CONCURRENCY = 6

function distinctSeeds(count: number, newSeed: () => number): number[] {
	const seeds = new Set<number>()
	while (seeds.size < count) seeds.add(newSeed())
	return [...seeds]
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * `POST /api/img-to-3d/generations`: one image, one job per seed.
 *
 * Each job is recorded before it is sent, so a job the runtime is running
 * always has an owner. A job the runtime refuses is removed again and reported
 * as failed alongside the others; only when every one is refused does the
 * request itself fail. A submit that timed out keeps its row and is reported
 * queued: the runtime may be running it, and polling settles which, since a
 * job it never received answers 404 and ends there.
 */
export async function handleSubmitImgTo3dGeneration(
	request: Request,
	deps: ImgTo3dHandlerDeps
): Promise<Response> {
	const admitted = await admit(request, deps)
	if (admitted instanceof Response) return admitted
	const respond = (response: Response) =>
		withAuthHeaders(response, admitted.headers)

	if (request.method !== 'POST') {
		return respond(ApiResponse.methodNotAllowed())
	}

	// Checked before the body is read, which buffers all of it in memory.
	// Browsers always send a length with a form; a request without one is refused.
	const length = Number(request.headers.get('Content-Length') ?? NaN)
	if (!Number.isFinite(length) || length > MAX_SUBMIT_BYTES) {
		return respond(
			ApiResponse.error('image_too_large' satisfies ImgTo3dErrorKind, 413)
		)
	}

	let formData: FormData
	try {
		formData = await request.formData()
	} catch {
		return respond(ApiResponse.badRequest('Expected a multipart form.'))
	}

	const csrfFailure = await deps.validateCsrf(request, formData)
	if (csrfFailure) return respond(csrfFailure)

	const parsed = parseImgTo3dSubmission(formData)
	if (!parsed.ok) return respond(ApiResponse.badRequest(parsed.error))

	const { image, seedCount, ...params } = parsed.submission
	const batchId = deps.newId()
	const records: ImgTo3dJobRecord[] = distinctSeeds(
		seedCount,
		deps.newSeed
	).map((seed) => ({
		id: deps.newId(),
		organizationId: admitted.organizationId,
		createdBy: admitted.user.id,
		batchId,
		seed,
		params,
		sourceName: imgTo3dSourceName(image.name)
	}))
	// Nothing is sent unless every job was recorded within the limit.
	const reserved = await deps.jobs.insertWithinDailyLimit(
		records,
		admitted.user.id,
		IMG_TO_3D_DAILY_JOB_LIMIT
	)
	if (!reserved) {
		return respond(
			ApiResponse.error('daily_limit' satisfies ImgTo3dErrorKind, 429)
		)
	}

	const runtime = deps.runtime()
	const outcomes = await Promise.all(
		records.map(async (record): Promise<ImgTo3dSubmittedJob> => {
			try {
				await runtime.submit({
					jobId: record.id,
					seed: record.seed,
					image,
					...params
				})
				return {
					jobId: record.id,
					seed: record.seed,
					status: 'queued',
					error: null
				}
			} catch (error) {
				if (error instanceof ImgTo3dRuntimeError && error.outcomeUnknown) {
					console.error(
						`[img-to-3d] job ${record.id} may not have started`,
						error
					)
					return {
						jobId: record.id,
						seed: record.seed,
						status: 'queued',
						error: null
					}
				}
				console.error(`[img-to-3d] job ${record.id} did not start`, error)
				// A row left behind owns nothing the runtime runs; it is not worth
				// failing the variants that did start.
				await deps.jobs.remove(record.id).catch((removeError: unknown) => {
					console.error(`[img-to-3d] job ${record.id} row kept`, removeError)
				})
				return {
					jobId: record.id,
					seed: record.seed,
					status: 'failed',
					error:
						error instanceof ImgTo3dRuntimeError ? error.kind : 'unexpected'
				}
			}
		})
	)

	if (outcomes.every((job) => job.status === 'failed')) {
		return respond(ApiResponse.error(outcomes[0]?.error ?? 'unexpected', 502))
	}

	const body: ImgTo3dSubmitResponse = { batchId, jobs: outcomes }
	return respond(ApiResponse.success(body, 202))
}

/** `GET /api/img-to-3d/generations/:jobId` */
export async function handleImgTo3dGenerationStatus(
	request: Request,
	jobId: string | undefined,
	deps: ImgTo3dHandlerDeps
): Promise<Response> {
	const admitted = await admitToJob(request, jobId, deps)
	if (admitted instanceof Response) return admitted

	try {
		const state = await deps.runtime().status(admitted.job.id)
		return withAuthHeaders(
			ApiResponse.success(withoutFailureDetail(state)),
			admitted.headers
		)
	} catch (error) {
		return withAuthHeaders(runtimeFailure(error), admitted.headers)
	}
}

/**
 * `GET /api/img-to-3d/generations/:jobId/artifact`: the GLB, streamed through.
 *
 * Named as an attachment, so a plain link saves it as a file; `fetch`, which
 * is how the publisher opens a variant, ignores the header.
 */
export async function handleImgTo3dGenerationArtifact(
	request: Request,
	jobId: string | undefined,
	deps: ImgTo3dHandlerDeps
): Promise<Response> {
	const admitted = await admitToJob(request, jobId, deps)
	if (admitted instanceof Response) return admitted

	try {
		const artifact = await deps.runtime().artifact(admitted.job.id)
		const fileName = imgTo3dVariantFileName(
			admitted.job.sourceName,
			admitted.job.seed
		)
		return withAuthHeaders(
			new Response(artifact.body, {
				status: 200,
				headers: {
					'Content-Type': 'model/gltf-binary',
					'Cache-Control': 'no-store',
					'Content-Disposition': contentDisposition(fileName)
				}
			}),
			admitted.headers
		)
	} catch (error) {
		return withAuthHeaders(runtimeFailure(error), admitted.headers)
	}
}

/**
 * The Generations page: an organization's recent batches, each variant with
 * its state as the runtime reports it now. A variant the runtime could not be
 * asked about comes back with a null status, and the page polls it.
 *
 * Takes an organization rather than a request: the page's loader admits the
 * caller with `resolveImgTo3dAccess`, the same rule the job routes apply.
 */
export async function listImgTo3dGenerations(
	organizationId: string,
	deps: Pick<ImgTo3dHandlerDeps, 'jobs' | 'runtime'>,
	now: Date = new Date()
): Promise<ImgTo3dListedBatch[]> {
	const jobs = await deps.jobs.listForOrganization(
		organizationId,
		IMG_TO_3D_LIST_BATCH_LIMIT
	)
	if (jobs.length === 0) return []

	let runtime: ImgTo3dRuntime | null = null
	try {
		runtime = deps.runtime()
	} catch (error) {
		console.error('[img-to-3d] runtime unavailable for the list', error)
	}
	const keptUntil = (job: ImgTo3dJobListing) =>
		job.createdAt.getTime() + IMG_TO_3D_RETENTION_MS
	const isExpired = (job: ImgTo3dJobListing) => keptUntil(job) <= now.getTime()

	// A few requests at a time, so a long list cannot fan out to the runtime
	// all at once; expired jobs are not asked about at all.
	const states = new Array<
		Pick<ImgTo3dListedVariant, 'status' | 'progress' | 'error'>
	>(jobs.length).fill({ status: null, progress: null, error: null })
	let next = 0
	await Promise.all(
		Array.from({ length: LIST_STATUS_CONCURRENCY }, async () => {
			while (next < jobs.length) {
				const index = next++
				if (!isExpired(jobs[index])) {
					states[index] = await listedState(runtime, jobs[index].id)
				}
			}
		})
	)

	const batches = new Map<
		string,
		ImgTo3dListedBatch & { variants: ImgTo3dListedVariant[] }
	>()
	jobs.forEach((job, index) => {
		let batch = batches.get(job.batchId)
		if (!batch) {
			batch = {
				batchId: job.batchId,
				sourceName: job.sourceName,
				createdByName: job.createdByName,
				createdAt: job.createdAt.toISOString(),
				keptUntil: new Date(keptUntil(job)).toISOString(),
				expired: isExpired(job),
				variants: []
			}
			batches.set(job.batchId, batch)
		}
		batch.variants.push({ jobId: job.id, seed: job.seed, ...states[index] })
	})
	return [...batches.values()]
}
