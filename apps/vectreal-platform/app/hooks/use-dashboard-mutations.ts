import { useCallback, useMemo, useRef, useState } from 'react'
import { useFetcher, useFetchers, useRevalidator } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { toast } from 'sonner'

import { useOncePerFetcherResponse } from './use-once-per-fetcher-response'
import {
	serializeDashboardMutationRequest,
	type DashboardMutationRequest,
	type DashboardMutationResponse
} from '../lib/domain/dashboard/dashboard-mutations'

const ENDPOINT = '/api/dashboard/mutations'

/**
 * `ApiResponse.success` wraps the payload; `ApiResponse.error` returns a bare
 * `{ success: false, error }`.
 */
type MutationEnvelope =
	| { success: true; data: DashboardMutationResponse }
	| { success: false; error?: string }

export interface DashboardMutationsApi {
	submit: (request: DashboardMutationRequest) => void
	/** Idle until a response arrives, then the last response or its error. */
	state: 'idle' | 'submitting' | 'loading'
	isBusy: boolean
	lastResponse: DashboardMutationResponse | null
	lastError: string | null
	pendingIds: ReadonlySet<string>
}

function describeOutcome(response: DashboardMutationResponse): {
	level: 'success' | 'warning'
	message: string
} {
	const { summary, verb } = response

	if (verb === 'create-folder') {
		return { level: 'success', message: 'Folder created' }
	}

	const noun =
		verb === 'delete' ? 'deleted' : verb === 'move' ? 'moved' : 'renamed'

	if (summary.failed > 0) {
		return {
			level: 'warning',
			message: `${summary.succeeded}/${summary.total} ${noun}, ${summary.failed} failed`
		}
	}

	return {
		level: 'success',
		message:
			summary.total === 1
				? `Item ${noun}`
				: `${summary.succeeded} items ${noun}`
	}
}

/**
 * Client for the unified dashboard mutation endpoint.
 *
 * Replaces `useDashboardSceneActions`, whose toast de-duplication lived in two
 * module-level mutable variables shared by every mounted instance - with three
 * or four mounts live at once, one instance marking a response handled made the
 * others skip it. Both pieces of that state are refs here, so each consumer
 * tracks its own.
 *
 * The fetcher is unkeyed for the same reason: a shared key made every mount
 * observe every other mount's response.
 *
 * Which response has been handled is `useOncePerFetcherResponse`'s question,
 * and it is the fourth call site to ask it. The three before it each keyed on
 * the response body and each shipped the same pair of defects; see that hook
 * for why identity is the only thing that answers it.
 */
export function useDashboardMutations(options?: {
	onSuccess?: (response: DashboardMutationResponse) => void
	/** Suppress the built-in toasts when the caller renders its own feedback. */
	silent?: boolean
}): DashboardMutationsApi {
	const fetcher = useFetcher<MutationEnvelope>()
	const revalidator = useRevalidator()
	const csrfToken = useAuthenticityToken()

	const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set())
	const [lastResponse, setLastResponse] =
		useState<DashboardMutationResponse | null>(null)
	const [lastError, setLastError] = useState<string | null>(null)

	const onSuccessRef = useRef(options?.onSuccess)
	const silentRef = useRef(options?.silent)
	onSuccessRef.current = options?.onSuccess
	silentRef.current = options?.silent

	const submit = useCallback(
		(request: DashboardMutationRequest) => {
			setLastError(null)

			const targetIds =
				request.verb === 'rename'
					? [request.target.id]
					: request.verb === 'create-folder'
						? []
						: request.targets.map((target) => target.id)
			setPendingIds(new Set(targetIds))

			fetcher.submit(
				{ ...serializeDashboardMutationRequest(request), csrf: csrfToken },
				{ method: 'post', action: ENDPOINT }
			)
		},
		[csrfToken, fetcher]
	)

	useOncePerFetcherResponse(fetcher, (envelope) => {
		setPendingIds(new Set())

		if (!envelope.success) {
			const message = envelope.error ?? 'Action failed'
			setLastError(message)
			if (!silentRef.current) {
				toast.error(message)
			}
			return
		}

		const response = envelope.data
		setLastResponse(response)

		if (!silentRef.current) {
			const outcome = describeOutcome(response)
			toast[outcome.level](outcome.message)
		}

		if (response.summary.succeeded > 0) {
			onSuccessRef.current?.(response)
			revalidator.revalidate()
		}
	})

	return {
		submit,
		state: fetcher.state,
		isBusy: fetcher.state !== 'idle' || revalidator.state !== 'idle',
		lastResponse,
		lastError,
		pendingIds
	}
}

export interface DashboardMutationStatus {
	/** A mutation is in flight, from anywhere in the tree. */
	isBusy: boolean
	/** Ids currently being mutated, for per-row spinners. */
	pendingIds: ReadonlySet<string>
}

/**
 * Observes in-flight dashboard mutations without owning one.
 *
 * Tables need to know a mutation is running so they can disable their actions,
 * but the mutation itself is submitted by whichever dialog the user opened. The
 * predecessor solved this by giving every consumer the same fetcher key, which
 * also made every consumer receive every other consumer's *response* - the
 * cause of the toast duplication and suppression bugs. Reading the fetcher list
 * gives the same visibility with none of the shared state.
 */
export function useDashboardMutationStatus(): DashboardMutationStatus {
	const fetchers = useFetchers()
	const revalidator = useRevalidator()

	// `useFetchers` only ever returns in-flight fetchers, so matching the action
	// is the whole filter.
	const inFlight = useMemo(
		() => fetchers.filter((candidate) => candidate.formAction === ENDPOINT),
		[fetchers]
	)

	const pendingIds = useMemo(() => {
		const ids = new Set<string>()

		for (const candidate of inFlight) {
			const raw = candidate.formData?.get('targets')
			if (typeof raw !== 'string') {
				continue
			}

			try {
				const targets = JSON.parse(raw) as Array<{ id?: unknown }>
				for (const target of targets) {
					if (typeof target?.id === 'string') {
						ids.add(target.id)
					}
				}
			} catch {
				// A malformed body is the endpoint's problem, not the spinner's.
			}
		}

		return ids
	}, [inFlight])

	return {
		isBusy: inFlight.length > 0 || revalidator.state !== 'idle',
		pendingIds
	}
}
