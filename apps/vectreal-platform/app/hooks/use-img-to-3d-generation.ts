import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthenticityToken } from 'remix-utils/csrf/react'

import {
	IMG_TO_3D_FIELDS,
	imgTo3dErrorKind,
	isTerminalImgTo3dStatus,
	type ImgTo3dErrorKind,
	type ImgTo3dGenerationParams,
	type ImgTo3dJobState,
	type ImgTo3dJobStatus,
	type ImgTo3dSubmitResponse
} from '../lib/domain/img-to-3d/img-to-3d-contract'

const ENDPOINT = '/api/img-to-3d/generations'
/** Used until the runtime says how long to wait. */
const DEFAULT_POLL_MS = 2_000

export interface ImgTo3dCandidate {
	readonly jobId: string
	readonly seed: number
	readonly status: ImgTo3dJobStatus
	readonly progress: number | null
	readonly error: ImgTo3dErrorKind | null
	/** For the elapsed time a queued job shows: cold starts take minutes. */
	readonly submittedAt: number
	/** The image it was generated from, to name the loaded model after. */
	readonly sourceName: string
}

/** A failed request, as the kind the API named or `unexpected`. */
class ImgTo3dRequestError extends Error {
	constructor(
		readonly kind: ImgTo3dErrorKind,
		readonly status: number
	) {
		super(kind)
		this.name = 'ImgTo3dRequestError'
	}

	/**
	 * Asking again will get the same answer: the job is gone, not ours, or
	 * refused. A 5xx, a timeout or a rate limit may pass, and so may a 401,
	 * which a brief Supabase Auth failure also produces; those poll on.
	 */
	get isFinal(): boolean {
		return (
			this.status >= 400 &&
			this.status < 500 &&
			![401, 408, 429].includes(this.status)
		)
	}
}

/** Anything thrown, as the kind to show: a network failure is `fallback`. */
function kindOf(error: unknown, fallback: ImgTo3dErrorKind): ImgTo3dErrorKind {
	return error instanceof ImgTo3dRequestError ? error.kind : fallback
}

async function readEnvelope<T>(response: Response): Promise<T> {
	const payload = (await response.json().catch(() => null)) as {
		success?: boolean
		data?: T
		error?: unknown
	} | null
	if (!response.ok || !payload?.success || payload.data === undefined) {
		throw new ImgTo3dRequestError(
			imgTo3dErrorKind(payload?.error),
			response.status
		)
	}
	return payload.data
}

function baseName(fileName: string): string {
	return fileName.replace(/\.[^.]+$/, '') || 'generated'
}

/**
 * Image-to-3D generation for the publisher: submits an image as several seeded
 * variants, polls each until it finishes, and loads the chosen one.
 *
 * Owned by the publisher shell, not the empty stage. Loading a variant replaces
 * the empty stage with the model, which unmounts it; state held there would
 * forget the other variants the moment the first one was opened.
 *
 * A chosen variant goes through `loadModel`, the same path a dropped file
 * takes, so it arrives as a new scene with its optimization baseline.
 */
export function useImgTo3dGeneration(
	loadModel: (files: File[]) => Promise<unknown>
) {
	const csrf = useAuthenticityToken()
	const [candidates, setCandidates] = useState<readonly ImgTo3dCandidate[]>([])
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState<ImgTo3dErrorKind | null>(null)
	const [loadingJobId, setLoadingJobId] = useState<string | null>(null)
	const [pollAfterMs, setPollAfterMs] = useState(DEFAULT_POLL_MS)
	// Bumped after each round, so the effect below schedules the next one.
	const [pollRound, setPollRound] = useState(0)

	const pendingIds = useMemo(
		() =>
			candidates
				.filter((candidate) => !isTerminalImgTo3dStatus(candidate.status))
				.map((candidate) => candidate.jobId),
		[candidates]
	)
	const pendingKey = pendingIds.join(',')

	useEffect(() => {
		if (pendingIds.length === 0) return
		const controller = new AbortController()

		const timer = setTimeout(async () => {
			const updates = new Map<string, Partial<ImgTo3dCandidate>>()
			const nextDelays: number[] = []
			await Promise.all(
				pendingIds.map(async (jobId) => {
					try {
						const state = await readEnvelope<ImgTo3dJobState>(
							await fetch(`${ENDPOINT}/${encodeURIComponent(jobId)}`, {
								signal: controller.signal
							})
						)
						updates.set(jobId, {
							status: state.status,
							progress: state.progress,
							error: state.status === 'failed' ? 'generation_failed' : null
						})
						if (state.pollAfterMs > 0) nextDelays.push(state.pollAfterMs)
					} catch (error) {
						// A poll that may pass leaves the job pending; a refusal ends it.
						if (error instanceof ImgTo3dRequestError && error.isFinal) {
							updates.set(jobId, { status: 'failed', error: error.kind })
						}
					}
				})
			)
			if (controller.signal.aborted) return

			setCandidates((current) =>
				current.map((candidate) => {
					const update = updates.get(candidate.jobId)
					return update ? { ...candidate, ...update } : candidate
				})
			)
			setPollAfterMs(
				nextDelays.length > 0 ? Math.min(...nextDelays) : DEFAULT_POLL_MS
			)
			setPollRound((round) => round + 1)
		}, pollAfterMs)

		return () => {
			controller.abort()
			clearTimeout(timer)
		}
		// pendingKey stands in for pendingIds, which is a new array every render.
	}, [pendingKey, pollRound])

	const generate = useCallback(
		async (
			image: File,
			params: ImgTo3dGenerationParams & { seedCount: number }
		) => {
			setIsSubmitting(true)
			setSubmitError(null)
			try {
				const body = new FormData()
				body.set(IMG_TO_3D_FIELDS.image, image)
				body.set(IMG_TO_3D_FIELDS.resolution, String(params.resolution))
				body.set(IMG_TO_3D_FIELDS.textureSize, String(params.textureSize))
				body.set(
					IMG_TO_3D_FIELDS.decimationTarget,
					String(params.decimationTarget)
				)
				body.set(IMG_TO_3D_FIELDS.seedCount, String(params.seedCount))
				if (csrf) body.set('csrf', csrf)

				const result = await readEnvelope<ImgTo3dSubmitResponse>(
					await fetch(ENDPOINT, { method: 'POST', body })
				)
				const submittedAt = Date.now()
				setPollAfterMs(DEFAULT_POLL_MS)
				setCandidates((current) => [
					...result.jobs.map((job) => ({
						jobId: job.jobId,
						seed: job.seed,
						status: job.status,
						progress: null,
						error: job.error,
						submittedAt,
						sourceName: baseName(image.name)
					})),
					...current
				])
			} catch (error) {
				setSubmitError(kindOf(error, 'runtime_unavailable'))
			} finally {
				setIsSubmitting(false)
			}
		},
		[csrf]
	)

	const loadCandidate = useCallback(
		async (jobId: string) => {
			const candidate = candidates.find((c) => c.jobId === jobId)
			if (!candidate || candidate.status !== 'succeeded') return

			setLoadingJobId(jobId)
			setCandidates((current) =>
				current.map((c) => (c.jobId === jobId ? { ...c, error: null } : c))
			)
			try {
				const response = await fetch(
					`${ENDPOINT}/${encodeURIComponent(jobId)}/artifact`
				)
				if (!response.ok) {
					await readEnvelope(response)
				}
				const blob = await response.blob()
				const file = new File(
					[blob],
					`${candidate.sourceName}-${candidate.seed}.glb`,
					{ type: 'model/gltf-binary' }
				)
				await loadModel([file])
			} catch (error) {
				setCandidates((current) =>
					current.map((c) =>
						c.jobId === jobId
							? { ...c, error: kindOf(error, 'open_failed') }
							: c
					)
				)
			} finally {
				setLoadingJobId(null)
			}
		},
		[candidates, loadModel]
	)

	return {
		candidates,
		isSubmitting,
		submitError,
		loadingJobId,
		generate,
		loadCandidate
	}
}

export type ImgTo3dGeneration = ReturnType<typeof useImgTo3dGeneration>
