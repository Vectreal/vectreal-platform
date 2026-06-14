export type TrellisRuntimeGenerationStatus =
	| 'queued'
	| 'starting'
	| 'processing'
	| 'succeeded'
	| 'failed'

interface TrellisRuntimeEnvelope<T> {
	success?: boolean
	data?: T
	error?: string
}

export interface TrellisRuntimeSubmitResponse {
	jobId: string
	status: TrellisRuntimeGenerationStatus
	pollAfterMs: number
}

export interface TrellisRuntimeStatusResponse extends TrellisRuntimeSubmitResponse {
	progress: null | number
	message?: null | string
	artifactReady: boolean
	retryable: boolean
}

export class TrellisRuntimeError extends Error {
	readonly status: number

	constructor(message: string, status: number) {
		super(message)
		this.name = 'TrellisRuntimeError'
		this.status = status
	}
}

const DEFAULT_TIMEOUT_MS = 20_000

function getRuntimeBaseUrl(): string {
	const baseUrl = process.env.TRELLIS_RUNTIME_BASE_URL?.trim()
	if (!baseUrl) {
		throw new Error('TRELLIS_RUNTIME_BASE_URL is not configured')
	}

	return baseUrl.replace(/\/+$/, '')
}

function getRuntimeAuthSecret(): string {
	const secret = process.env.TRELLIS_RUNTIME_AUTH_SECRET?.trim()
	if (!secret) {
		throw new Error('TRELLIS_RUNTIME_AUTH_SECRET is not configured')
	}

	return secret
}

async function parseRuntimeResponse<T>(
	response: Response,
	fallbackMessage: string
): Promise<T> {
	let payload: TrellisRuntimeEnvelope<T> | null = null

	try {
		payload = (await response.json()) as TrellisRuntimeEnvelope<T>
	} catch {
		payload = null
	}

	if (!response.ok || !payload?.data) {
		throw new TrellisRuntimeError(
			payload?.error || fallbackMessage,
			response.status || 502
		)
	}

	return payload.data
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
				'x-trellis-runtime-secret': getRuntimeAuthSecret(),
				...init.headers
			},
			signal: controller.signal
		})
	} catch (error) {
		if (error instanceof TrellisRuntimeError) {
			throw error
		}

		throw new TrellisRuntimeError(
			error instanceof Error ? error.message : 'Failed to reach Trellis runtime',
			503
		)
	} finally {
		clearTimeout(timeout)
	}
}

export const trellisRuntimeClient = {
	async submitGeneration(file: File): Promise<TrellisRuntimeSubmitResponse> {
		const bytes = new Uint8Array(await file.arrayBuffer())
		const response = await fetchRuntime('/generations', {
			method: 'POST',
			headers: {
				'Content-Type': file.type || 'application/octet-stream',
				'x-trellis-filename': file.name
			},
			body: bytes
		})

		return parseRuntimeResponse<TrellisRuntimeSubmitResponse>(
			response,
			'Failed to submit Trellis generation job'
		)
	},

	async getGenerationStatus(
		jobId: string
	): Promise<TrellisRuntimeStatusResponse> {
		const response = await fetchRuntime(`/generations/${jobId}`, {
			method: 'GET'
		})

		return parseRuntimeResponse<TrellisRuntimeStatusResponse>(
			response,
			'Failed to read Trellis generation status'
		)
	},

	async getGenerationArtifact(jobId: string): Promise<Response> {
		const response = await fetchRuntime(`/generations/${jobId}/artifact`, {
			method: 'GET'
		})

		if (!response.ok) {
			let message = 'Failed to download generated model'
			try {
				const payload = (await response.json()) as TrellisRuntimeEnvelope<never>
				message = payload.error || message
			} catch {
				// ignore malformed runtime error payloads
			}

			throw new TrellisRuntimeError(message, response.status || 502)
		}

		return response
	}
}

