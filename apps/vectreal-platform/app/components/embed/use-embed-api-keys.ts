import { useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'

import {
	buildUpgradeModalState,
	upgradeModalAtom
} from '../../lib/stores/upgrade-modal-store'

import type { Plan } from '../../constants/plan-config'
import type { EmbedApiKeyOption } from '../../lib/domain/embed/embed-key-options'
import type {
	EmbedApiKeyCreatedPayload,
	EmbedApiKeysPayload
} from '../../routes/api/projects.$projectId.api-keys'

/**
 * `ApiResponse.success` wraps the payload; `ApiResponse.error` returns a bare
 * `{ success: false, error }`. `ApiResponse.quotaExceeded` adds `quota`, which
 * is what the upgrade modal needs to name the limit that was hit.
 */
interface QuotaEnvelope {
	limitKey: string
	currentValue: number
	limit: number | null
	plan: Plan
	upgradeTo?: Plan | null
}

type Envelope<T> =
	| { success: true; data: T }
	| { success: false; error?: string; quota?: QuotaEnvelope }

export interface EmbedApiKeysApi {
	keys: EmbedApiKeyOption[]
	allowedDomains: string[]
	canCreateKey: boolean
	/**
	 * Whether an answer has actually come back.
	 *
	 * Not the inverse of a spinner. `listFetcher.state` is `'idle'` both after a
	 * request finishes *and* before one is ever dispatched, and the request is
	 * dispatched from an effect - which never runs on the server. So a
	 * state-derived "loading" flag reads `false` during server rendering, and
	 * every empty-state message gated on it renders into the SSR'd HTML as a
	 * confident statement of fact about data nobody has fetched yet.
	 *
	 * Presence of `data` is the honest signal: it is set once, by a response,
	 * success or failure alike.
	 */
	hasLoaded: boolean
	loadError: string | null
	/** Held in React state only: never persisted, never sent to analytics. */
	token: string
	setToken: (value: string) => void
	selectedKeyId: string
	selectKey: (keyId: string) => void
	/** Set once, when a key is minted here. The only time a key is readable. */
	createdPlaintext: string | null
	/** Expiry of that key, so the dialog can say when the embed will stop. */
	createdKeyExpiresAt: string | null
	/** Closes the one-time key dialog. The value is unrecoverable afterwards. */
	dismissCreatedKey: () => void
	createKey: () => void
	creating: boolean
	createError: string | null
}

const EMPTY_KEYS: EmbedApiKeyOption[] = []
const EMPTY_DOMAINS: string[] = []

/**
 * The embed panel's API key state.
 *
 * Lives outside the panel because it is most of what the panel does: two
 * fetchers, the token the snippet is built from, and the one-shot plaintext a
 * freshly created key returns. Leaving it inline made the panel a component
 * with more state than markup.
 *
 * The token deliberately has no persistence. Writing it to `localStorage` would
 * leave a working embed credential in the browser of anyone who opens this
 * panel on a shared machine, and it is cheap to paste again.
 */
export function useEmbedApiKeys(params: {
	projectId?: string
	enabled: boolean
}): EmbedApiKeysApi {
	const { projectId, enabled } = params
	const endpoint = projectId ? `/api/projects/${projectId}/api-keys` : null

	const listFetcher = useFetcher<Envelope<EmbedApiKeysPayload>>()
	const createFetcher = useFetcher<Envelope<EmbedApiKeyCreatedPayload>>()
	const csrfToken = useAuthenticityToken()
	const setUpgradeModal = useSetAtom(upgradeModalAtom)

	const [token, setToken] = useState('')
	const [selectedKeyId, setSelectedKeyId] = useState('')
	const [createdPlaintext, setCreatedPlaintext] = useState<string | null>(null)
	const [createdKeyExpiresAt, setCreatedKeyExpiresAt] = useState<string | null>(
		null
	)

	const requestedEndpointRef = useRef<string | null>(null)
	const handledCreateRef = useRef<unknown>(null)

	useEffect(() => {
		if (!enabled || !endpoint) return
		if (requestedEndpointRef.current === endpoint) return

		requestedEndpointRef.current = endpoint
		listFetcher.load(endpoint)
		// `listFetcher` is deliberately not a dependency: it is a new object every
		// render, so depending on it re-fires the request on each one. The ref is
		// what makes this run once per endpoint.
	}, [enabled, endpoint])

	// A newly minted key is the one the user wants selected and pasted, and the
	// list it has to appear in was fetched before it existed.
	useEffect(() => {
		if (createFetcher.state !== 'idle' || !createFetcher.data) return
		if (handledCreateRef.current === createFetcher.data) return
		handledCreateRef.current = createFetcher.data

		if (!createFetcher.data.success) {
			// The org is out of API keys on its plan. The route forwards what the
			// upgrade prompt needs, so route it there rather than leaving the user
			// with an error string and no way forward - this is what the full
			// create-key form does for the same error.
			const { quota, error } = createFetcher.data
			if (quota) {
				setUpgradeModal(
					buildUpgradeModalState({
						reason: 'quota_exceeded',
						message: error ?? 'API key limit reached for your plan.',
						...quota,
						actionAttempted: 'api_key_create'
					})
				)
			}
			return
		}

		if (!endpoint) return

		const { key, plaintext } = createFetcher.data.data
		setCreatedPlaintext(plaintext)
		setCreatedKeyExpiresAt(key.expiresAt)
		setToken(plaintext)
		setSelectedKeyId(key.id)
		listFetcher.load(endpoint)
	}, [createFetcher.state, createFetcher.data, endpoint, setUpgradeModal])

	const createKey = useCallback(() => {
		if (!endpoint) return
		createFetcher.submit(
			{ intent: 'create', csrf: csrfToken },
			{ method: 'post', action: endpoint }
		)
	}, [createFetcher, csrfToken, endpoint])

	const selectKey = useCallback((keyId: string) => {
		setSelectedKeyId(keyId)
	}, [])

	const dismissCreatedKey = useCallback(() => {
		setCreatedPlaintext(null)
	}, [])

	const payload = listFetcher.data?.success ? listFetcher.data.data : null

	return {
		keys: payload?.keys ?? EMPTY_KEYS,
		allowedDomains: payload?.allowedDomains ?? EMPTY_DOMAINS,
		canCreateKey: payload?.canCreateKey ?? false,
		hasLoaded: listFetcher.data !== undefined,
		loadError:
			listFetcher.data && !listFetcher.data.success
				? (listFetcher.data.error ?? 'Could not load API keys.')
				: null,
		token,
		setToken,
		selectedKeyId,
		selectKey,
		createdPlaintext,
		createdKeyExpiresAt,
		dismissCreatedKey,
		createKey,
		creating: createFetcher.state !== 'idle',
		createError:
			createFetcher.data &&
			!createFetcher.data.success &&
			!createFetcher.data.quota
				? (createFetcher.data.error ?? null)
				: null
	}
}
