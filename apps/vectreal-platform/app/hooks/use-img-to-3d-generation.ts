import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthenticityToken } from 'remix-utils/csrf/react'

import {
	IMG_TO_3D_FIELDS,
	imgTo3dErrorKind,
	imgTo3dSourceName,
	imgTo3dVariantFileName,
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
/**
 * Polls in a row that may pass before a job is given up on: a minute or two
 * at the usual interval, so a brief outage is ridden out and a lasting one
 * ends instead of polling for as long as the tab is open.
 */
export const MAX_CONSECUTIVE_POLL_FAILURES = 30

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
	 * Asking again will get the same answer: the runtime does not know the job
	 * (a 404 it sent, `runtime_rejected`), or the request was refused. A 5xx, a
	 * timeout or a rate limit may pass, and so may a 401, which a brief Supabase
	 * Auth failure also produces. So may the gate's plain 404: it is evaluated
	 * against PostHog on every poll, and a failed evaluation denies. Those poll
	 * on, up to `MAX_CONSECUTIVE_POLL_FAILURES`.
	 */
	get isFinal(): boolean {
		if (this.status === 404) return this.kind === 'runtime_rejected'
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

/** A job's state as polling last saw it. */
export type ImgTo3dJobUpdate = Pick<
	ImgTo3dCandidate,
	'status' | 'progress' | 'error'
>

/**
 * Polls each of `pendingIds` until it ends, and hands every round's changes to
 * `onUpdates`. A job ends on a terminal status, on a refusal that asking again
 * would only repeat, or after `MAX_CONSECUTIVE_POLL_FAILURES` failed polls in
 * a row; each of those arrives as a terminal status, and the caller drops the
 * job from `pendingIds` once it has one.
 *
 * Shared by the publisher's panel and the dashboard's Generations page, so a
 * variant ends the same way wherever it is watched.
 */
export function useImgTo3dJobPolling(
	pendingIds: readonly string[],
	onUpdates: (updates: ReadonlyMap<string, Partial<ImgTo3dJobUpdate>>) => void
) {
	const [pollAfterMs, setPollAfterMs] = useState(DEFAULT_POLL_MS)
	// Bumped after each round, so the effect below schedules the next one.
	const [pollRound, setPollRound] = useState(0)
	// Failed polls in a row, per job; a successful one clears its count.
	const pollFailures = useRef(new Map<string, number>())
	// Every job polled so far, to tell a newly added one apart.
	const seenIds = useRef(new Set<string>())
	// Read when a round starts, so a new callback each render does not
	// restart the timer.
	const onUpdatesRef = useRef(onUpdates)
	useEffect(() => {
		onUpdatesRef.current = onUpdates
	})

	/*
	  A string, so the effect below restarts when the set of pending jobs
	  changes rather than whenever the caller passes a new array, which every
	  progress update makes.
	*/
	const pendingKey = pendingIds.join(',')

	useEffect(() => {
		if (!pendingKey) return
		const ids = pendingKey.split(',')
		const controller = new AbortController()
		// A job just added gets its first answer at the default pace, not the
		// pace the runtime last asked for on the others.
		const hasNewcomer = ids.some((id) => !seenIds.current.has(id))
		for (const id of ids) seenIds.current.add(id)

		const timer = setTimeout(
			async () => {
				// Taken as the round starts: if the caller's data changes while the
				// requests are out, the answers go to the callback they were asked for.
				const onUpdates = onUpdatesRef.current
				const updates = new Map<string, Partial<ImgTo3dJobUpdate>>()
				const nextDelays: number[] = []
				await Promise.all(
					ids.map(async (jobId) => {
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
							pollFailures.current.delete(jobId)
						} catch (error) {
							if (controller.signal.aborted) return
							// A poll that may pass leaves the job pending, until too many
							// in a row; a refusal ends it at once.
							const failures = (pollFailures.current.get(jobId) ?? 0) + 1
							pollFailures.current.set(jobId, failures)
							const final =
								error instanceof ImgTo3dRequestError && error.isFinal
							if (final || failures >= MAX_CONSECUTIVE_POLL_FAILURES) {
								updates.set(jobId, {
									status: 'failed',
									error: kindOf(error, 'runtime_unavailable')
								})
							}
						}
					})
				)
				if (controller.signal.aborted) return

				onUpdates(updates)
				setPollAfterMs(
					nextDelays.length > 0 ? Math.min(...nextDelays) : DEFAULT_POLL_MS
				)
				setPollRound((round) => round + 1)
			},
			hasNewcomer ? DEFAULT_POLL_MS : pollAfterMs
		)

		return () => {
			controller.abort()
			clearTimeout(timer)
		}
	}, [pendingKey, pollRound, pollAfterMs])
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
	/** `uploadFiles`, which reports a failed load in its result rather than throwing. */
	loadModel: (files: File[]) => Promise<{ readonly status: string }>
) {
	const csrf = useAuthenticityToken()
	const [candidates, setCandidates] = useState<readonly ImgTo3dCandidate[]>([])
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState<ImgTo3dErrorKind | null>(null)
	const [loadingJobId, setLoadingJobId] = useState<string | null>(null)
	const pendingIds = candidates
		.filter((candidate) => !isTerminalImgTo3dStatus(candidate.status))
		.map((candidate) => candidate.jobId)

	useImgTo3dJobPolling(pendingIds, (updates) =>
		setCandidates((current) =>
			current.map((candidate) => {
				const update = updates.get(candidate.jobId)
				return update ? { ...candidate, ...update } : candidate
			})
		)
	)

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
				setCandidates((current) => [
					...result.jobs.map((job) => ({
						jobId: job.jobId,
						seed: job.seed,
						status: job.status,
						progress: null,
						error: job.error,
						submittedAt,
						sourceName: imgTo3dSourceName(image.name)
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
					imgTo3dVariantFileName(candidate.sourceName, candidate.seed),
					{ type: 'model/gltf-binary' }
				)
				const result = await loadModel([file])
				// `uploadFiles` has already said why in a toast.
				if (result.status !== 'ready') throw new Error('open_failed')
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
