import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Shared types — mirror the Pydantic models in apps/img-to-3d-runtime/api.py.
// Any field added/renamed there must be updated here to avoid silent mismatches.
// ---------------------------------------------------------------------------

export type ImgTo3dRuntimeGenerationStatus =
	| 'queued'
	| 'starting'
	| 'processing'
	| 'succeeded'
	| 'failed'

/** One job entry returned per image on submission. */
export interface ImgTo3dRuntimeJobEntry {
	jobId: string
	status: ImgTo3dRuntimeGenerationStatus
	pollAfterMs: number
}

/** Full status object returned by the polling endpoint. */
export interface ImgTo3dRuntimeStatusResponse {
	jobId: string
	status: ImgTo3dRuntimeGenerationStatus
	progress: number | null
	message: string | null
	artifactReady: boolean
	retryable: boolean
	pollAfterMs: number
}

interface ImgTo3dRuntimeEnvelope<T> {
	success: boolean
	data?: T
	error?: string
}

export class ImgTo3dRuntimeError extends Error {
	readonly status: number

	constructor(message: string, status: number) {
		super(message)
		this.name = 'ImgTo3dRuntimeError'
		this.status = status
	}
}

// ---------------------------------------------------------------------------
// Runtime shape guards
// Validate the wire format returned by the Modal runtime so type mismatches
// (e.g. after a Python-side schema change) fail loudly at the boundary rather
// than propagating as undefined values deeper in the request chain.
// ---------------------------------------------------------------------------

function isJobEntry(v: unknown): v is ImgTo3dRuntimeJobEntry {
	if (typeof v !== 'object' || v === null) return false
	const o = v as Record<string, unknown>
	return (
		typeof o.jobId === 'string' &&
		typeof o.status === 'string' &&
		typeof o.pollAfterMs === 'number'
	)
}

function isStatusResponse(v: unknown): v is ImgTo3dRuntimeStatusResponse {
	if (typeof v !== 'object' || v === null) return false
	const o = v as Record<string, unknown>
	return (
		typeof o.jobId === 'string' &&
		typeof o.status === 'string' &&
		typeof o.artifactReady === 'boolean' &&
		typeof o.retryable === 'boolean' &&
		typeof o.pollAfterMs === 'number' &&
		(o.progress === null || typeof o.progress === 'number') &&
		(o.message === null ||
			typeof o.message === 'string' ||
			o.message === undefined)
	)
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 20_000

function getRuntimeBaseUrl(): string {
	const baseUrl = process.env.IMG_TO_3D_RUNTIME_BASE_URL?.trim()
	if (!baseUrl) throw new Error('IMG_TO_3D_RUNTIME_BASE_URL is not configured')
	return baseUrl.replace(/\/+$/, '')
}

function getRuntimeAuthSecret(): string {
	const secret = process.env.IMG_TO_3D_RUNTIME_AUTH_SECRET?.trim()
	if (!secret) throw new Error('IMG_TO_3D_RUNTIME_AUTH_SECRET is not configured')
	return secret
}

async function fetchRuntime(
	pathname: string,
	init: RequestInit,
	timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), timeoutMs)

	try {
		return await fetch(`${getRuntimeBaseUrl()}${pathname}`, {
			...init,
			headers: {
				'x-img-to-3d-runtime-secret': getRuntimeAuthSecret(),
				...init.headers
			},
			signal: controller.signal
		})
	} catch (error) {
		if (error instanceof ImgTo3dRuntimeError) throw error
		throw new ImgTo3dRuntimeError(
			error instanceof Error
				? error.message
				: 'Failed to reach image-to-3D runtime',
			503
		)
	} finally {
		clearTimeout(timeout)
	}
}

async function parseRuntimeResponse<T>(
	response: Response,
	guard: (v: unknown) => v is T,
	fallbackMessage: string
): Promise<T> {
	let payload: ImgTo3dRuntimeEnvelope<T> | null = null

	try {
		payload = (await response.json()) as ImgTo3dRuntimeEnvelope<T>
	} catch {
		payload = null
	}

	if (!response.ok || !payload?.data) {
		// FastAPI validation errors use { detail: [...] }, not { error: "..." }
		const fastApiDetail = (payload as Record<string, unknown> | null)?.detail
		const errorMsg = payload?.error
			?? (Array.isArray(fastApiDetail)
				? fastApiDetail.map((d: Record<string, unknown>) => `${d.loc?.join('.')}: ${d.msg}`).join('; ')
				: typeof fastApiDetail === 'string' ? fastApiDetail : null)
			?? fallbackMessage
		throw new ImgTo3dRuntimeError(errorMsg, response.status || 502)
	}

	// Validate the response shape matches our TypeScript interface
	if (!guard(payload.data)) {
		throw new ImgTo3dRuntimeError(
			`Runtime returned an unexpected response shape (${fallbackMessage})`,
			502
		)
	}

	return payload.data
}

// ---------------------------------------------------------------------------
// Mock client — active when IMG_TO_3D_MOCK_MODE=true.
// Simulates the full job lifecycle in-process; no runtime URL needed.
// ---------------------------------------------------------------------------

const MOCK_TOTAL_DURATION_MS = 8_000

// A real GLB from the public directory so the viewer has actual geometry to render.
// Path is resolved relative to this source file so it works in both dev and prod-mock contexts.
const MOCK_ARTIFACT_PATH = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../public/assets/models/bike.glb'
)

const mockRuntimeClient = {
	async submitGeneration(files: File[]): Promise<ImgTo3dRuntimeJobEntry[]> {
		return files.map((_, i) => ({
			jobId: `mock-${Date.now()}-${i}`,
			status: 'queued' as const,
			pollAfterMs: 1_000
		}))
	},

	async getGenerationStatus(
		jobId: string
	): Promise<ImgTo3dRuntimeStatusResponse> {
		// Decode creation timestamp from the mock job ID to drive progress
		const createdAt = Number(jobId.split('-')[1]) || Date.now()
		const elapsed = Date.now() - createdAt

		if (elapsed < 2_000) {
			return {
				jobId,
				status: 'queued',
				progress: null,
				message: null,
				artifactReady: false,
				retryable: false,
				pollAfterMs: 1_000
			}
		}

		if (elapsed < MOCK_TOTAL_DURATION_MS) {
			const progress = Math.min(
				99,
				Math.floor(((elapsed - 2_000) / (MOCK_TOTAL_DURATION_MS - 2_000)) * 100)
			)
			return {
				jobId,
				status: 'processing',
				progress,
				message: 'Generating model…',
				artifactReady: false,
				retryable: false,
				pollAfterMs: 1_000
			}
		}

		return {
			jobId,
			status: 'succeeded',
			progress: 100,
			message: null,
			artifactReady: true,
			retryable: false,
			pollAfterMs: 0
		}
	},

	async getGenerationArtifact(_jobId: string): Promise<Response> {
		const data = await readFile(MOCK_ARTIFACT_PATH).catch(() => null)
		if (!data) {
			throw new ImgTo3dRuntimeError(
				`Mock artifact not found at ${MOCK_ARTIFACT_PATH}`,
				404
			)
		}
		return new Response(data, {
			status: 200,
			headers: {
				'Content-Type': 'model/gltf-binary',
				'Content-Disposition': 'attachment; filename="mock-generated.glb"'
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Live client — calls the Modal runtime HTTP API
// ---------------------------------------------------------------------------

const liveRuntimeClient = {
	async submitGeneration(files: File[]): Promise<ImgTo3dRuntimeJobEntry[]> {
		const formData = new FormData()
		for (const file of files) {
			formData.append('images', file, file.name)
		}

		const response = await fetchRuntime('/generations', {
			method: 'POST',
			body: formData
		})

		const data = await parseRuntimeResponse<{ jobs: unknown[] }>(
			response,
			(v): v is { jobs: unknown[] } =>
				typeof v === 'object' &&
				v !== null &&
				Array.isArray((v as Record<string, unknown>).jobs),
			'Failed to submit image-to-3D generation job'
		)

		const jobs = data.jobs
		if (!jobs.every(isJobEntry)) {
			throw new ImgTo3dRuntimeError(
				'Runtime returned malformed job entries on submission',
				502
			)
		}

		return jobs as ImgTo3dRuntimeJobEntry[]
	},

	async getGenerationStatus(
		jobId: string
	): Promise<ImgTo3dRuntimeStatusResponse> {
		const response = await fetchRuntime(`/generations/${jobId}`, {
			method: 'GET'
		})

		return parseRuntimeResponse<ImgTo3dRuntimeStatusResponse>(
			response,
			isStatusResponse,
			'Failed to read image-to-3D generation status'
		)
	},

	async getGenerationArtifact(jobId: string): Promise<Response> {
		const response = await fetchRuntime(`/generations/${jobId}/artifact`, {
			method: 'GET'
		})

		if (!response.ok) {
			let message = 'Failed to download generated model'
			try {
				const payload = (await response.json()) as ImgTo3dRuntimeEnvelope<never>
				message = payload.error || message
			} catch {
				// ignore malformed error payloads
			}
			throw new ImgTo3dRuntimeError(message, response.status || 502)
		}

		return response
	}
}

// ---------------------------------------------------------------------------
// Export a proxy that selects the active client per-call so that
// IMG_TO_3D_MOCK_MODE is read at request time rather than at module
// evaluation time (which happens before Vite injects .env.development).
// ---------------------------------------------------------------------------

function getActiveClient() {
	return process.env.IMG_TO_3D_MOCK_MODE === 'true' ? mockRuntimeClient : liveRuntimeClient
}

export const imgTo3dRuntimeClient = {
	submitGeneration: (...args: Parameters<typeof liveRuntimeClient.submitGeneration>) =>
		getActiveClient().submitGeneration(...args),

	getGenerationStatus: (...args: Parameters<typeof liveRuntimeClient.getGenerationStatus>) =>
		getActiveClient().getGenerationStatus(...args),

	getGenerationArtifact: (...args: Parameters<typeof liveRuntimeClient.getGenerationArtifact>) =>
		getActiveClient().getGenerationArtifact(...args)
}
