import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	isTerminalImgTo3dStatus,
	type ImgTo3dJobState,
	type ImgTo3dJobStatus
} from './img-to-3d-contract'
import { isImgTo3dMockMode } from './img-to-3d-gate'
import {
	ImgTo3dRuntimeError,
	type ImgTo3dRuntime,
	type ImgTo3dRuntimeSubmission
} from './img-to-3d-handlers'

// ---------------------------------------------------------------------------
// Live: apps/img-to-3d-runtime on Modal
// ---------------------------------------------------------------------------

const JSON_TIMEOUT_MS = 20_000
// A 4K-textured model can be tens of megabytes.
const ARTIFACT_TIMEOUT_MS = 120_000

function readRuntimeConfig() {
	const baseUrl = process.env.IMG_TO_3D_RUNTIME_BASE_URL?.trim()
	const proxyKey = process.env.IMG_TO_3D_RUNTIME_PROXY_KEY?.trim()
	const proxySecret = process.env.IMG_TO_3D_RUNTIME_PROXY_SECRET?.trim()

	if (!baseUrl || !proxyKey || !proxySecret) {
		throw new ImgTo3dRuntimeError(
			'runtime_unavailable',
			503,
			'IMG_TO_3D_RUNTIME_BASE_URL, _PROXY_KEY or _PROXY_SECRET is not set.'
		)
	}

	return { baseUrl: baseUrl.replace(/\/+$/, ''), proxyKey, proxySecret }
}

/*
  A connection that was never made sent nothing, so the runtime cannot have
  acted. Anything else - a reset, a hang-up mid-reply - may have come after
  the runtime read the request.
*/
const NEVER_CONNECTED_CODES = new Set([
	'ECONNREFUSED',
	'ENOTFOUND',
	'EAI_AGAIN',
	'EHOSTUNREACH',
	'ENETUNREACH',
	// undici's own connect timeout, before any byte of the request is written.
	'UND_ERR_CONNECT_TIMEOUT'
])

function neverConnected(error: unknown): boolean {
	const code = (error as { cause?: { code?: unknown } } | null)?.cause?.code
	return typeof code === 'string' && NEVER_CONNECTED_CODES.has(code)
}

async function callRuntime(
	path: string,
	init: RequestInit,
	timeoutMs: number
): Promise<Response> {
	const { baseUrl, proxyKey, proxySecret } = readRuntimeConfig()

	// Bounds the wait for an answer, not the body: an artifact streams on to
	// the browser afterwards at whatever speed the browser reads it.
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), timeoutMs)

	try {
		return await fetch(`${baseUrl}${path}`, {
			...init,
			// Modal checks these at its edge, before the request reaches a container.
			headers: { 'Modal-Key': proxyKey, 'Modal-Secret': proxySecret },
			signal: controller.signal
		})
	} catch (error) {
		const timedOut = controller.signal.aborted
		throw new ImgTo3dRuntimeError(
			'runtime_unavailable',
			503,
			timedOut
				? `${path} did not answer within ${timeoutMs} ms.`
				: `${path} failed: ${String(error)}`,
			timedOut || !neverConnected(error)
		)
	} finally {
		clearTimeout(timer)
	}
}

async function readRuntimeError(response: Response): Promise<never> {
	const payload = (await response.json().catch(() => null)) as {
		error?: unknown
	} | null
	const detail = `The runtime answered ${response.status}: ${
		typeof payload?.error === 'string' ? payload.error : 'no error body'
	}`
	// A runtime 5xx is our upstream failing, not the caller's request.
	throw response.status >= 500
		? new ImgTo3dRuntimeError('runtime_unavailable', 502, detail)
		: new ImgTo3dRuntimeError('runtime_rejected', response.status, detail)
}

const RUNTIME_STATUSES: readonly ImgTo3dJobStatus[] = [
	'queued',
	'processing',
	'succeeded',
	'failed'
]

function isJobState(value: unknown): value is ImgTo3dJobState {
	if (typeof value !== 'object' || value === null) return false
	const state = value as Record<string, unknown>
	return (
		typeof state.jobId === 'string' &&
		RUNTIME_STATUSES.includes(state.status as ImgTo3dJobStatus) &&
		(state.progress === null || typeof state.progress === 'number') &&
		(state.message === null || typeof state.message === 'string') &&
		typeof state.artifactReady === 'boolean' &&
		typeof state.pollAfterMs === 'number'
	)
}

export const liveImgTo3dRuntime: ImgTo3dRuntime = {
	async submit(submission: ImgTo3dRuntimeSubmission): Promise<void> {
		const body = new FormData()
		body.set('jobId', submission.jobId)
		body.set('seed', String(submission.seed))
		body.set('resolution', String(submission.resolution))
		body.set('textureSize', String(submission.textureSize))
		body.set('decimationTarget', String(submission.decimationTarget))
		body.set('image', submission.image, submission.image.name)

		const response = await callRuntime(
			'/generations',
			{ method: 'POST', body },
			JSON_TIMEOUT_MS
		)
		if (!response.ok) await readRuntimeError(response)
	},

	async status(jobId: string): Promise<ImgTo3dJobState> {
		const response = await callRuntime(
			`/generations/${encodeURIComponent(jobId)}`,
			{ method: 'GET' },
			JSON_TIMEOUT_MS
		)
		if (!response.ok) await readRuntimeError(response)

		const payload = (await response.json().catch(() => null)) as {
			data?: unknown
		} | null
		if (!isJobState(payload?.data)) {
			throw new ImgTo3dRuntimeError(
				'runtime_unavailable',
				502,
				'The runtime answered a job state with an unexpected shape.'
			)
		}
		return payload.data
	},

	async artifact(jobId: string): Promise<Response> {
		const response = await callRuntime(
			`/generations/${encodeURIComponent(jobId)}/artifact`,
			{ method: 'GET' },
			ARTIFACT_TIMEOUT_MS
		)
		if (!response.ok) await readRuntimeError(response)
		return response
	}
}

// ---------------------------------------------------------------------------
// Mock: the default for local development and tests
// ---------------------------------------------------------------------------

/** Long enough to see a job move through its states, short enough to wait for. */
export const MOCK_DURATION_MS = 8_000
const MOCK_QUEUED_MS = 1_500

/*
  An existing small model, resolved from this file rather than from /public so
  it does not depend on how assets are served. Never read in production: mock
  mode is off there (`isImgTo3dMockMode`).
*/
const MOCK_ARTIFACT_PATH = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../assets/models/rocket-balanced.glb'
)

/**
 * Fakes the runtime's lifecycle in-process: queued, then processing with
 * rising progress, then succeeded with a fixture model. State is per process,
 * so a dev-server restart forgets its jobs, which then report as failed.
 */
export function createMockImgTo3dRuntime(
	now: () => number = Date.now
): ImgTo3dRuntime {
	const jobs = new Map<string, number>()

	function stateOf(jobId: string): ImgTo3dJobState {
		const startedAt = jobs.get(jobId)
		if (startedAt === undefined) {
			return {
				jobId,
				status: 'failed',
				progress: null,
				// Logged, then stripped, like any runtime failure detail.
				message: 'Unknown to the mock runtime (was the dev server restarted?)',
				artifactReady: false,
				pollAfterMs: 0
			}
		}

		const elapsed = now() - startedAt
		const status: ImgTo3dJobStatus =
			elapsed < MOCK_QUEUED_MS
				? 'queued'
				: elapsed < MOCK_DURATION_MS
					? 'processing'
					: 'succeeded'

		return {
			jobId,
			status,
			progress:
				status === 'queued'
					? null
					: Math.min(
							100,
							Math.round(
								((elapsed - MOCK_QUEUED_MS) /
									(MOCK_DURATION_MS - MOCK_QUEUED_MS)) *
									100
							)
						),
			message: status === 'processing' ? 'Generating (mock)' : null,
			artifactReady: status === 'succeeded',
			pollAfterMs: isTerminalImgTo3dStatus(status) ? 0 : 1_000
		}
	}

	return {
		async submit({ jobId }) {
			jobs.set(jobId, now())
		},

		async status(jobId) {
			return stateOf(jobId)
		},

		async artifact(jobId) {
			if (!stateOf(jobId).artifactReady) {
				throw new ImgTo3dRuntimeError(
					'runtime_rejected',
					404,
					'The mock model is not ready yet.'
				)
			}
			const glb = await readFile(MOCK_ARTIFACT_PATH)
			return new Response(glb, {
				headers: { 'Content-Type': 'model/gltf-binary' }
			})
		}
	}
}

// One per process, so jobs survive between requests.
const mockImgTo3dRuntime = createMockImgTo3dRuntime()

/** Read per call, so the env var is seen after Vite loads `.env.development`. */
export function getImgTo3dRuntime(): ImgTo3dRuntime {
	return isImgTo3dMockMode() ? mockImgTo3dRuntime : liveImgTo3dRuntime
}
