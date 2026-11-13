import { useCallback, useEffect, useRef, useState } from 'react'
import { useRevalidator, useSearchParams } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { toast } from 'sonner'

import {
	IMG_TO_3D_ERROR_COPY,
	IMG_TO_3D_FIELDS,
	IMG_TO_3D_OPEN_PARAM,
	imgTo3dErrorKind,
	imgTo3dFileNameFromDisposition,
	imgTo3dVariantFileName,
	isTerminalImgTo3dStatus,
	type ImgTo3dErrorKind,
	type ImgTo3dGenerationParams,
	type ImgTo3dJobState,
	type ImgTo3dJobStatus,
	type ImgTo3dListedBatch,
	type ImgTo3dListedVariant,
	type ImgTo3dSubmitResponse,
	type ImgTo3dVariantState
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
export interface ImgTo3dJobUpdate {
	readonly status: ImgTo3dJobStatus
	readonly progress: number | null
	readonly error: ImgTo3dErrorKind | null
}

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
 * Polled states over a listed set of batches, per job, for the publisher's
 * panel and the Generations page alike.
 *
 * Each polled state remembers the list it was polled against. One polled
 * against the current list is newer than it, and wins. One from an older list
 * gives way wherever a revalidated list knows the state itself, and stands in
 * where it does not: the publisher's list never asks the runtime, so without
 * that every revalidation would throw ready variants back to "Checking".
 *
 * Unknown states are asked about first, newest first, and only a few at a
 * time: one answer usually settles them, while a variant still generating
 * holds its slot for minutes, and a runtime that refuses for a while leaves
 * every listed variant pending.
 */
export function useImgTo3dBatchStates(
	batches: readonly ImgTo3dListedBatch[]
): (variant: ImgTo3dListedVariant) => ImgTo3dVariantState {
	const [polled, setPolled] = useState<ReadonlyMap<string, PolledState>>(
		() => new Map()
	)
	const stateOf = (variant: ImgTo3dListedVariant): ImgTo3dVariantState => {
		const entry = polled.get(variant.jobId)
		if (!entry) return variant
		return entry.list === batches || variant.status === null
			? entry.state
			: variant
	}

	const pending = batches
		.filter((batch) => !batch.expired)
		.flatMap((batch) =>
			batch.variants.map((variant) => ({
				jobId: variant.jobId,
				status: stateOf(variant).status
			}))
		)
	const pendingIds = [
		...pending.filter(({ status }) => status === null),
		...pending.filter(
			({ status }) => status !== null && !isTerminalImgTo3dStatus(status)
		)
	]
		.map(({ jobId }) => jobId)
		.slice(0, POLLED_AT_ONCE)

	// The callback a round answers to is the one taken when it started, so its
	// states are filed against the list they were polled for.
	useImgTo3dJobPolling(pendingIds, (updates) =>
		setPolled((current) => {
			const next = new Map(current)
			for (const batch of batches) {
				for (const variant of batch.variants) {
					const update = updates.get(variant.jobId)
					if (!update) continue
					const previous = current.get(variant.jobId)
					next.set(variant.jobId, {
						list: batches,
						state: {
							...(previous?.list === batches ? previous.state : variant),
							...update
						}
					})
				}
			}
			return next
		})
	)

	return stateOf
}

interface PolledState {
	readonly state: ImgTo3dVariantState
	/** The list this state was polled against. */
	readonly list: readonly ImgTo3dListedBatch[]
}

/** Variants polled in one round; the rest wait their turn. */
const POLLED_AT_ONCE = 12

/**
 * Image-to-3D generation for the publisher: submits an image as several
 * seeded variants, and opens the variant the URL names.
 *
 * The list of batches is the loader's, read from the server, so a reload or a
 * Back loses nothing; submitting revalidates it to bring the new batch in. A
 * variant opens from `?generation=<jobId>` (`imgTo3dOpenHref`), which stays in
 * the URL while it is open: Back leaves it, and the publisher returns to the
 * empty stage and its list (`useSceneSource`). The artifact route decides who
 * may open what, so the URL alone decides what is opened here.
 *
 * Owned by the publisher shell, not the empty stage, which opening a variant
 * unmounts. The model goes through `loadModel`, the same path a dropped file
 * takes, so it arrives as a new scene with its optimization baseline.
 */
export function useImgTo3dGeneration(
	/** `uploadFiles`, which reports a failed load in its result rather than throwing. */
	loadModel: (files: File[]) => Promise<{ readonly status: string }>,
	/**
	 * The saved scene the route has open. A variant opens only where none is:
	 * loading one over a saved scene would let Save write it into that scene.
	 */
	routeSceneId: null | string
) {
	const csrf = useAuthenticityToken()
	const revalidator = useRevalidator()
	const [searchParams] = useSearchParams()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState<ImgTo3dErrorKind | null>(null)
	const [opening, setOpening] = useState<{
		readonly jobId: string
		readonly error: ImgTo3dErrorKind | null
	} | null>(null)
	// Bumped by `retryOpen`, which reruns the open below for the same URL.
	const [openAttempt, setOpenAttempt] = useState(0)
	const loadModelRef = useRef(loadModel)
	useEffect(() => {
		loadModelRef.current = loadModel
	})

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

				await readEnvelope<ImgTo3dSubmitResponse>(
					await fetch(ENDPOINT, { method: 'POST', body })
				)
				// Still "Starting" until the list holds the new batch.
				await revalidator.revalidate()
			} catch (error) {
				setSubmitError(kindOf(error, 'runtime_unavailable'))
			} finally {
				setIsSubmitting(false)
			}
		},
		[csrf, revalidator]
	)

	/*
	  Opens what the URL names, and only while it names it: leaving the URL, or
	  naming another variant, aborts the download, so a slow one cannot land on
	  a stage the user has moved on from, and only the latest of two quick
	  opens loads. StrictMode's second mount is the same abort and restart.
	  Keyed on the URL alone, so a revalidation never reopens over edits.
	*/
	const linkedJobId = routeSceneId
		? null
		: searchParams.get(IMG_TO_3D_OPEN_PARAM)
	useEffect(() => {
		if (!linkedJobId) return
		const jobId = linkedJobId
		const controller = new AbortController()
		const { signal } = controller
		setOpening({ jobId, error: null })

		void (async () => {
			try {
				const response = await fetch(
					`${ENDPOINT}/${encodeURIComponent(jobId)}/artifact`,
					{ signal }
				)
				if (!response.ok) {
					await readEnvelope(response)
				}
				const fileName =
					imgTo3dFileNameFromDisposition(
						response.headers.get('Content-Disposition')
					) ?? imgTo3dVariantFileName(null, 0)
				const file = new File([await response.blob()], fileName, {
					type: 'model/gltf-binary'
				})
				if (signal.aborted) return
				const result = await loadModelRef.current([file])
				// `uploadFiles` has already said why in a toast.
				if (result.status !== 'ready') throw new Error('open_failed')
				setOpening(null)
			} catch (error) {
				if (signal.aborted) return
				const kind = kindOf(error, 'open_failed')
				setOpening({ jobId, error: kind })
				// A link can name a variant the panel does not list, so a failed
				// download is said here too. A failed load already was, by `uploadFiles`.
				if (kind !== 'open_failed') toast.error(IMG_TO_3D_ERROR_COPY[kind])
			}
		})()

		return () => controller.abort()
	}, [linkedJobId, openAttempt])

	const retryOpen = useCallback(
		() => setOpenAttempt((attempt) => attempt + 1),
		[]
	)

	return {
		isSubmitting,
		submitError,
		/** The variant the URL names while it opens, or failed to, with why. */
		opening: opening?.jobId === linkedJobId ? opening : null,
		/** Opens the variant the URL names again, after a failed open. */
		retryOpen,
		generate
	}
}

export type ImgTo3dGeneration = ReturnType<typeof useImgTo3dGeneration>
